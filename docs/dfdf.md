# OpenFlows Controller — Internal Architecture

**Document type:** Internal architecture (deep-dive)
**Scope:** Subsystem 01 of the OpenFlows system — the OpenFlows Controller.
**Companion docs:** `openflows-system-architecture.md` (system-wide, authoritative), `openflows-control-decisions.md` (the three design choices).

---

## 1. Role & Responsibilities

The Controller is the **brain of the fleet**. It is a single, long-lived process that runs inside the `openflows-nexus` Coder workspace (the **control plane**). It is the *only* OpenFlows component that talks to the Coder control-plane API to provision workspaces and create agent chats, and it is the *only* process that writes to the SharedStore (aside from the `openflows-harness` inside worker workspaces).

Its responsibilities:

- **Ingest** — pull GitHub issues into tickets.
- **Dispatch** — assign assignable tickets to idle worker slots (FORGE, SENTINEL, VESSEL, LORE).
- **Provision** — create Coder workspaces from role templates and bind per-ticket agent chats.
- **Coordinate** — route work between roles via the flow graph and typed Action edges.
- **Recover** — reconcile stale/orphaned/crashed state every pass; bounded retries then human escalation.
- **Escalate** — park `awaiting_human` tickets and notify via configured channels.
- **Host the A2A relay** — the HTTP server enabling Sentinel↔Forge delegated verification.

The Controller does **not** run LLM calls for the agents — that is the Coder AI Gateway's job. Worker workspaces carry **no LLM keys**.

---

## 2. Execution Environment & Entrypoint

**Binary:** `openflows` → subcommand `run` (default). **Source:** `binary/src/bin/agentflow.rs`.

The Controller is fail-fast on required environment (injected by the Coder template, no fallback):

| Variable | Purpose |
|----------|---------|
| `CODER_URL` | Coder server base URL |
| `CODER_SESSION_TOKEN` | Scoped tenant-owner token (chat + workspace CRUD, never admin) |
| `REDIS_URL` | SharedStore connection |
| `OPENFLOWS_TENANT` | Tenant identifier (namespaces every Redis key) |
| `GITHUB_REPOSITORY` | Target repo in `owner/repo` form |

Secondary / optional env: `OPENFLOWS_HOME` (orchestration files root), `A2A_RELAY_ADDR` (default `127.0.0.1:3000`), `OPENFLOWS_REGISTRY_PATH` / `OPENFLOWS_REGISTRY_JSON` (registry resolution), `ARTIFACTS_DIR`, `GITHUB_TOKEN`, `SLACK_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL`, WhatsApp variables.

The `run_controller()` boot sequence (`agentflow.rs:147`):

```
 ┌────────────────────────────────────────────────────────────────────┐
 │ 1. Validate environment (fail-fast on missing required vars)       │
 │ 2. Open tenant-scoped SharedStore (Redis)                          │
 │ 3. Start A2A relay (background Axum HTTP :3000)                    │
 │ 4. Resolve orchestration directory (registry + personas + hooks)   │
 │ 5. Load agent registry → env vars + registry_json store key        │
 │ 6. Construct the five role nodes (Nexus, Forge, Sentinel, Vessel,  │
 │    optional Lore)                                                  │
 │ 7. Build the Flow graph with typed Action routes                   │
 │ 8. Enter the paced poll loop (flow pass every 15s)                 │
 └────────────────────────────────────────────────────────────────────┘
```

---

## 3. The PocketFlow Runtime (execution model)

The Controller's logic is expressed as a **directed flow graph** of nodes. This is provided by `crates/pocketflow-core`.

### 3.1 The `Node` trait

Every role implements the `Node` trait (`pocketflow-core/src/node.rs`), which enforces a strict three-phase contract:

```rust
trait Node: Send + Sync {
    fn name(&self) -> &str;
    async fn prep(&self, store: &SharedStore) -> Result<Value>;  // READ only
    async fn exec(&self, prep_result: Value) -> Result<Value>;   // external I/O, NO store writes
    async fn post(&self, store: &SharedStore, exec_result: Value) -> Result<Action>; // WRITE + route
}
```

The contract is enforced structurally: `exec()` does **not** receive the store, so a node cannot write mid-computation. `Node::run()` (default method) sequences `prep → exec → post` and emits lifecycle events (`prep_started`, `exec_started`, `post_done`, …) to the store's event ring buffer on each transition — this is the audit/trace seam.

### 3.2 The `Flow` state machine

`Flow` (`pocketflow-core/src/flow.rs`) connects nodes by **Action strings**:

- A node returns an `Action` from `post()`.
- The flow looks the Action up in the current node's **route table** (`action → node_name`).
- If no route exists, the flow stops for that pass.
- If the Action is `STOP_SIGNAL` (`__stop__`) or `PAUSE_SIGNAL` (`__pause__`), the flow terminates the pass early — routing is skipped.

**Self-healing guards** (return `PAUSE_SIGNAL` instead of crashing):
- `max_steps` (default 10 000; the Controller sets **1000**) — a hard pass cap.
- `max_visits_per_node` (default 20) — per-node cycle detection that catches tight A→B→A→B ping-pong in roughly `2 × threshold` steps (the Controller keeps 20).

Because a paused pass returns `Ok(PAUSE_SIGNAL)`, it is **not** an error — the paced loop simply retries next poll. Idle/in-progress states also *pause* the pass rather than error.

---

## 4. The SharedStore (durable state)

Provided by `pocketflow-core/src/store.rs`. A dual-backend key-value store with an identical interface — **in-memory** for dev/tests, **Redis** for compose/production. The Controller always uses Redis (`SharedStore::new_redis_with_tenant`).

### 4.1 Tenancy

Every key is namespaced as **`ns:{tenant}:{key}`**. `SharedStore::ns_key()` prepends the namespace; `new_redis_with_tenant` derives the tenant from the explicit arg, else `OPENFLOWS_TENANT`, else `"default"`. This gives hard key-space isolation per tenant alongside Coder RBAC.

Raw (un-namespaced) scan/delete helpers — `raw_keys()` / `raw_del()` — operate on full keys and are used only by **admin/CLI** commands (tenant enumerate, list, purge).

### 4.2 API surface

| Method | Behavior |
|--------|----------|
| `get`/`set`/`del` | Namespaced value read/write/delete (JSON) |
| `get_typed`/`set_typed` | Typed serde (de)serialization |
| `keys(pattern)` | Namespaced SCAN |
| `raw_keys`/`raw_del` | Raw scan/delete for admin |
| `emit` / `get_events_since` / `event_count` | **Event ring buffer** (fixed 1000 slots, drops oldest). Every node lifecycle phase pushes a `StoreEvent { agent, event_type, payload, ts }`. Used for auditing and for LORE's `ticket_merged` detection. The ring buffer is **per-process** (not persisted across restart) — durable facts live in explicit keys. |

### 4.3 Durable key map (per tenant)

| Key pattern | Type | Purpose |
|-------------|------|---------|
| `tickets` | `Vec<Ticket>` | Known tickets |
| `worker_slots` | `HashMap<String, WorkerSlot>` | Worker availability + workspace IDs |
| `pending_prs` | `Vec<Value>` | PRs awaiting VESSEL |
| `ci_readiness` | `CiReadiness` | Whether CI workflows exist (GitHub/workspace/local) |
| `repository` | `String` | Current repo (owner/repo), for provisioning |
| `command_gate` | — | Command approval gate state |
| `documentation_queue` | `Vec<Value>` | LORE documentation requests |
| `registry_json` | `String` | **Live agent registry** (control-plane source of truth; see §11) |
| `ticket:{id}:status` | `{phase, role, ts}` | Harness phase object |
| `ticket:{id}:gate:{phase}` | `GateApproval` | Single-use gate token |
| `ticket:{id}:chat:{role}` | `String` | Coder chat ID |
| `ticket:{id}:dispatch:{role}` | `DispatchPayload` | Task assignment |
| `ticket:{id}:review:{role}` | `ReviewPayload` | Review verdict |
| `ticket:{id}:deployment` | — | Vessel merge/deploy result |
| `ticket:{id}:workspace:{role}` | — | Workspace ID for a ticket+role |
| `ticket:{id}:recovery_attempts` | int | Recovery counter |
| `heartbeat:{role}-T-{ticket}` | JSON | Liveness |
| `pair:{id}:plan` | — | Planning artifact (A2A plan gate) |
| `pair:{pair_id}:verification` | — | A2A verification terminal result (mirrored) |
| `audit:a2a:{task_id}:*` | — | A2A audit logs |
| `_ci_fix_attempts_*`, `_conflict_attempts_*`, `_merge_blocked_*` | int | Per-PR attempt counters (survive pending_prs re-add) |

---

## 5. The Flow Graph & Routing

Built in `agentflow.rs:257` with `Flow::new("nexus")`. This is the **single place all possible transitions are declared** — there is no hidden routing logic elsewhere.

```
 START: nexus
              ┌──────────────────────────────────────────────────────────────┐
              ▼                                                              │
   ┌──────┐  work_assigned   ┌────────────┐  pr_opened / planning_gate /    │
   │ nexus │ ───────────────▶│ forge_pair │  review_ready                    │
   └──────┘                  └────────────┘  ──────────────────────────┐    │
      ▲  ▲   ▲   ▲            │   │                                    ▼    │
      │  │   │   │            │   └──planning_gate──▶ nexus──────────┐ sentinel
   merge_prs│   │            │   └──review_ready───▶ nexus──────────┐   │
      │  │   │   │            │   (via sentinel_spawned)            │   │
      │  │   │   no_work      └──failed / suspended/suspended───────┐   │
      │  │   │   (via no_work/suspended)                             │   │
      │  │   │                                                       │   │
      │  │   │   review_reject (Sentinel→Forge) ◀────────────────────┘   │
      │  │   │                                                           │
      │  │   │  review_approve ─────────────▶ vessel ──deployed──▶ (lore|nexus)
      │  │   │                                   │  └─ci_fix_needed / conflicts_detected ─▶ forge_pair
      │  │   │                                   └─deploy_failed / merge_blocked ──▶ nexus
      │  │   │                                   └─awaiting_human ──▶ nexus
      └──┴──┴─┴─────────────────────────────────────────────────────────┘
              (no_work / docs_complete from lore ──▶ nexus)
```

**Edges (node → routes):**

- **nexus** → forge_pair on `work_assigned` / `approve_command`; → vessel on `merge_prs`; → sentinel on `sentinel_spawned`; → self on `reject_command`.
- **forge_pair** → sentinel on `pr_opened`; → nexus on `planning_gate`, `review_ready`, `failed`, `suspended`, `no_tickets`.
- **sentinel** → vessel on `review_approve`; → forge_pair on `review_reject`; → nexus on `no_work`.
- **vessel** → lore on `deployed` (if LORE active, else nexus); → forge_pair on `ci_fix_needed` / `conflicts_detected`; → nexus on `deploy_failed`, `merge_blocked`, `awaiting_human`, `no_work`.
- **lore** → nexus on `docs_complete` / `no_work`.

---

## 6. The Five Role Nodes

### 6.1 NexusNode — the orchestrator (`crates/agent-nexus/src/lib.rs`)

The **root node**. Fields: `persona_path`, `registry_path`, `a2a_relay: Option<Arc<A2ARelay>>`.

**`prep()`** — the bulk of controller work; every pass it:
1. `sync_registry(store)` — reconciles the live registry with `worker_slots`.
2. Resolves `repository` (env or store) and persists it.
3. `sync_issues(store, owner, repo)` → writes `tickets`.
4. `sync_open_prs(...)` → writes `pending_prs` (with de-dupe/skip guards).
5. `check_ci_readiness(...)` → writes `ci_readiness` (detects local/workspace/GitHub CI config).
6. Ticket normalization: auto-resolve unrecognized statuses, drop stale CI-setup tickets, ensure/prioritize the CI-first ticket.
7. Recycles `Done` workers → `Idle` when assignable tickets exist.
8. `Self::reconcile(...)` → `FlowRecovery`, then `inspect_coder_recovery` + `repair_coder_recovery` (crashed workspaces/chats).
9. Re-provisions busy-but-empty workspaces; `create_chat_for_ticket_id` per active worker.
10. `poll_harness_status_and_spawn_agents(...)` — spawns SENTINEL for `planning`/`review_ready`.

Returns a JSON decision-set: `tickets`, `assignable_tickets`, `worker_slots`, `open_prs`, `command_gate`, `repository`, `owner`, `repo_name`, `ci_readiness`, `ci_must_go_first`, `flow_recovery`.

**`exec()`** — rule-based decision (LLM runner removed). Yields one of:
- `sentinel_spawned` / `merge_prs` / `no_work` / `PAUSE_SIGNAL` / `work_assigned`.

**`post()`** — applies the decision:
- `merge_prs` → route to Vessel (only if `pending_prs` non-empty).
- `work_assigned` → `recover_orphans`; set ticket `Assigned`; mark slot `Assigned`; `provision_coder_workspace`; `create_chat_for_ticket_id`; `sync_assignment_to_github` (issue assign, once-only comment, label).
- `no_work` → `PAUSE_SIGNAL`.
- `approve_command` / `reject_command` → clear `command_gate`, move slot accordingly.

**Key methods:** `sync_issues`, `sync_open_prs`, `provision_coder_workspace`, `destroy_coder_workspace`, `create_chat_for_assignment`/`create_chat_for_ticket_id`, `resume_chat`, `poll_harness_status_and_spawn_agents`, `spawn_lore_for_merged_tickets`, `check_ci_readiness`, `sync_assignment_to_github`/`post_comment_once`, `recover_orphans`, `reconcile`, `inspect_coder_recovery`/`repair_coder_recovery`, `mark_ticket_awaiting_human`/`notify_awaiting_human`, `release_worker_slot`, gate/phase helpers, and the **A2A relay module** (see §8).

**Recovery structures** (all in `FlowRecovery`): `unmerged_prs`, `orphaned_tickets`, `stale_workers`, `completed_without_pr`, `crashed_workspaces`, `crashed_chats`, each with `has_*` flags and `needs_recovery`.

### 6.2 ForgePairNode — the builder (`crates/agent-forge/src/lib.rs`)

A **thin monitor** over Coder agent chats; the coding intelligence lives in the Coder control plane. Implements `BatchNode` (one item per assigned/in-progress FORGE ticket). Fields: `workspace_root`, `registry_path`.

**`prep_batch()`** — items for `Assigned`/`InProgress` tickets whose worker role is `forge` (ticket id, worker id, workspace id, status).

**`exec_one()`** — no external I/O (pass-through).

**`post_batch()`** — the real logic:
- `read_harness_status` (→ `ticket:{id}:status` phase object) and routes:
  - `review_ready` → sync PR (`read_harness_pr_info` + `sync_harness_pr_to_pending`) or flag `review_ready`.
  - `blocked` → `failed`.
  - `planning` → flag **`planning_gate`** (pending SENTINEL).
  - `building`/`testing` → in-progress.
- Monitors the Coder chat (`get_chat` + `sync_chat_status_to_store`): Running→`building`, Waiting→action analysis, Error→`resume_needed`, RequiresAction→awaiting-human.
- Checks `pending_prs` for the ticket (→ `pr_opened`) and the handoff key.

Returns one routing `Action` by priority: `pr_opened` → `planning_gate` → `review_ready` → `failed` → `in_progress` → `PAUSE_SIGNAL`, else `no_tickets`.

### 6.3 SentinelNode — the adversarial reviewer (`crates/agent-sentinel/src/lib.rs`)

Implements `Node`. Field: `registry_path`.

**`prep()`** — for each `Assigned`/`InProgress` ticket: reads its review verdict (`ticket:{id}:review:sentinel` → `ReviewPayload { verdict, report, pr_number }`) into `reviewable`; if harness phase is `planning` and the planning gate is unapproved and a sentinel chat exists, adds to `planning_gate_pending`; reads the sentinel chat status (Error → `interrupted`).

**`exec()`** — aggregates `approve`/`reject` (from reviews) and synthetic `planning_gate_pending` entries.

**`post()`**:
- **approve** → set `ticket:{id}:status = approved`, mark `completed`, delete review key.
- **reject** → `send_rejection_follow_up` (posts the report into the **forge** chat), archive sentinel chat, delete review key.
- **planning_gate_pending** → if gate approved: check `pair:{id}:plan`; missing → write a `blocked` ReviewPayload (hard-fail: unknown ≠ pass) and archive; present → archive, release sentinel slot to `Idle`.

Returns: `review_approve` → `no_work` (planning approved) → `review_reject` → `PAUSE_SIGNAL`.

> **Note on A2A:** `SentinelNode` itself reviews via Coder chats and a plan-artifact gate check — it does not call the A2A `verify` protocol directly. The **A2A relay** (§8) is hosted by Nexus and is what Sentinel/Forge workspaces use for delegated verification.

### 6.4 VesselNode — the DevOps / merge gatekeeper (`crates/agent-vessel/src/`)

The **only** agent allowed to merge/tear down. `lib.rs` is a facade re-exporting `ci_poller`, `conflict_resolver`, `merger`, `node`, `notifier`, `types`. Implements `Node`. Fields: `config: VesselConfig`, `client: GithubRestClient`, `poller: CiPoller`, `merger: PrMerger`. Constants: `MAX_CONFLICT_RESOLUTION_ATTEMPTS = 3`, `MAX_CI_FIX_ATTEMPTS = 3`.

**`prep()`** — reads `repository` (→ owner/repo), `pending_prs`, `ci_readiness`.

**`exec()`** — per pending PR: `get_pull_request`; determine CI presence (handles "PR adds CI that runs on itself"); then either `merge_without_ci` (no CI → `CiMissing`) or `process_single_pr` = **CI poll** (`poller.poll_until_terminal`) → **merge** (`merger.merge`). Outcomes: `Merged`, `MergeBlocked` (conflict → `handle_conflicts` → `Conflicts`/`DocsPrClosed`), `CiFailed` (structured failed-check detail), `CiTimeout`.

**`post()`** handles each outcome:
- **Merged / CiMissing / DocsPrClosed** → emit `ticket_merged`, set ticket `merged`, write `ticket:{id}:deployment`, **destroy Coder workspace**, close GitHub issue, remove from pending, recycle worker (Done→Idle) → `any_success`.
- **CiFailed/CiTimeout** → if attempts ≥ `MAX_CI_FIX_ATTEMPTS` mark failed; else write `CI_FIX.md`, reassign a FORGE worker for CI fix → `any_ci_fix`/`any_failure`.
- **MergeBlocked** → increment `_merge_blocked_` counter → mark failed.
- **Conflicts** → if attempts ≥ `MAX_CONFLICT_RESOLUTION_ATTEMPTS` → **escalate to `awaiting_human`** + notify; else reassign worker for conflict rework → `any_conflicts`.

Returns action by priority: `awaiting_human` → `conflicts_detected` → `deployed` → `ci_fix_needed` → `deploy_failed` → `no_work`.

Key helpers: `stop_coder_workspace_for_*` / `destroy_coder_workspace_for_*` (teardown + archive chats + clear slot workspace_id), `recycle_worker`, `process_single_pr`/`merge_without_ci`/`handle_conflicts` (local git `merge origin/<default>` + `CONFLICT_RESOLUTION.md`, with GitHub `list_conflicted_files` fallback), attempt counters, `has_any_check_runs`, docs-PR short-circuit (`is_docs_pr`/`close_docs_pr_with_conflicts`), `reconcile` (startup detect of already-merged PRs).

### 6.5 LoreNode — the documenter (`crates/agent-lore/src/lib.rs`)

Implements `Node`; optional (disabled unless `lore.enabled`). Fields: `config`, `adr_generator`, `changelog_manager`, `readme_manager`, `docs_manager`, `retrospective_generator`.

**`prep()`** — `get_documentation_tasks` (reads `documentation_queue`, `lore_processed_events`, and store events filtering `ticket_merged`, skipping docs PRs) → `LoreTask::AdrGeneration` and `LoreTask::ChangelogUpdate` per merged ticket; `get_merged_tickets_from_store`; `load_persona`.

**`exec()`** — runs each task locally (file/git): changelog update (`ensure_changelog_exists`, `categorize_from_pr`, `add_entry`), ADR generation (`adr_generator.generate`), doc sync, README feature-section update.

**`post()`** — if files changed: `commit_and_push_docs` (on `lore/docs-*` branch) and `open_docs_pr` (append docs PR to `pending_prs`); emits `changelog_updated` / `adr_written`; returns `docs_complete`.

---

## 7. The Paced Poll Loop & Self-Healing

Source: `agentflow.rs:326-348`.

```rust
loop {
    match flow.run(&store).await {
        Ok(action)      => log (self-healing: paused/idle is normal),
        Err(e)          => log error (NEVER kill the controller),
    }
    tokio::time::sleep(CONTROLLER_POLL_INTERVAL).await;  // 15s
}
```

Key properties:

- **Self-healing** — a flow pass that errors is logged and retried on the next poll; a flow error never kills the controller.
- **Paced, not busy** — 15s between passes; transient failures (Redis drops, Coder timeouts, GitHub rate limits) resolve on the next poll.
- **Pause/target semantics** — the recent control-plane design adds a `paused | drained | targeted | auto` control state consulted in Nexus's `prep()` (see §11).

---

## 8. The A2A Relay (delegated verification)

Source: `crates/agent-nexus/src/a2a/mod.rs` + `http_server.rs` + `routing.rs` + `verify_handler.rs`.

- **What:** An Axum HTTP server (`start_a2a_relay`, default `127.0.0.1:3000`) run as a background task inside the Controller (Nexus workspace).
- **Why:** Coder workspaces can initiate outbound connections but accept inbound poorly; the relay lets both SENTINEL and FORGE dial **outbound** to it, making NEXUS the enforcement chokepoint.
- **Protocol (v1, pull-based JSON-RPC/HTTP):** SENTINEL submits via `message/send`; FORGE claims via `tasks/claim`, executes, reports via `tasks/complete`; SENTINEL polls `tasks/get` for the terminal state. SSE (`GET /`) is reserved for future streaming.
- **Durability:** every terminal result is **mirrored to Redis** before the task is acknowledged complete (`pair:{pair_id}:verification`, `audit:a2a:{task_id}:*`). A result that cannot be persisted cannot approve a gate (`completed_unpersisted`).
- **Failure semantics ("when in doubt, don't approve"):** FORGE offline → `executor_unavailable` → SENTINEL records `blocked`; timeout → `timed_out:true` never satisfies expectations; duplicate requests deduped by `(pair_id, sha256(body))`.
- **Allowlisting & audit:** only safe command prefixes pass; rejections → `audit:a2a:rejected`; every accepted request/result is durably logged. One relay = one kill switch.

---

## 9. The Coder Integration Layer

`crates/coder-client/src/lib.rs` is the **only** crate that touches the Coder API. The Controller isolates all Chat API and workspace CRUD behind `CoderClient`:

- **Workspaces:** `create_workspace`/`create_workspace_for_user`/`create_role_workspace`, `start/stop/delete_workspace`, `get_workspace`, `wait_for_workspace_ready`/`wait_for_workspace_ssh`, `workspace_exec_*` (legacy/deprecated for CLI spawning), `workspace_read_file`/`write_file`.
- **Chats API (the LLM loop):** `create_chat`, `get_chat`/`get_chat_opt`, `list_chats`, `send_chat_message`, `get_chat_messages`, `archive_chat`, `interrupt_chat`, `list_chat_models`, `create_ticket_chat`, `archive_ticket_chats`.
- **Admin/bootstrap:** `create_first_user`, `login_with_password`, `list_users`, `get_me`, `create_api_token`, `push_template`, `list_templates`, `list_organizations`.
- **Model resolution:** `model_config_id` expects a UUID; `create_ticket_chat` passes `None` and lets the server use the default model (matched against `GET /api/experimental/chats/models`).

The Chat lifecycle within the Controller: **provision workspace → create empty chat → SessionStart hook boots the agent with initial context** (the agent is never given a giant hardcoded prompt).

---

## 10. Failure & Recovery Model

`NexusNode::reconcile()` + `inspect_coder_recovery`/`repair_coder_recovery` run every pass and repair:

1. Unmerged PRs not processed by VESSEL.
2. Orphaned tickets (assigned/in-progress but worker idle/missing).
3. Stale workers referencing dead tickets.
4. Completed-without-PR tickets.
5. Crashed workspaces (heartbeat stale > 90s).
6. Crashed chats (status `Error`).
7. Tickets stuck in `planning` without a SENTINEL chat.

**Bounded recovery:** max 3 `recovery_attempts` per ticket → then `awaiting_human` escalation: ticket parked (not repeatedly retried), worker released, `NotificationService` fires to Slack/Discord/WhatsApp (batched: max 1 per channel per ticket per 5 min, fire-and-forget).

A human resolves via: comment/close the GitHub issue, `openflows tenant clean` (resets stale `awaiting_human`/`failed` back to `Open`), or answering directly in the Coder chat.

---

## 11. Control-Plane Design (from the recent decisions)

The system-facing decisions in `openflows-control-decisions.md` integrate with the Controller as follows:

### 11.1 Dynamic agent registry (no file)
- **Today:** the Controller loads the registry in `agentflow.rs` (from path/env) and writes `registry_json` into the store (see §4.3). `sync_registry` reconciles `worker_slots` from it every pass.
- **Decision:** the registry becomes **entirely control-plane defined** — the `registry_json` store key is the sole source of truth; the bundled `registry.json` is eliminated. The control path is `openflows control set-registry <json>` / a web-UI endpoint. Because `sync_registry` re-reads the store each pass, a change applies **on the next poll without a restart** and `worker_slots` rescales automatically.
- **Guardrail:** overrides must preserve `effective_instances()` semantics (v1 `instances` vs v2 `max_instances`) so a partial override can never zero-out a role.

### 11.2 Halt / target / continue
- A `control` state (`paused | drained | targeted | auto`) plus a `targets` set (repo / issue / label) is stored in Redis (`ns:{tenant}:control:*`).
- Nexus's `prep()` consults it: `paused` → return `no_work` (graceful halt, in-flight work continues); `drained` → stop picking up new tickets; `targeted` → filter `sync_issues` to the target set.
- Exposed via `openflows control pause|resume|drain|target …` and the web UI.

### 11.3 Default Coder chat agent
- Confirmed: the Controller drives the **Coder Chats API** for every role (see §9). CLI-agent spawning via `workspace_exec` is deprecated (`coder_process.rs` stub). The `cli`/`CliBackend` v1 fields are an escape hatch only.

---

## 12. Security Posture (Controller-specific)

| Property | Mechanism |
|----------|-----------|
| Trust boundary | Controller runs in the long-lived, trusted `openflows-nexus` workspace; workers are ephemeral/untrusted |
| Least privilege | `CODER_SESSION_TOKEN` is scoped to chat + workspace CRUD, never admin |
| No credentials in workers | Controller holds Coder/GitHub tokens; workers hold none |
| Store writers only | Controller (pocketflow-core) + `openflows-harness` inside workers; `redis-cli` disallowed |
| Gate integrity | Single-use Redis GETDEL tokens; only SENTINEL may approve |
| Review integrity | Workspace isolation; SENTINEL delegates verification via A2A, never mutates FORGE's tree |
| Audit | Coder audit log + typed SharedStore events + `audit:a2a:*` |

---

## 13. Related Documents

- `openflows-system-architecture.md` — system-wide architecture (this Controller is Subsystem 01).
- `openflows-control-decisions.md` — the three design choices (dynamic registry, web UI, default Coder chat agent).
- `docs/ORCHESTRATOR.md` — orchestrator, agents, and A2A relay detail.
- `docs/AGENT_BOOTSTRAP.md` — SessionStart hook bootstrap and executor setup.
- `docs/architecture/a2a-verification.md` — full A2A JSON-RPC/SSE protocol.
- `docs/architecture/vessel-agent.md` — VESSEL deep-dive.
- `docs/extending.md` / `docs/governance.md` / `docs/tenancy.md` — extension, governance, tenancy.