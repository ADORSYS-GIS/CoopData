# AI Optimization & Orchestration Guide

> **Scope:** Running a self-hosted multimodal LLM (e.g. `Qwen2.5-VL-32B`) for
> CoopData's four AI tasks (financial extraction, vision/OCR, header mapping,
> narratives) — covering VRAM, KV cache, concurrency, batching, serving
> options, scaling, and cost.
>
> **Related:** `docs/design-local-ai.md`, `docs/runbook-local-ai.md`

---

## 1. The Four AI Tasks & Their Load Profiles

| # | Task | Input size | Output size | Concurrency |
|---|------|-----------|-------------|-------------|
| 1 | Financial extraction (`map_to_coa`) | Large (full statement text) | Large (JSON line items) | Low (1 per submission) |
| 2 | Vision / OCR (`vision_capture`) | Large (image → many vision tokens) | Medium | Low |
| 3 | NF header mapping (`map_headers`) | Small (headers) | Tiny (JSON map) | Low |
| 4 | Narratives (`report_narrative`) | Medium | Medium | **High (5 concurrent)** |

The **narrative task** (5 concurrent calls) is what actually stresses
concurrency. Extraction/OCR are large but single.

---

## 2. The VRAM Budget (the core constraint)

VRAM is consumed by four things:

```
VRAM = Model Weights + KV Cache + Activations + Overhead
```

### 2.1 Model weights (by quantization)

| Quant | Size (32B) | Accuracy | Notes |
|-------|-----------|----------|-------|
| FP16 / BF16 | ~64 GB | 100% | Full precision, needs big GPU |
| Q8_0 | ~34 GB | ~99% | Near-lossless |
| **Q4_K_M** | **~20 GB** | ~96% | **Best size/quality balance** |
| Q3_K_M | ~16 GB | ~93% | Lower quality, more headroom |
| Q2_K | ~12 GB | ~88% | Too lossy for financial data |

> **Rule:** For financial extraction, prefer **Q4_K_M or higher**. Don't go
> below Q4 — numeric accuracy matters.

### 2.2 KV cache (the concurrency multiplier)

The **KV cache** stores the model's attention keys/values for every token of
every active sequence. It scales with:

```
KV cache size ≈ 2 × layers × heads × head_dim × context_tokens × bytes_per_elem
```

Practically, for a 32B model:
- **Per 1K tokens of context:** ~0.5–1 GB of KV cache (Q4, FlashAttention off)
- **With FlashAttention / PagedAttention:** significantly less, and it's
  allocated **per active sequence**, not per model.

**The key insight:** KV cache is *per concurrent request*. So:

```
Total KV = KV_per_1K_tokens × context_len × num_concurrent_requests
```

Example for 32B Q4 (weights = 20 GB) on a 48 GB GPU:
- Weights: 20 GB
- KV cache for 8 concurrent × 8K context: ~8–16 GB
- Activations + overhead: ~4–8 GB
- **Total: ~32–44 GB** → fits 48 GB ✅

### 2.3 Sizing rule of thumb

| Goal | VRAM needed (32B Q4) |
|------|---------------------|
| Run model, no concurrency | 24 GB |
| 4 concurrent, small context | 32 GB |
| **8 concurrent, large context** | **48 GB** |
| 16 concurrent, large context | 80 GB |

---

## 3. Context Length

- `Qwen2.5-VL-32B` supports up to **128K context** natively.
- **Longer context = more KV cache = more VRAM.** Don't set max context higher
  than your financial statements actually need.
- For financial statements, **8K–32K context** is usually plenty. Set
  `num_ctx` / `--max-model-len` accordingly to save VRAM for concurrency.
- The app's `AI_MAX_TOKENS=16384` is the **output** limit — that's separate
  from context. Watch for `finish_reason == "max_tokens"` truncation.

---

## 4. Concurrency & Batching

### 4.1 Ollama

- Default: `OLLAMA_NUM_PARALLEL=1` → requests **serialize**.
- Set `OLLAMA_NUM_PARALLEL=N` to process N requests concurrently on one model.
- `OLLAMA_MAX_LOADED_MODELS` controls how many models stay in VRAM (keep = 1).
- **On CPU:** parallel requests don't speed up — they time-slice. Real
  parallelism needs a GPU.

### 4.2 vLLM (recommended for GPU throughput)

vLLM uses **continuous batching** + **PagedAttention**:

- `--max-num-seqs 8` → up to 8 concurrent sequences batched on the GPU.
- `--gpu-memory-utilization 0.9` → use 90% of VRAM.
- `--max-model-len 32768` → cap context to save KV cache.
- `--tensor-parallel-size 2` → split across 2 GPUs (for 48 GB multi-GPU).
- `--quantization awq` / `--dtype float16` → memory-efficient inference.

**Why vLLM > Ollama for concurrency:** continuous batching packs multiple
requests into each forward pass, so 8 concurrent requests run *truly in
parallel* with far higher throughput than Ollama's simple request queue.

### 4.3 llama.cpp / LocalAI

- llama.cpp: `-c <ctx>`, `-np <parallel>` (parallel sequences), `--n-gpu-layers`.
- LocalAI: OpenAI-compatible, supports `--parallel-requests`.

---

## 5. Serving Options Comparison

| Server | Continuous batching | PagedAttention | Easiest | Best for |
|--------|--------------------|----------------|---------|----------|
| **Ollama** | ❌ (simple queue) | ❌ | ✅✅ | Dev / low concurrency |
| **vLLM** | ✅ | ✅ | ✅ | **GPU prod, high concurrency** |
| **llama.cpp** | ⚠️ (limited) | ❌ | ✅ | CPU / edge |
| **LocalAI** | ⚠️ | ❌ | ✅ | Drop-in OpenAI compat |

> **Recommendation:** Ollama for local dev; **vLLM for the AWS/Hetzner GPU**
> when you need real concurrency.

---

## 6. Throughput vs Latency

- **Throughput** (requests/sec) matters for the 5 concurrent narratives.
- **Latency** (time per request) matters for a single extraction.
- Continuous batching (vLLM) maximizes **throughput** at the cost of slightly
  higher per-request latency under load — the right trade for your use case.
- On CPU, both are poor; the GPU is the real lever.

---

## 7. Orchestration (how the app drives the AI)

### 7.1 Current behavior (already good)

- Each upload spawns an **independent `tokio` task** (`upload.rs:257`) with its
  own `job_id`, `submission_id`, `cooperative_id`.
- Extraction has **retry logic** (3 attempts, exponential backoff on transient
  errors) in `extraction_pipeline.rs`.
- Narrative generation runs **5 concurrent LLM calls** (`report_narrative.rs`).
- The app is provider-agnostic (OpenAI-compatible `/chat/completions`).

### 7.2 What to add for robustness

1. **Queue with limits** — cap concurrent in-flight extractions (e.g. a
   semaphore) so 20 simultaneous uploads don't OOM the model server.
2. **Backpressure** — if the model server returns 429/503, the app already
   retries; add a global concurrency limiter to avoid hammering it.
3. **Job status tracking** — the `extraction_job` table already tracks
   `queued → running → done/failed`. Surface this in the UI.
4. **Idempotency** — uploads already target a specific `submission_id`; keep
   dedup by submission so re-uploads don't double-process.
5. **Health check** — poll the model server (`/v1/models`) and mark it
   unavailable if down; fail gracefully instead of hanging.

### 7.3 Scaling the model server

| Load | Setup |
|------|-------|
| Low (dev) | 1× Ollama on CPU |
| Medium (single GPU) | 1× vLLM, `max-num-seqs 8` |
| High (multi-GPU) | vLLM `tensor-parallel-size 2+` on 48–96 GB |
| Very high | Multiple instances behind a load balancer (round-robin) |

---

## 8. Cost Optimization

| Strategy | Saving | Notes |
|----------|--------|-------|
| **Spot instances** (AWS) | up to 70% | Interruptible — fine for bursty AI |
| **Auto-stop when idle** | ~100% when off | Stop GPU after N min of no requests |
| **Hetzner flat monthly** | ~6× cheaper 24/7 | vs AWS on-demand |
| **Right-size VRAM** | — | Don't over-provision; 48 GB is the sweet spot |
| **Cap context length** | — | Shorter context = less KV = more concurrency |

**Decision rule:**
- AI used most of the time → **Hetzner** (flat monthly).
- AI used sporadically → **AWS spot + auto-stop** (pay only when processing).

---

## 9. Recommended Production Configuration

**Server:** vLLM on a 48 GB GPU (AWS `g5.8xlarge` / `g6.8xlarge`, or Hetzner
RTX 6000 Ada).

```bash
vllm serve Qwen/Qwen2.5-VL-32B-Instruct \
  --quantization awq \
  --max-model-len 32768 \
  --max-num-seqs 8 \
  --gpu-memory-utilization 0.9 \
  --tensor-parallel-size 1
```

**App `.env`:**
```dotenv
EXTRACTION_BACKEND=llm
AI_PROVIDER_URL=http://<gpu-ip>:8000/v1   # vLLM OpenAI-compatible endpoint
AI_MODEL=Qwen/Qwen2.5-VL-32B-Instruct
AI_VISION_MODEL=Qwen/Qwen2.5-VL-32B-Instruct
AI_API_KEY=anything
AI_MAX_TOKENS=16384
```

**Backend:** add a concurrency semaphore (e.g. max 8 in-flight extractions).

---

## 10. Quick Reference Cheat Sheet

| Tuning knob | Effect | Where |
|-------------|--------|-------|
| Quantization (Q4 vs Q8) | VRAM vs accuracy | Model download |
| `max-model-len` / `num_ctx` | KV cache size | Server config |
| `max-num-seqs` / `OLLAMA_NUM_PARALLEL` | Concurrency | Server config |
| `gpu-memory-utilization` | VRAM headroom | vLLM |
| `tensor-parallel-size` | Multi-GPU scaling | vLLM |
| Continuous batching | Throughput | vLLM (not Ollama) |
| Spot + auto-stop | Cost | AWS |
| Concurrency semaphore | Backpressure | Backend |
