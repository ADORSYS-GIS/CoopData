# Runbook: Local AI (Ollama)

Operational guide for running CoopData's AI extraction on self-hosted Ollama.

## Quick Reference

| Task | Command |
|------|---------|
| Start Ollama (compose) | `docker compose up -d ollama` |
| Pull a model | `docker compose exec ollama ollama pull qwen2.5-vl:3b` |
| List models | `docker compose exec ollama ollama list` |
| Test endpoint | `curl http://localhost:11434/v1/models` |
| Backend logs | `docker compose logs -f backend` |

## 1. Local Development (this laptop, CPU)

Ollama runs as a `docker-compose` service. The backend connects to
`http://ollama:11434/v1`.

```bash
# 1. Start the Ollama service
docker compose up -d ollama

# 2. Pull a small multimodal model for pipeline validation
docker compose exec ollama ollama pull qwen2.5-vl:3b

# 3. Verify the OpenAI-compatible endpoint
curl http://localhost:11434/v1/models

# 4. Ensure .env points at local Ollama (already set)
#    AI_PROVIDER_URL=http://ollama:11434/v1
#    AI_MODEL=qwen2.5-vl:3b
#    AI_VISION_MODEL=qwen2.5-vl:3b

# 5. Start the rest of the stack
docker compose up -d
```

> **Note:** If the backend runs natively (`cargo run`) instead of in compose,
> use `AI_PROVIDER_URL=http://localhost:11434/v1` instead.

> **Performance:** CPU-only inference is slow (~3–6 tok/s on 8B). Use local
> only to validate the pipeline, not for real submissions.

## 2. Production (AWS GPU instance)

### 2.1 Provision the GPU instance

1. Launch an EC2 instance, e.g. **`g5.xlarge`** (A10G, 24 GB VRAM) or
   **`g6.xlarge`** (L4, 24 GB VRAM).
2. Use a GPU-enabled AMI (e.g. **Deep Learning AMI**) so the NVIDIA driver is
   preinstalled, **or** a generic AMI and run `scripts/setup-ollama-gpu.sh`.
3. Security group: open **TCP 11434** to the backend's security group / VPC
   only (never the public internet).

### 2.2 Install Ollama + model

```bash
sudo ./scripts/setup-ollama-gpu.sh qwen2.5-vl:32b
```

This installs the NVIDIA driver (if needed), installs Ollama, binds it to
`0.0.0.0:11434`, and pulls the model.

### 2.3 Configure `.env` — the model is pulled automatically

You only set the model name and AI vars in `.env`. **`start-prod.sh` reads
`AI_MODEL` and pulls it into Ollama automatically** — no interactive prompt.

```dotenv
EXTRACTION_BACKEND=llm
AI_PROVIDER_URL=http://<gpu-instance-ip>:11434/v1
AI_MODEL=qwen2.5-vl:32b
AI_VISION_MODEL=qwen2.5-vl:32b
AI_API_KEY=ollama
AI_MAX_TOKENS=16384
```

Then just run:

```bash
./start-prod.sh
```

The script starts the Ollama service, pulls `AI_MODEL` (if not already
present), then starts the full stack. To change models later, edit `AI_MODEL`
in `.env` and re-run `./start-prod.sh`.

### 2.4 Verify

```bash
# From the backend host, confirm the endpoint is reachable
curl http://<gpu-instance-ip>:11434/v1/models

# Trigger a submission extraction and watch backend logs
docker compose logs -f backend
```

## 3. Cost Control

- GPU instances bill per hour while running. Use **spot instances** (up to 70%
  cheaper) or **auto-shutdown when idle** (e.g. a cron/EventBridge rule).
- For low submission volume, the cloud API may still be cheaper than a 24/7 GPU.

## 4. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Connection refused` to Ollama | Backend can't reach Ollama | Check network / security group; confirm `AI_PROVIDER_URL` host |
| `max_tokens` truncation | Output too long | Raise `AI_MAX_TOKENS`; check model context window |
| Slow extraction | CPU inference | Use the AWS GPU instance for real work |
| GPU not detected | NVIDIA driver missing | Run `nvidia-smi`; install driver + reboot |
| Out of memory (OOM) | Model too big for VRAM | Use Q3 quant or a larger instance (`g5.2xlarge`) |
