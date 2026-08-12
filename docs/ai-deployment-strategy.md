# AI Deployment Strategy (vLLM + Monitoring)

> **Decision:** Deploy the AI model server with **Docker Compose** on a single
> GPU instance, using **vLLM** for inference and **Prometheus + Grafana** for
> monitoring. Graduate to Kubernetes only when scaling to 3+ GPU nodes.
>
> **Related:** `docs/ai-optimization-guide.md`,
> `docs/ai-architecture-recommendation.md`, `docs/runbook-local-ai.md`

---

## 1. Architecture Overview

```
GitHub Actions (CI/CD)
   │
   ▼
GPU instance (g5.xlarge, 24 GB VRAM)
   ├── vllm (container)          ← Qwen2.5-VL-7B, continuous batching
   ├── dcgm-exporter (container) ← NVIDIA GPU metrics
   ├── node-exporter (container) ← VM metrics (CPU, RAM, disk)
   ├── prometheus (container)    ← scrapes all exporters + vLLM /metrics
   ├── grafana (container)       ← dashboards
   └── alertmanager (container)  ← alerts
   │
   ▼
App backend (separate host) ──AI_PROVIDER_URL──▶ vLLM :8000
```

- **vLLM** is a separate service from the app backend.
- The backend reaches it via `AI_PROVIDER_URL=http://<gpu-ip>:8000/v1`.
- All components run on **one GPU instance** via Docker Compose.

---

## 2. vLLM Service

### 2.1 Dockerfile

```dockerfile
FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04

RUN apt-get update && apt-get install -y python3 python3-pip git && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir vllm

# Expose the OpenAI-compatible endpoint
EXPOSE 8000

ENTRYPOINT ["python3", "-m", "vllm.entrypoints.openai.api_server"]
```

### 2.2 docker-compose.ai.yml

```yaml
services:
  vllm:
    build: .
    container_name: coopdata-vllm
    command:
      - --model
      - Qwen/Qwen2.5-VL-7B-Instruct
      - --quantization
      - awq
      - --max-model-len
      - "32768"
      - --max-num-seqs
      - "8"
      - --gpu-memory-utilization
      - "0.9"
      - --served-model-name
      - qwen2.5vl:7b
      - --host
      - 0.0.0.0
      - --port
      - "8000"
    ports:
      - "127.0.0.1:8000:8000"
    volumes:
      - ~/.cache/huggingface:/root/.cache/huggingface   # model cache
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 120s
```

> **Note:** `--served-model-name qwen2.5vl:7b` lets the app keep
> `AI_MODEL=qwen2.5vl:7b` unchanged.

---

## 3. Monitoring Stack

### 3.1 docker-compose.monitoring.yml

```yaml
services:
  dcgm-exporter:
    image: nvidia/dcgm-exporter:latest
    container_name: coopdata-dcgm
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    ports:
      - "127.0.0.1:9400:9400"
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:latest
    container_name: coopdata-node
    network_mode: host
    pid: host
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    container_name: coopdata-prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    ports:
      - "127.0.0.1:9090:9090"
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: coopdata-grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-admin}
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - "127.0.0.1:3001:3000"
    restart: unless-stopped

  alertmanager:
    image: prom/alertmanager:latest
    container_name: coopdata-alertmanager
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
    ports:
      - "127.0.0.1:9093:9093"
    restart: unless-stopped

volumes:
  prometheus_data:
  grafana_data:
```

### 3.2 prometheus.yml

```yaml
global:
  scrape_interval: 15s

rule_files:
  - /etc/prometheus/alerts.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]

scrape_configs:
  - job_name: "vllm"
    static_configs:
      - targets: ["vllm:8000"]
    metrics_path: /metrics

  - job_name: "dcgm"
    static_configs:
      - targets: ["dcgm-exporter:9400"]

  - job_name: "node"
    static_configs:
      - targets: ["node-exporter:9100"]
```

### 3.3 alerts.yml (key alerts)

```yaml
groups:
  - name: ai
    rules:
      - alert: GPUOutOfMemory
        expr: dcgm_memory_used_bytes / dcgm_memory_total_bytes > 0.95
        for: 2m
        labels: { severity: critical }
        annotations:
          summary: "GPU memory above 95%"

      - alert: VLLMDown
        expr: up{job="vllm"} == 0
        for: 1m
        labels: { severity: critical }
        annotations:
          summary: "vLLM endpoint is down"

      - alert: VLLMQueueHigh
        expr: vllm:num_requests_waiting > 20
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "vLLM request queue is high"

      - alert: HighErrorRate
        expr: rate(vllm:request_success_total{status="error"}[5m]) > 0.1
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "High inference error rate"
```

### 3.4 alertmanager.yml

```yaml
route:
  receiver: "default"
  group_by: ["alertname"]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

receivers:
  - name: "default"
    # Add your notification channel here (email, Slack, PagerDuty, webhook)
    # email_configs:
    #   - to: "ops@example.com"
    #     from: "alert@example.com"
    #     smarthost: "smtp.example.com:587"
```

---

## 4. CI/CD (GitHub Actions)

### 4.1 Build & deploy the vLLM image

```yaml
name: deploy-ai
on:
  push:
    branches: [main]
    paths: ["ai/**"]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build vLLM image
        run: docker build -t ghcr.io/${{ github.repository }}/vllm:${GITHUB_SHA::7} ./ai

      - name: Push image
        run: |
          echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u $ --password-stdin
          docker push ghcr.io/${{ github.repository }}/vllm:${GITHUB_SHA::7}

      - name: Deploy to GPU instance
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.GPU_HOST }}
          username: ubuntu
          key: ${{ secrets.GPU_SSH_KEY }}
          script: |
            cd /opt/coopdata-ai
            docker compose pull
            docker compose up -d
```

### 4.2 Model versioning

- Pin the model tag (e.g. `Qwen/Qwen2.5-VL-7B-Instruct`).
- Test a new model in **staging** first; promote to prod only after benchmarking
  on real statements.
- Keep the app's `AI_MODEL` stable via `--served-model-name`.

---

## 5. Cost Optimization

### 5.1 Auto-stop when idle

A cron job on the GPU instance stops it after N minutes of no requests:

```bash
#!/usr/bin/env bash
# /usr/local/bin/stop-gpu-if-idle.sh
# Run every 5 min via cron. Stops the instance if vLLM had no requests for 30 min.
LAST_ACTIVITY=$(curl -sf http://localhost:8000/metrics \
  | grep -E 'vllm:request_success_total' | awk '{print $2}' || echo 0)
# (simplified — track last request timestamp in a file)
if [[ -f /tmp/last_request ]]; then
  AGE=$(( $(date +%s) - $(cat /tmp/last_request) ))
  if (( AGE > 1800 )); then
    /usr/local/bin/aws ec2 stop-instances --instance-ids "$(curl -sf http://169.254.169.254/latest/meta-data/instance-id)"
  fi
fi
```

Cron entry:
```
*/5 * * * * /usr/local/bin/stop-gpu-if-idle.sh
```

### 5.2 Spot instances

- Launch the GPU instance as **spot** (up to 70% cheaper).
- Acceptable for bursty AI; the app retries on transient failures.

---

## 6. Deployment Runbook

### First-time setup (on the GPU instance)

```bash
# 1. Install NVIDIA driver (if not using a GPU AMI)
sudo ./scripts/setup-ollama-gpu.sh   # or install driver manually + reboot

# 2. Verify GPU
nvidia-smi

# 3. Clone the AI deployment repo
git clone <repo> /opt/coopdata-ai && cd /opt/coopdata-ai

# 4. Start vLLM
docker compose -f docker-compose.ai.yml up -d

# 5. Verify the endpoint
curl http://localhost:8000/v1/models
curl http://localhost:8000/health

# 6. Start monitoring
docker compose -f docker-compose.monitoring.yml up -d
```

### Point the app backend at it

```dotenv
EXTRACTION_BACKEND=llm
AI_PROVIDER_URL=http://<gpu-ip>:8000/v1
AI_MODEL=qwen2.5vl:7b
AI_VISION_MODEL=qwen2.5vl:7b
AI_API_KEY=anything
AI_MAX_TOKENS=16384
```

### Security

- Bind vLLM and monitoring to `127.0.0.1` (done above).
- Open port **8000** to the backend's security group / VPC only.
- Never expose Grafana/Prometheus to the public internet.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `CUDA out of memory` | Model too big / too much concurrency | Lower `max-num-seqs` or `gpu-memory-utilization` |
| vLLM won't start | Model not downloaded | Check `~/.cache/huggingface`; ensure network |
| Slow inference | CPU fallback | Verify `nvidia-smi` shows GPU util |
| Backend can't reach vLLM | Security group / network | Open port 8000 to backend VPC |
| High queue | Too many concurrent requests | Raise `max-num-seqs` (if VRAM allows) or scale out |

---

## 8. When to Graduate to Kubernetes

Move to K8s (EKS) only when:
- **3+ GPU nodes** need coordinated scheduling
- **Auto-scaling** based on inference load
- **High availability** (node failure tolerance)
- A **team** manages infra

Until then, Docker Compose on a single GPU instance is simpler, cheaper, and
fully sufficient.
