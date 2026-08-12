# CoopData AI Module

Standalone, independently deployable AI inference module. Serves an
OpenAI-compatible `/v1` endpoint for the CoopData backend's four AI tasks
(extraction, OCR, header mapping, narratives).

**Why standalone:** deploy module-by-module. If this module is down, the rest
of the app stays up — the backend degrades gracefully (extraction jobs fail
cleanly, the app keeps serving).

## Components

| Service | Purpose |
|---------|---------|
| `vllm` | Inference server (Qwen2.5-VL-7B, continuous batching) |
| `dcgm-exporter` | NVIDIA GPU metrics |
| `node-exporter` | VM metrics (CPU, RAM, disk) |
| `prometheus` | Scrapes vLLM + exporters |
| `grafana` | Dashboards |
| `alertmanager` | Alerts |

## Deploy

```bash
cp .env.example .env   # edit values
docker compose up -d vllm          # inference only
docker compose up -d               # inference + monitoring
```

## Point the app backend at it

```dotenv
EXTRACTION_BACKEND=llm
AI_PROVIDER_URL=http://<gpu-ip>:8000/v1
AI_MODEL=qwen2.5vl:7b
AI_VISION_MODEL=qwen2.5vl:7b
AI_API_KEY=anything
AI_MAX_TOKENS=16384
```

## Verify

```bash
curl http://localhost:8000/v1/models
curl http://localhost:8000/health
```

## Cost control

Auto-stop the GPU instance when idle (see `stop-gpu-if-idle.sh`):

```bash
chmod +x stop-gpu-if-idle.sh
crontab -e   # add: */5 * * * * /opt/coopdata-ai/stop-gpu-if-idle.sh
```

## CI/CD

`.github/workflows/deploy.yml` builds the image, pushes to GHCR, and deploys to
the GPU instance on every push to `ai/**`.

## Security

- vLLM and monitoring bind to `127.0.0.1` (not exposed publicly).
- Open port **8000** to the backend's security group / VPC only.
- Never expose Grafana/Prometheus to the public internet.
