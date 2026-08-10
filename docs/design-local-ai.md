# Design: Local AI Migration (Self-Hosted Models)

> **Status:** Approved for implementation
> **Owner:** Backend / Infrastructure
> **Related:** `docs/design-ai-narratives.md`, `docs/ticket-2-ai-extraction-pipeline.md`

## 1. Problem

The app sends financial-statement files to a cloud LLM API (Google Gemini via
`AI_PROVIDER_URL`). Users hit **token limits** when uploading large files for
submission — the full statement text/image exceeds the model's context window
and `AI_MAX_TOKENS` output gets truncated (`finish_reason == "max_tokens"`).
This blocks real submissions.

Sending cooperative financial data to a third-party API is also a **privacy
concern**.

## 2. Goal

Move AI extraction to **self-hosted local models** served via an
OpenAI-compatible endpoint (Ollama), keeping the existing provider-agnostic
code path. Use a **single multimodal model** for all four AI tasks.

## 3. The Four AI Tasks

| # | Task | Code location | Input | Output |
|---|------|---------------|-------|--------|
| 1 | Financial statement extraction | `backend/src/services/ai_extraction.rs` (`map_to_coa`) | Full statement text | JSON line items mapped to CoA |
| 2 | Image / OCR capture | `backend/src/services/ai_extraction.rs` (`vision_capture`) | base64 image (PNG/JPEG/TIFF) | Extracted table text |
| 3 | NF Excel header mapping | `backend/src/services/nf_excel_parser.rs` (`map_headers`) | Sheet headers | Header → canonical field map |
| 4 | Report narratives | `backend/src/services/report_narrative.rs` | Financial context | Narrative text (5 concurrent calls) |

## 4. Why This Is a Config-Only Change

The backend already calls an OpenAI-compatible `/chat/completions` endpoint
(`ai_extraction.rs:512`, `report_narrative.rs:254`) driven entirely by env vars:

```
AI_PROVIDER_URL
AI_MODEL
AI_VISION_MODEL
AI_MAX_TOKENS
AI_API_KEY
```

Ollama exposes the same `/v1/chat/completions` shape, including `image_url`
vision content. Therefore **no application code changes are required** — only
the env vars change per environment.

## 5. Model Selection

A **single multimodal model** handles all four tasks.

| Environment | Model | Q4 size | Notes |
|-------------|-------|---------|-------|
| Dev (this laptop, CPU) | `qwen2.5-vl:3b` | ~2.5 GB | Fast enough to validate the pipeline; low accuracy |
| Production (AWS GPU) | `qwen2.5-vl:32b` | ~20 GB | Best accuracy/size balance, fits 24 GB VRAM |

Alternatives in the same class (A/B test on the GPU): `internvl3:38b`
(stronger OCR, tighter VRAM), `gemma3:27b` (more headroom, weaker OCR).

## 6. Architecture

```
┌──────────────┐   OpenAI-compatible /v1/chat/completions   ┌──────────────┐
│  CoopData    │ ─────────────────────────────────────────▶ │   Ollama     │
│  Backend     │                                            │  (local)     │
│ (Docker)     │ ◀───────────────────────────────────────── │  model       │
└──────────────┘                                            └──────────────┘
        │                                                          │
        │  Dev: docker compose service (ollama)                    │ GPU
        │  Prod: AWS GPU EC2 (g5.xlarge)                           │
```

- **Dev:** Ollama runs as a `docker-compose` service (`ollama`), backend points
  at `http://ollama:11434/v1`.
- **Prod:** Ollama runs on an AWS GPU EC2 instance (`g5.xlarge` / `g6.xlarge`,
  24 GB VRAM), backend points at `http://<gpu-ip>:11434/v1` over the VPC.

## 7. Configuration

See `.env.example` "AI Extraction" section for full comments. Summary:

```dotenv
EXTRACTION_BACKEND=llm
AI_PROVIDER_URL=http://ollama:11434/v1   # or http://<gpu-ip>:11434/v1 in prod
AI_MODEL=qwen2.5-vl:3b                    # qwen2.5-vl:32b in prod
AI_VISION_MODEL=qwen2.5-vl:3b             # same model (multimodal)
AI_API_KEY=ollama                         # Ollama ignores the key
AI_MAX_TOKENS=16384
```

## 8. Acceptance Criteria

- [ ] Local Ollama runs a multimodal model; extraction pipeline completes end-to-end (correct JSON line items, header mapping, narratives).
- [ ] Production points `AI_PROVIDER_URL`/`AI_MODEL`/`AI_VISION_MODEL` at the AWS GPU Ollama endpoint.
- [ ] A single financial statement extracts with **no token-limit errors** and no `max_tokens` truncation.
- [ ] Vision/OCR works for image uploads (PNG/JPEG/TIFF).
- [ ] All four AI tasks work with the same model.
- [ ] No financial data is sent to third-party APIs in production.
- [ ] `.env.example` documents the new AI vars; runbook exists.

## 9. Risks / Notes

- **CPU-only dev is slow** (~15–45 min/statement on 8B) — acceptable for pipeline validation only.
- **GPU cost:** `g5.xlarge` ~$1/hr; use spot instances or auto-shutdown when idle.
- **NVIDIA driver/CUDA** must be installed on the GPU instance (see `scripts/setup-ollama-gpu.sh`).
- **VRAM:** `qwen2.5-vl:32b` Q4 is tight on 24 GB; may need Q3 quant or a 32 GB instance (`g5.2xlarge`).
- **Security:** restrict port 11434 to the backend's security group / VPC.
