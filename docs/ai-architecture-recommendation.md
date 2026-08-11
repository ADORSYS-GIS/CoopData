# AI Architecture Recommendation (All Four AI Tasks)

> **Decision:** Which architecture for CoopData's **four** AI tasks?
> Compared across **time, accuracy, space, money**.
>
> **Related:** `docs/ai-optimization-guide.md`, `docs/design-local-ai.md`

---

## 0. The Four AI Tasks

| # | Task | Code | Load |
|---|------|------|------|
| 1 | Financial extraction (`map_to_coa`) | `ai_extraction.rs` | Large input, large JSON output |
| 2 | Vision / OCR (`vision_capture`) | `ai_extraction.rs` | Image → text |
| 3 | NF header mapping (`map_headers`) | `nf_excel_parser.rs` | Tiny (headers → JSON) |
| 4 | Report narratives | `report_narrative.rs` | Medium, **5 concurrent** |

The architecture must serve **all four** — not just extraction.

---

## 1. The Three Candidates

| # | Architecture | Components |
|---|--------------|-----------|
| **A** | OCR engine + small AI | PaddleOCR (scan) → **Qwen2.5-VL-7B** (all 4 tasks) |
| **B** | One big AI model | **Qwen2.5-VL-32B** (all 4 tasks) |
| **C** | Two small AI models | Small vision model (OCR) + small text model (extraction/narratives) |

---

## 2. Task-by-Task Model Requirement

| Task | Min viable | 7B quality | 32B quality | Notes |
|------|-----------|-----------|-------------|-------|
| **Extraction** | 3B | ✅ Good | ⭐ Best | Structured JSON; 7B is fine |
| **OCR (printed)** | OCR engine | ✅ Good | ⭐ Best | PaddleOCR beats both for printed |
| **OCR (handwritten)** | — | ⚠️ Weak | ⭐ Best | Needs human review either way |
| **Header mapping** | 1B | ✅ Excellent | ✅ Excellent | Trivial — any model |
| **Narratives** | 3B | ⚠️ Decent | ⭐ Polished | **The one place size visibly matters** |

**Key finding:** 4 of the 5 rows are fine at 7B. The **only** place a bigger
model clearly helps is **narrative quality** (ministry-facing prose).

---

## 3. Comparison Matrix (all four tasks)

| Criterion | A: OCR + small AI | B: Big 32B | C: Two small models |
|-----------|-------------------|-----------|---------------------|
| **Time** | ⭐ Fastest | Slowest | Fast |
| **Printed OCR** | ⭐ Best (PaddleOCR) | Good | Good |
| **Handwritten** | ⚠️ Weak (review) | ⭐ Best | ⚠️ Weak |
| **Extraction JSON** | Good | ⭐ Best | Good |
| **Header mapping** | ✅ Excellent | ✅ Excellent | ✅ Excellent |
| **Narratives** | ⚠️ Decent | ⭐ Polished | ⚠️ Decent |
| **Concurrency (5 narratives)** | ✅ Fits 24 GB | ⚠️ Needs 48 GB | ✅ Fits 24 GB |
| **Model size (disk)** | ~2.6 GB | ~20 GB | ~4 GB |
| **VRAM** | 8–24 GB | 48 GB | 8–24 GB |
| **Cost (AWS)** | `g5.xlarge` ~$1/hr | `g5.8xlarge` ~$4/hr | `g5.xlarge` ~$1/hr |
| **Code change** | ⚠️ Yes (vision step) | ❌ No | ⚠️ Yes |
| **Complexity** | Medium | Low | ⚠️ Highest |

---

## 4. Honest Analysis

### Option A — OCR engine + small AI (PaddleOCR → Qwen2.5-VL-7B)

**Pros:**
- **Best printed OCR** (PaddleOCR is a dedicated engine).
- **Handles all 4 tasks** with one small model — extraction, mapping, narratives.
- **Small, fast, cheap** — fits 24 GB with room for the 5 concurrent narratives.
- ~$1/hr.

**Cons:**
- **Narratives are "decent," not polished** — the one visible weakness.
- **Handwriting weak** — covered by human review.
- **Needs a code change** to the vision step.

### Option B — One big 32B model

**Pros:**
- **Best everywhere**, especially narratives and handwriting.
- **Zero code change** (drop-in via `AI_MODEL`).
- Simplest to operate.

**Cons:**
- **4× the cost** (~$4/hr, 48 GB for concurrency).
- **Slowest**.
- **Overkill** for extraction/mapping/printed-OCR, which 7B already does well.

### Option C — Two small models

**Pros:**
- Specialized per task.

**Cons:**
- **Most moving parts**, most orchestration.
- No real accuracy gain over A.
- **Not worth the complexity.**

---

## 5. Decision Matrix (weighted)

| Criterion | Weight | A | B | C |
|-----------|--------|---|---|---|
| Extraction accuracy | 25% | 4 | 5 | 4 |
| OCR (printed) | 15% | 5 | 4 | 4 |
| OCR (handwritten) | 10% | 2 | 5 | 2 |
| Header mapping | 5% | 5 | 5 | 5 |
| Narrative quality | 15% | 3 | 5 | 3 |
| Speed | 10% | 5 | 2 | 5 |
| Cost | 10% | 5 | 1 | 5 |
| Simplicity / ops | 10% | 3 | 5 | 1 |
| **Weighted total** | | **4.0** | **4.1** | **3.5** |

> A and B are **very close** (4.0 vs 4.1). The tiebreaker is **cost and
> concurrency**: A does it at ~$1/hr with comfortable concurrency; B costs 4×
> more and needs 48 GB.

---

## 6. 🏆 Recommendation: Option A — OCR engine + small AI, with an optional narrative upgrade

**Default: PaddleOCR → Qwen2.5-VL-7B for all four tasks.**

```
Upload (PDF/image)
   │
   ▼
PaddleOCR ──► clean text (best printed accuracy, fast, tiny)
   │
   ▼
Qwen2.5-VL-7B ──► all four tasks:
   │               • extraction → JSON line items
   │               • header mapping → JSON map
   │               • narratives → prose
   │
   ▼
Confidence check ──► high: auto-approve
                 └──► low: flag for human review (handwriting/unclear)
```

### Why A wins for ALL tasks

- **Extraction, mapping, printed-OCR:** 7B + PaddleOCR is genuinely good — no
  benefit from 32B here.
- **Concurrency:** 7B fits 24 GB with room for the 5 parallel narratives;
  32B needs 48 GB.
- **Cost:** ~$1/hr vs ~$4/hr.
- **Narratives:** the only weak spot — solved with the optional upgrade below.

### Optional narrative-quality upgrade (if ministry-facing prose matters)

Keep 7B for extraction/OCR/mapping, and route **only the narrative task** to a
bigger model (or the cloud API). This gets polished narratives without paying
4× for everything. The app already separates the narrative generator
(`report_narrative.rs`) from extraction, so this is a targeted change.

---

## 7. Hardware & Cost

| | Dev (local) | Prod (AWS/Hetzner) |
|---|---|---|
| Model | Qwen2.5-VL-7B (Q4, ~5.5 GB) | Qwen2.5-VL-7B (Q4) |
| OCR | PaddleOCR (CPU) | PaddleOCR (CPU) |
| GPU | None (CPU OK) | `g5.xlarge` (24 GB) ~$1/hr |
| Concurrency | — | vLLM `max-num-seqs 8` |

---

## 8. Implementation Notes

1. **Add PaddleOCR** as a preprocessing step in `vision_capture`
   (`ai_extraction.rs`) — OCR the image to text first, then pass clean text to
   the model.
2. **Keep 7B** for extraction, header mapping, and narratives.
3. **Optional:** route narratives to a larger model if quality demands.
4. **Wire confidence → review** for low-confidence/handwritten items.
5. **Config-only switch** between A and B remains possible via `AI_MODEL` /
   `AI_PROVIDER_URL`.

---

## 9. Bottom Line

- **Best overall for all four tasks:** **Option A** (PaddleOCR + Qwen2.5-VL-7B)
  — small, fast, cheap, best printed OCR, good extraction/mapping, decent
  narratives, comfortable concurrency.
- **Choose B (32B) only if** narrative polish or handwriting accuracy is
  business-critical and the 4× cost is acceptable.
- **Avoid C** — complexity without benefit.

> **Decision:** Implement **Option A**. Benchmark on real statements; escalate
> narratives (or the whole stack) to 32B only if quality fails.
