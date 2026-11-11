use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::Semaphore;
use tokio::task::JoinSet;

use chrono::{Datelike, NaiveDate, Utc};
use sea_orm::Set;
use serde::Serialize;
use uuid::Uuid;

use crate::auth::claims::Claims;
use crate::entities::enums::{
    Currency, LoanStatus, PeriodType, ReviewAction, ReviewTier, SubmissionCreatedByRole,
    SubmissionStatus,
};
use crate::entities::{
    balance_sheet_line_item, chart_of_account, cooperative, financial_statement, mambu_branch_link,
    mambu_sync_item, mambu_sync_run, submission, submission_review,
};
use crate::error::{AppError, AppResult};
use crate::repositories::mambu::{RUN_COMPLETED, RUN_FAILED};
use crate::services::mambu::arrears;
use crate::services::mambu::client::{MambuApiClient, ReadProgress};
use crate::services::mambu::derived;
use crate::services::mambu::ledger_source::{self, LedgerSource};
use crate::services::mambu::mapper::{
    self, branch_region, classify_deposit, map_fixed_deposit, map_ledger, map_loan, map_member,
    map_savings, month_end, share_balance_for, DropReason, KIND_FIXED_DEPOSIT, KIND_IGNORE,
    KIND_SHARE,
};
use crate::services::mambu::models::{MambuBranch, MambuDeposit};
use crate::services::mambu::totals;
use crate::services::nf_excel_parser::NfParseResult;
use crate::services::nf_persist::persist_nf_parse_result;
use crate::services::SubmissionWorkflow;
use crate::AppState;

pub const ITEM_PENDING: &str = "pending";
pub const ITEM_SYNCED: &str = "synced";
pub const ITEM_FLAGGED: &str = "flagged";
pub const ITEM_SKIPPED: &str = "skipped";
pub const ITEM_FAILED: &str = "failed";

pub const SUBMISSION_METHOD: &str = "mambu";

const INTERRUPTED: &str = "Interrupted: the server stopped before this sync finished";
/// A branch with more deposit accounts than this is synced alone: its raw and mapped
/// records are the largest memory use of a sync.
const HEAVY_BRANCH_DEPOSITS: u64 = 20_000;
static HEAVY_BRANCH: tokio::sync::Semaphore = tokio::sync::Semaphore::const_new(1);

const PHASE_WAITING: &str = "waiting";
const PHASE_READING_MEMBERS: &str = "reading_members";
const PHASE_READING_LEDGER: &str = "reading_ledger";
const PHASE_READING_DEPOSITS: &str = "reading_deposits";
const PHASE_SAVING: &str = "saving";
const PROGRESS_EVERY: Duration = Duration::from_secs(3);

/// How often a run is carried on after the server stopped. A run that keeps stopping the
/// server (for example by running out of memory) would otherwise start again for ever.
const MAX_RESUMES: i32 = 3;
const INTERRUPTED_TOO_OFTEN: &str = "The sync was interrupted 3 times because the server stopped, most likely because it ran out of memory. It was not started again. Ask an administrator to check the server.";

/// Syncs that may run at the same time. More requests wait, so Mambu is not flooded.
pub const MAX_CONCURRENT_RUNS: usize = 3;

/// A cooperative or apex cannot start a new sync for the same SACCO sooner than this.
pub const COOLDOWN_MINUTES: i64 = 5;

/// The user id recorded for syncs started by the scheduler.
pub const SYSTEM_ACTOR: &str = "00000000-0000-0000-0000-000000000000";

/// A sync makes a draft at the apex. Only the apex checks it, submits it (which approves
/// it, the apex being the last level) and changes it. Everyone else can only read it.
fn created_by_role() -> SubmissionCreatedByRole {
    SubmissionCreatedByRole::Apex
}

fn review_tier() -> ReviewTier {
    ReviewTier::Apex
}

fn draft_status() -> SubmissionStatus {
    SubmissionStatus::Draft
}

/// A year that already has a submission in CoopData is never imported: the import would
/// overwrite or duplicate what people already entered. Delete the draft first to import again.
pub(crate) async fn existing_submission_reason(
    state: &AppState,
    cooperative_id: Uuid,
    year: i32,
) -> AppResult<Option<String>> {
    let existing = state
        .submission_repo
        .find_all_by_cooperative_and_year(cooperative_id, year)
        .await?;
    Ok((!existing.is_empty()).then(|| {
        format!(
            "A submission for {year} already exists in CoopData. It was not imported or changed."
        )
    }))
}

/// Mambu has data for a SACCO when at least one ledger account has a balance or a movement.
fn has_ledger_data(months: &[(u32, Vec<crate::services::mambu::models::ReportItem>)]) -> bool {
    months.iter().any(|(_, items)| {
        items.iter().any(|i| {
            let a = &i.amounts;
            a.opening_balance != 0.0
                || a.debits != 0.0
                || a.credits != 0.0
                || a.closing_balance != 0.0
        })
    })
}

fn review_comment(as_of: NaiveDate, today: NaiveDate, trigger: &str) -> String {
    let period = if as_of > today {
        format!("{today} (the month to date; it ends {as_of})")
    } else {
        as_of.to_string()
    };
    let how = if trigger == "scheduler" {
        "the automatic sync"
    } else {
        "a sync"
    };
    format!("Imported from Mambu by {how} for {period}. Check the numbers and the warnings, then submit.")
}

fn trigger_of(actor: &Claims) -> &'static str {
    if actor.sub == SYSTEM_ACTOR {
        "scheduler"
    } else {
        "apex"
    }
}

/// Which SACCOs a sync covers.
#[derive(Debug, Clone)]
pub enum SyncScope {
    All,
    Cooperatives(Vec<Uuid>),
}

/// A run still "running" after this long is presumed lost (for example the server
/// restarted) and no longer blocks a new sync.
const STALE_RUN_HOURS: i64 = 3;

#[derive(Debug, Clone, Serialize)]
pub struct SyncWarning {
    pub code: String,
    pub severity: &'static str,
    pub count: usize,
    pub message: String,
}

impl SyncWarning {
    fn info(code: &str, count: usize, message: &str) -> Self {
        Self {
            code: code.to_string(),
            severity: "info",
            count,
            message: message.to_string(),
        }
    }
    fn warning(code: &str, count: usize, message: &str) -> Self {
        Self {
            code: code.to_string(),
            severity: "warning",
            count,
            message: message.to_string(),
        }
    }
}

struct ReferenceData {
    /// Empty when the Mambu user may not list branches.
    branches: HashMap<String, MambuBranch>,
    /// Lists the Mambu user may not read, so the sync can say what it did without.
    unavailable: Vec<&'static str>,
    deposit_product_ids: HashMap<String, String>,
    deposit_product_terms: HashMap<String, u32>,
    loan_product_ids: HashMap<String, String>,
    deposit_overrides: HashMap<String, String>,
    loan_overrides: HashMap<String, String>,
    account_mappings: HashMap<String, (i32, i16)>,
    /// Header accounts of the Mambu chart as (type, code). A report lists detail
    /// accounts only, so the headers are read here to map accounts through them.
    gl_headers: Vec<(String, String)>,
    coa: HashMap<i32, chart_of_account::Model>,
}

enum Outcome {
    Done {
        submission_id: Uuid,
        warnings: Vec<SyncWarning>,
        counts: [i32; 5],
        unmapped: i32,
    },
    Skipped(String),
}

pub async fn start_run(
    state: &AppState,
    year: i32,
    month: u32,
    actor: Arc<Claims>,
    scope: SyncScope,
) -> AppResult<mambu_sync_run::Model> {
    let client = state.mambu_client.clone().ok_or_else(|| {
        AppError::BadRequest("The Mambu integration is not configured on this server".into())
    })?;
    // Month 0 means the whole year.
    if month > 12 || !(2000..=2100).contains(&year) {
        return Err(AppError::BadRequest("Invalid year or month".into()));
    }
    let first_of_period = NaiveDate::from_ymd_opt(year, month.max(1), 1)
        .ok_or_else(|| AppError::BadRequest("Invalid year or month".into()))?;
    if first_of_period > Utc::now().date_naive() {
        return Err(AppError::BadRequest(
            "The period has not started yet".into(),
        ));
    }

    let mut active_runs = Vec::new();
    for run in state.mambu_repo.list_running_runs().await? {
        if Utc::now() - run.started_at < chrono::Duration::hours(STALE_RUN_HOURS) {
            active_runs.push(run);
        } else {
            state
                .mambu_repo
                .finish_run(run.id, RUN_FAILED, Some(INTERRUPTED.into()))
                .await?;
            state
                .mambu_repo
                .fail_pending_items(run.id, INTERRUPTED)
                .await?;
        }
    }
    if active_runs.len() >= MAX_CONCURRENT_RUNS {
        return Err(AppError::Conflict(
            "Mambu is busy with other syncs. Try again in a few minutes.".into(),
        ));
    }

    let single = matches!(&scope, SyncScope::Cooperatives(ids) if ids.len() == 1);
    let links = match scope {
        SyncScope::All => state.mambu_repo.list_links().await?,
        SyncScope::Cooperatives(ids) => state.mambu_repo.list_links_for(ids).await?,
    };
    if links.is_empty() {
        return Err(AppError::BadRequest(
            "None of the selected cooperatives is linked to a Mambu branch yet. Link them first."
                .into(),
        ));
    }

    let busy = state
        .mambu_repo
        .pending_cooperative_ids(active_runs.iter().map(|r| r.id).collect())
        .await?;
    let recent: HashSet<Uuid> = state
        .mambu_repo
        .last_sync_starts(
            links.iter().map(|l| l.cooperative_id).collect(),
            Utc::now() - chrono::Duration::minutes(COOLDOWN_MINUTES),
        )
        .await?
        .into_keys()
        .collect();
    let (ready, blocked): (Vec<_>, Vec<_>) = links
        .into_iter()
        .partition(|l| !busy.contains(&l.cooperative_id) && !recent.contains(&l.cooperative_id));
    if ready.is_empty() {
        let message = if single && !busy.is_empty() {
            "A sync is already running for this SACCO. Wait for it to finish.".to_string()
        } else if recent.is_empty() {
            "A sync is already running for these SACCOs. Wait for it to finish.".to_string()
        } else {
            format!(
                "This SACCO was synced less than {COOLDOWN_MINUTES} minutes ago. Wait a few minutes."
            )
        };
        return Err(AppError::Conflict(message));
    }
    let links = ready;
    let mut reasons = Vec::new();
    for link in &links {
        if let Some(reason) = existing_submission_reason(state, link.cooperative_id, year).await? {
            reasons.push(reason);
        }
    }
    if reasons.len() == links.len() {
        return Err(AppError::Conflict(if single {
            reasons.swap_remove(0)
        } else {
            format!("A submission for {year} already exists in CoopData for every selected cooperative. Nothing was imported.")
        }));
    }

    let run = state
        .mambu_repo
        .create_run(
            year,
            month as i16,
            Some(actor.sub.clone()),
            (links.len() + blocked.len()) as i32,
        )
        .await?;
    for link in &blocked {
        let mut item = state
            .mambu_repo
            .create_item(
                run.id,
                Some(link.cooperative_id),
                &link.mambu_branch_id,
                ITEM_SKIPPED,
            )
            .await?;
        item.error = Some(if busy.contains(&link.cooperative_id) {
            "Another sync is already running for this SACCO. It was not synced.".to_string()
        } else {
            format!("Synced less than {COOLDOWN_MINUTES} minutes ago. It was not synced again.")
        });
        state.mambu_repo.save_item(item).await?;
    }
    let mut items = Vec::new();
    for link in &links {
        let created = state
            .mambu_repo
            .create_item(
                run.id,
                Some(link.cooperative_id),
                &link.mambu_branch_id,
                ITEM_PENDING,
            )
            .await;
        match created {
            Ok(item) => items.push(item),
            Err(e) => {
                // The unique index on pending items fired: another request started
                // the same SACCO between the check above and this insert.
                let reason = "Another sync started for this SACCO at the same time";
                state.mambu_repo.fail_pending_items(run.id, reason).await?;
                state
                    .mambu_repo
                    .finish_run(run.id, RUN_FAILED, Some(reason.into()))
                    .await?;
                let text = e.to_string().to_lowercase();
                return Err(if text.contains("duplicate") || text.contains("unique") {
                    AppError::Conflict(
                        "A sync is already running for this SACCO. Wait for it to finish.".into(),
                    )
                } else {
                    e
                });
            }
        }
    }

    let task_state = state.clone();
    let task_run = run.clone();
    tokio::spawn(async move {
        execute_run(task_state, client, task_run, items, links, actor).await;
    });
    Ok(run)
}

/// Claims for work the server does by itself: the automatic sync and a sync it picks
/// up again after a restart.
pub fn system_claims(sub: &str, name: &str) -> Arc<Claims> {
    let claims = serde_json::from_value::<Claims>(serde_json::json!({
        "sub": sub, "exp": 4102444800u64, "iat": 0, "iss": "coopdata", "name": name
    }));
    Arc::new(claims.unwrap_or_else(|_| {
        // The shape above is fixed, so this cannot fail; keep a harmless fallback.
        serde_json::from_value(serde_json::json!({
            "sub": SYSTEM_ACTOR, "exp": 4102444800u64, "iat": 0, "iss": "coopdata"
        }))
        .expect("system claims")
    }))
}

/// Called once at start-up. A sync that was running when the server stopped is carried
/// on for the SACCOs that had not finished, instead of being thrown away.
pub async fn resume_interrupted_runs(state: &AppState) {
    let Some(client) = state.mambu_client.clone() else {
        return;
    };
    let runs = match state.mambu_repo.list_running_runs().await {
        Ok(runs) => runs,
        Err(e) => {
            tracing::error!(error = %e, "Could not look for interrupted Mambu syncs");
            return;
        }
    };
    for run in runs {
        if Utc::now() - run.started_at >= chrono::Duration::hours(STALE_RUN_HOURS) {
            continue;
        }
        if run.resume_count >= MAX_RESUMES {
            tracing::error!(run_id = %run.id, resumes = run.resume_count, "A Mambu sync keeps being interrupted, it is not started again");
            let _ = state
                .mambu_repo
                .fail_pending_items(run.id, INTERRUPTED_TOO_OFTEN)
                .await;
            let _ = state
                .mambu_repo
                .finish_run(run.id, RUN_FAILED, Some(INTERRUPTED_TOO_OFTEN.into()))
                .await;
            continue;
        }
        let items = match state.mambu_repo.list_items(run.id).await {
            Ok(items) => items,
            Err(_) => continue,
        };
        let mut todo = Vec::new();
        let mut links = Vec::new();
        for item in items.into_iter().filter(|i| i.status == ITEM_PENDING) {
            let link = match item.cooperative_id {
                Some(id) => state.mambu_repo.find_link(id).await.ok().flatten(),
                None => None,
            };
            match link {
                Some(link) => {
                    todo.push(item);
                    links.push(link);
                }
                None => {
                    let mut item = item;
                    item.status = ITEM_FAILED.to_string();
                    item.error = Some("The Mambu link was removed before the sync finished".into());
                    let _ = state.mambu_repo.save_item(item).await;
                }
            }
        }
        if todo.is_empty() {
            let _ = state
                .mambu_repo
                .finish_run(run.id, RUN_COMPLETED, None)
                .await;
            continue;
        }
        let resumes = state
            .mambu_repo
            .bump_resume_count(run.id)
            .await
            .unwrap_or(run.resume_count + 1);
        tracing::info!(run_id = %run.id, saccos = todo.len(), resumes, "Continuing an interrupted Mambu sync");
        let actor = system_claims(run.started_by.as_deref().unwrap_or(SYSTEM_ACTOR), "Sync");
        let (state, client) = (state.clone(), client.clone());
        tokio::spawn(async move {
            execute_run(state, client, run, todo, links, actor).await;
        });
    }
}

async fn execute_run(
    state: AppState,
    client: Arc<MambuApiClient>,
    run: mambu_sync_run::Model,
    items: Vec<mambu_sync_item::Model>,
    links: Vec<mambu_branch_link::Model>,
    actor: Arc<Claims>,
) {
    let refs = match load_reference_data(&state, &client).await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(run_id = %run.id, error = %e, "Mambu sync could not load reference data");
            let reason = "Could not read the reference data from Mambu";
            let _ = state.mambu_repo.fail_pending_items(run.id, reason).await;
            let _ = state
                .mambu_repo
                .finish_run(run.id, RUN_FAILED, Some(reason.into()))
                .await;
            return;
        }
    };

    let refs = Arc::new(refs);
    let semaphore = Arc::new(Semaphore::new(
        state.config.mambu_sync_concurrency.clamp(1, 16),
    ));
    let mut tasks: JoinSet<()> = JoinSet::new();
    for (item, link) in items.into_iter().zip(links) {
        let state = state.clone();
        let client = client.clone();
        let refs = refs.clone();
        let run = run.clone();
        let actor = actor.clone();
        let semaphore = semaphore.clone();
        tasks.spawn(async move {
            let _permit = semaphore.acquire_owned().await;
            process_item(&state, &client, &refs, &run, item, link, &actor).await;
        });
    }
    while let Some(finished) = tasks.join_next().await {
        if let Err(e) = finished {
            tracing::error!(run_id = %run.id, error = %e, "A Mambu sync task stopped unexpectedly");
        }
    }
    let _ = state
        .mambu_repo
        .finish_run(run.id, RUN_COMPLETED, None)
        .await;
}

async fn load_reference_data(
    state: &AppState,
    client: &MambuApiClient,
) -> AppResult<ReferenceData> {
    // Branches and products only refine the data (region, product overrides, fixed
    // deposit term). A Mambu user without the right to list them still syncs.
    let mut unavailable: Vec<&'static str> = Vec::new();
    let branches: HashMap<String, MambuBranch> = match client.branches().await {
        Ok(list) => list.into_iter().map(|b| (b.id.clone(), b)).collect(),
        Err(e) => {
            tracing::warn!(error = %e, "Mambu branches are not readable, the cooperative region is used");
            unavailable.push("branches");
            HashMap::new()
        }
    };
    let deposit_products = match client.deposit_products().await {
        Ok(list) => list,
        Err(e) => {
            tracing::warn!(error = %e, "Mambu deposit products are not readable");
            unavailable.push("deposit products");
            Vec::new()
        }
    };
    let deposit_product_terms = deposit_products
        .iter()
        .filter_map(|p| {
            let months = p.maturity_settings.as_ref()?.months()?;
            Some((p.encoded_key.clone()?, months))
        })
        .collect();
    let deposit_product_ids = deposit_products
        .into_iter()
        .filter_map(|p| p.encoded_key.map(|k| (k, p.id)))
        .collect();
    let loan_product_ids = match client.loan_products().await {
        Ok(list) => list
            .into_iter()
            .filter_map(|p| p.encoded_key.map(|k| (k, p.id)))
            .collect(),
        Err(e) => {
            tracing::warn!(error = %e, "Mambu loan products are not readable");
            unavailable.push("loan products");
            HashMap::new()
        }
    };
    let mut deposit_overrides = HashMap::new();
    let mut loan_overrides = HashMap::new();
    for m in state.mambu_repo.list_product_mappings().await? {
        if m.product_kind == "deposit" {
            deposit_overrides.insert(m.mambu_product_id, m.mapped_type);
        } else {
            loan_overrides.insert(m.mambu_product_id, m.mapped_type);
        }
    }
    let account_mappings = state
        .mambu_repo
        .list_account_mappings()
        .await?
        .into_iter()
        .map(|m| (m.mambu_gl_code, (m.coop_account_code, m.sign)))
        .collect();
    let gl_headers = match client.gl_accounts().await {
        Ok(list) => list
            .into_iter()
            .filter(|a| a.usage.as_deref() == Some("HEADER"))
            .map(|a| (a.account_type, a.gl_code))
            .collect(),
        Err(e) => {
            tracing::warn!(error = %e, "Mambu chart of accounts is not readable");
            unavailable.push("chart of accounts");
            Vec::new()
        }
    };
    let coa = state
        .coa_repo
        .find_all()
        .await?
        .into_iter()
        .map(|c| (c.account_code, c))
        .collect();
    Ok(ReferenceData {
        branches,
        unavailable,
        deposit_product_ids,
        deposit_product_terms,
        loan_product_ids,
        deposit_overrides,
        loan_overrides,
        account_mappings,
        gl_headers,
        coa,
    })
}

fn tally(counts: &mut HashMap<&'static str, usize>, reason: DropReason) {
    *counts.entry(reason.code()).or_default() += 1;
}

#[allow(clippy::too_many_arguments)]
/// Syncs one SACCO and stores its result. A failure only fails this SACCO.
async fn process_item(
    state: &AppState,
    client: &MambuApiClient,
    refs: &ReferenceData,
    run: &mambu_sync_run::Model,
    mut item: mambu_sync_item::Model,
    link: mambu_branch_link::Model,
    actor: &Arc<Claims>,
) {
    let year = run.reporting_year;
    let month = run.month as u32;
    let result = sync_one(state, client, refs, run, item.id, &link, year, month, actor).await;
    match result {
        Ok(Outcome::Done {
            submission_id,
            warnings,
            counts,
            unmapped,
        }) => {
            let flagged = warnings.iter().any(|w| w.severity == "warning");
            item.status = if flagged { ITEM_FLAGGED } else { ITEM_SYNCED }.to_string();
            item.submission_id = Some(submission_id);
            item.members = counts[0];
            item.savings_accounts = counts[1];
            item.loans = counts[2];
            item.fixed_deposits = counts[3];
            item.ledger_lines = counts[4];
            item.unmapped_ledger_accounts = unmapped;
            item.warnings = serde_json::to_value(&warnings).unwrap_or_default();
        }
        Ok(Outcome::Skipped(reason)) => {
            item.status = ITEM_SKIPPED.to_string();
            item.error = Some(reason);
        }
        Err(e) => {
            tracing::error!(
                run_id = %run.id,
                branch = %link.mambu_branch_id,
                error = %e,
                "Mambu sync failed for a SACCO"
            );
            item.status = ITEM_FAILED.to_string();
            item.error = Some(match e {
                AppError::InternalServerError(msg) => msg,
                _ => "Unexpected error while syncing this SACCO".to_string(),
            });
        }
    }
    if let Err(e) = state.mambu_repo.save_item(item).await {
        tracing::error!(error = %e, "Could not save a Mambu sync result");
    }
}

#[allow(clippy::too_many_arguments)]
async fn sync_one(
    state: &AppState,
    client: &MambuApiClient,
    refs: &ReferenceData,
    run: &mambu_sync_run::Model,
    item_id: Uuid,
    link: &mambu_branch_link::Model,
    year: i32,
    month: u32,
    actor: &Arc<Claims>,
) -> AppResult<Outcome> {
    let coop = state
        .cooperative_repo
        .find_by_id(link.cooperative_id)
        .await?
        .ok_or_else(|| {
            AppError::InternalServerError("The linked cooperative no longer exists".into())
        })?;
    let branch = refs.branches.get(&link.mambu_branch_id);
    if branch.is_none() && refs.unavailable.is_empty() {
        return Err(AppError::InternalServerError(
            "The linked Mambu branch no longer exists".into(),
        ));
    }
    let whole_year = month == 0;
    let months: Vec<u32> = if whole_year {
        (1..=last_started_month(year, Utc::now().date_naive())).collect()
    } else {
        vec![month]
    };
    let last_month = *months
        .last()
        .ok_or_else(|| AppError::InternalServerError("Invalid reporting period".into()))?;
    let as_of = month_end(year, last_month)
        .ok_or_else(|| AppError::InternalServerError("Invalid reporting month".into()))?;
    let period_value = if whole_year {
        crate::services::period_rules::FULL_YEAR.to_string()
    } else {
        month.to_string()
    };

    if let Some(reason) = existing_submission_reason(state, coop.id, year).await? {
        return Ok(Outcome::Skipped(reason));
    }

    // A large branch is read and mapped alone: two of them at once need twice the memory.
    let _heavy = match client.deposit_count(&link.mambu_branch_id).await {
        Some(count) if count > HEAVY_BRANCH_DEPOSITS => {
            set_phase(state, item_id, PHASE_WAITING, 0, count).await;
            tracing::info!(branch = %link.mambu_branch_id, deposits = count, "Large Mambu branch, it is synced alone");
            HEAVY_BRANCH.acquire().await.ok()
        }
        _ => None,
    };
    set_phase(state, item_id, PHASE_READING_MEMBERS, 0, 0).await;
    // The mapper leaves out loans closed before the reporting month, so they are not read.
    let loans_closed_since =
        NaiveDate::from_ymd_opt(as_of.year(), as_of.month(), 1).unwrap_or(as_of);
    let (clients, loans) = client
        .clients_and_loans(&link.mambu_branch_id, loans_closed_since)
        .await?;
    set_phase(state, item_id, PHASE_READING_LEDGER, 0, 0).await;
    let ledger_input = ledger_source::load_ledger(
        client,
        &state.mambu_repo,
        &link.mambu_branch_id,
        year,
        &months,
        whole_year,
        as_of,
    )
    .await?;
    if ledger_input.failed_months.is_empty() && !has_ledger_data(&ledger_input.months) {
        return Ok(Outcome::Skipped(format!(
            "Mambu has no accounting data for this SACCO in {year}. Nothing was imported."
        )));
    }
    let year_start_earnings = ledger_input.year_start_earnings;
    let ledger_source = ledger_input.source;
    let mut unreliable_months: Vec<u32> = ledger_input.failed_months.clone();
    let mut ledgers: Vec<(i16, mapper::LedgerResult)> = Vec::new();
    for (m, items) in &ledger_input.months {
        let ledger = map_ledger(
            items,
            year_start_earnings,
            &refs.account_mappings,
            &refs.gl_headers,
        );
        let summary = mapper::summarize_earnings(items);
        tracing::info!(
            branch = %link.mambu_branch_id,
            month = m,
            items = items.len(),
            income_closing = %summary.income_closing,
            expense_closing = %summary.expense_closing,
            income_movement = %summary.income_movement,
            expense_movement = %summary.expense_movement,
            status = ?ledger.status,
            surplus_split = ledger.surplus_split,
            "Mambu ledger summary"
        );
        if matches!(ledger.status, mapper::LedgerStatus::Unbalanced { .. }) {
            unreliable_months.push(*m);
        }
        ledgers.push((*m as i16, ledger));
    }
    unreliable_months.sort_unstable();

    let fallback_region = branch
        .and_then(branch_region)
        .or_else(|| coop.region.clone());
    let mut drops: HashMap<&'static str, usize> = HashMap::new();
    let mut result = NfParseResult::default();
    let mut holder_codes: HashMap<String, String> = HashMap::new();
    let mut member_index: HashMap<String, usize> = HashMap::new();

    let mut region_assumed = 0usize;
    for c in &clients {
        match map_member(c, fallback_region.clone(), as_of) {
            Ok(record) => {
                if !mapper::member_region_known(c) {
                    region_assumed += 1;
                }
                holder_codes.insert(c.encoded_key.clone(), record.member_id.clone());
                member_index.insert(record.member_id.clone(), result.members.len());
                result.members.push(record);
            }
            Err(reason) => tally(&mut drops, reason),
        }
    }

    let mut loan_type_defaulted = 0usize;
    let mut fd_defaulted = 0usize;
    let mut ignored_deposits = 0usize;
    let progress = Arc::new(ReadProgress::default());
    let reporter = spawn_progress_reporter(state.clone(), item_id, progress.clone());
    let mut handle_page = |page: Vec<MambuDeposit>| -> AppResult<()> {
        for d in &page {
            let product_id = d
                .product_type_key
                .as_ref()
                .and_then(|k| refs.deposit_product_ids.get(k));
            let override_type = product_id.and_then(|id| refs.deposit_overrides.get(id));
            let kind = classify_deposit(d, override_type.map(String::as_str));
            if kind == KIND_IGNORE {
                ignored_deposits += 1;
                continue;
            }
            let Some(holder) = d
                .account_holder_key
                .as_ref()
                .and_then(|k| holder_codes.get(k))
            else {
                tally(&mut drops, DropReason::UnknownHolder);
                continue;
            };
            if kind == KIND_SHARE {
                if let (Some(balance), Some(idx)) =
                    (share_balance_for(d, as_of), member_index.get(holder))
                {
                    result.members[*idx].share_balance += balance;
                }
            } else if kind == KIND_FIXED_DEPOSIT {
                let term = d
                    .product_type_key
                    .as_ref()
                    .and_then(|k| refs.deposit_product_terms.get(k))
                    .copied();
                match map_fixed_deposit(d, holder, as_of, term) {
                    Ok((record, defaulted)) => {
                        fd_defaulted += usize::from(defaulted);
                        result.fixed_deposits.push(record);
                    }
                    Err(reason) => tally(&mut drops, reason),
                }
            } else {
                match map_savings(d, holder, kind, as_of) {
                    Ok(record) => result.savings_accounts.push(record),
                    Err(reason) => tally(&mut drops, reason),
                }
            }
        }
        Ok(())
    };
    let deposits_read = client
        .deposits_each(
            &link.mambu_branch_id,
            Some(progress.as_ref()),
            &mut handle_page,
        )
        .await;
    reporter.abort();
    deposits_read?;
    set_phase(state, item_id, PHASE_SAVING, 0, 0).await;
    drop(clients);

    for l in &loans {
        let product_id = l
            .product_type_key
            .as_ref()
            .and_then(|k| refs.loan_product_ids.get(k));
        let override_type = product_id.and_then(|id| refs.loan_overrides.get(id));
        let Some(holder) = l
            .account_holder_key
            .as_ref()
            .and_then(|k| holder_codes.get(k))
        else {
            tally(&mut drops, DropReason::UnknownHolder);
            continue;
        };
        match map_loan(l, holder, override_type.map(String::as_str), as_of) {
            Ok(record) => {
                if override_type.is_none()
                    && !mapper::loan_type_matched(
                        l.loan_name.as_deref().unwrap_or(""),
                        l.loan_info.as_ref().and_then(|i| i.loanp.as_deref()),
                    )
                {
                    loan_type_defaulted += 1;
                }
                result.loans.push(record)
            }
            Err(reason) => tally(&mut drops, reason),
        }
    }

    let mut open_loans: HashMap<String, usize> = HashMap::new();
    for l in &result.loans {
        if l.loan_status != LoanStatus::WrittenOff && !l.balance.is_zero() {
            *open_loans.entry(l.member_business_id.clone()).or_default() += 1;
        }
    }
    for l in &mut result.loans {
        if open_loans.get(&l.member_business_id).copied().unwrap_or(0) > 1
            && l.loan_status != LoanStatus::WrittenOff
            && !l.balance.is_zero()
        {
            l.multiple_loans_flag = true;
        }
    }

    let approximate = as_of < month_end(Utc::now().year(), Utc::now().month()).unwrap_or(as_of);

    // The loan list is as at the sync time, so the arrears buckets only fit the month
    // that is running now.
    let today = Utc::now().date_naive();
    let mut arrears_split = false;
    for (m, ledger) in ledgers.iter_mut() {
        if year == today.year()
            && u32::try_from(*m).ok() == Some(today.month())
            && !arrears::split_arrears(&mut ledger.lines, &result.loans).is_zero()
        {
            arrears_split = true;
        }
    }

    let submission_id = write_submission(
        state,
        &coop,
        run,
        year,
        &period_value,
        as_of,
        approximate,
        &result,
        &ledgers,
        &refs.coa,
        actor,
    )
    .await?;
    let period_start = if whole_year {
        NaiveDate::from_ymd_opt(year, 1, 1).unwrap_or(as_of)
    } else {
        NaiveDate::from_ymd_opt(year, month, 1).unwrap_or(as_of)
    };
    if let Err(e) =
        derived::save_indicators(state, submission_id, &result.members, period_start, as_of).await
    {
        tracing::warn!(error = %e, "Could not save the indicators counted from the member list");
    }

    let mut warnings: Vec<SyncWarning> = Vec::new();
    let mut codes: Vec<_> = drops.into_iter().collect();
    codes.sort();
    for (code, count) in codes {
        let blocking = matches!(
            code,
            "MEMBER_BIRTH_DATE_MISSING" | "MEMBER_REGION_MISSING" | "MEMBER_JOIN_DATE_MISSING"
        );
        let message = format!("{count} record(s) left out: {code}");
        warnings.push(if blocking {
            SyncWarning::warning(code, count, &message)
        } else {
            SyncWarning::info(code, count, &message)
        });
    }
    if approximate {
        warnings.push(SyncWarning::warning(
            "LISTS_AS_AT_SYNC_TIME",
            1,
            "Balances and loan arrears are the values at sync time, not at the end of the requested month",
        ));
    }
    if !refs.unavailable.is_empty() {
        warnings.push(SyncWarning::info(
            "REFERENCE_DATA_UNAVAILABLE",
            refs.unavailable.len(),
            &format!(
                "The Mambu user may not read {}. The cooperative region, the product names and the maturity date of each deposit were used instead.",
                refs.unavailable.join(", ")
            ),
        ));
    }
    if ignored_deposits > 0 {
        warnings.push(SyncWarning::info(
            "DEPOSITS_IGNORED_BY_PRODUCT",
            ignored_deposits,
            "Deposit accounts of collection, payout, tax or similar products are not reported. Map a product to include it.",
        ));
    }
    if fd_defaulted > 0 {
        warnings.push(SyncWarning::warning(
            "FD_MATURITY_DEFAULTED",
            fd_defaulted,
            "Maturity date missing in Mambu; the product term (12 months if unknown) was used",
        ));
    }
    if arrears_split {
        warnings.push(SyncWarning::info(
            "ARREARS_SPLIT_CURRENT_MONTH",
            1,
            "Loans in arrears were split into the 1-30, 31-60, 61-90 and 91+ day lines from the loan list as at the sync time. This applies to the current month only; earlier months show all loans as performing, because Mambu's ledger does not classify arrears.",
        ));
    }
    if region_assumed > 0 {
        warnings.push(SyncWarning::info(
            "MEMBER_REGION_ASSUMED",
            region_assumed,
            "These members have no region in Mambu. The region of the cooperative was used, so regional figures are approximate.",
        ));
    }
    if loan_type_defaulted > 0 {
        warnings.push(SyncWarning::info(
            "LOAN_TYPE_DEFAULTED",
            loan_type_defaulted,
            "The product name and purpose of these loans say nothing about their type, so they are reported as Personal. Map the loan products under Mapping to change this.",
        ));
    }
    warnings.push(SyncWarning::info(
        "FIELDS_NOT_IN_MAMBU",
        1,
        "Mambu does not hold these fields, so they carry a fixed value and are not real data: members' urban or rural, AGM attendance and voting; savings contribution frequency, number of contributions, balance trend and withdrawal behaviour; fixed deposit renewals and rollover; loans' missed installments, early settlement, large borrower and rural borrower.",
    ));
    match ledger_source {
        LedgerSource::Journal => warnings.push(SyncWarning::info(
            "LEDGER_FROM_JOURNAL",
            ledgers.len(),
            "The ledger was rebuilt from the Mambu general ledger (journal entries), because Mambu's accounting reports do not balance for older periods.",
        )),
        LedgerSource::Reports => warnings.push(SyncWarning::warning(
            "LEDGER_FROM_REPORTS",
            ledgers.len(),
            "The Mambu general ledger could not be read, so Mambu's accounting reports were used. Months where the report does not balance are left empty.",
        )),
    }
    let unmapped_codes: HashSet<&str> = ledgers
        .iter()
        .flat_map(|(_, l)| l.unmapped.iter().map(|u| u.gl_code.as_str()))
        .collect();
    if !unmapped_codes.is_empty() {
        warnings.push(SyncWarning::warning(
            "LEDGER_UNMAPPED",
            unmapped_codes.len(),
            "Ledger accounts with a balance have no mapping. Their balance went to the default account of their type. Ask the Ministry to map them.",
        ));
    }
    let ledger_lines: usize = ledgers.iter().map(|(_, l)| l.lines.len()).sum();
    if unreliable_months.len() == months.len() {
        let message = match ledgers.first().map(|(_, l)| &l.status) {
            Some(mapper::LedgerStatus::Unbalanced { gap }) if !whole_year => format!(
                "Mambu's accounting report for this period does not balance (difference {gap} SZL), so the ledger was left empty. Enter the financial statement by hand, or fix the data in Mambu."
            ),
            _ => "Mambu's accounting reports for this period do not balance, so the ledger was left empty. Enter the financial statement by hand, or fix the data in Mambu.".to_string(),
        };
        warnings.push(SyncWarning::warning(
            "LEDGER_DOES_NOT_BALANCE",
            unreliable_months.len(),
            &message,
        ));
    } else {
        if !unreliable_months.is_empty() {
            let names: Vec<&str> = unreliable_months
                .iter()
                .filter_map(|m| MONTH_NAMES.get(*m as usize - 1).copied())
                .collect();
            warnings.push(SyncWarning::warning(
                "LEDGER_MONTHS_UNRELIABLE",
                unreliable_months.len(),
                &format!(
                    "Mambu's accounting report does not balance for {}. Those months have no ledger values.",
                    names.join(", ")
                ),
            ));
        }
        if ledger_lines == 0 {
            warnings.push(SyncWarning::warning(
                "LEDGER_EMPTY",
                1,
                "No ledger values were produced. Check the account mapping.",
            ));
        } else if ledgers
            .iter()
            .any(|(_, l)| !l.lines.is_empty() && !l.surplus_split)
        {
            warnings.push(SyncWarning::warning(
                "SURPLUS_NOT_SPLIT",
                1,
                "Mambu gives one figure for all earnings and the previous year end could not be read reliably, so accumulated and current year surplus could not be split. All earnings are in the accumulated surplus line.",
            ));
        }
    }

    Ok(Outcome::Done {
        submission_id,
        warnings,
        counts: [
            result.members.len() as i32,
            result.savings_accounts.len() as i32,
            result.loans.len() as i32,
            result.fixed_deposits.len() as i32,
            ledger_lines as i32,
        ],
        unmapped: unmapped_codes.len() as i32,
    })
}

/// Last month of `year` that has started, so a whole-year sync stops at the present.
fn last_started_month(year: i32, today: NaiveDate) -> u32 {
    use chrono::Datelike;
    match year.cmp(&today.year()) {
        std::cmp::Ordering::Less => 12,
        std::cmp::Ordering::Equal => today.month(),
        std::cmp::Ordering::Greater => 0,
    }
}

const MONTH_NAMES: [&str; 12] = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

#[allow(clippy::too_many_arguments)]
async fn write_submission(
    state: &AppState,
    coop: &cooperative::Model,
    run: &mambu_sync_run::Model,
    year: i32,
    period_value: &str,
    as_of: NaiveDate,
    approximate: bool,
    result: &NfParseResult,
    ledgers: &[(i16, mapper::LedgerResult)],
    coa: &HashMap<i32, chart_of_account::Model>,
    actor: &Arc<Claims>,
) -> AppResult<Uuid> {
    let metadata = serde_json::json!({
        "source": "mambu",
        "sync_run_id": run.id,
        "triggered_by": trigger_of(actor),
        "as_of": as_of.to_string(),
        "lists_as_at_sync_time": approximate,
    });
    let submission_id = {
        let created_by = Uuid::parse_str(&actor.sub).ok();
        let mut model = submission::ActiveModel {
            id: Set(Uuid::new_v4()),
            reference: Set(None),
            cooperative_id: Set(coop.id),
            reporting_year: Set(year),
            period_type: Set(PeriodType::Monthly),
            period_value: Set(period_value.to_string()),
            fiscal_start_month: Set(1),
            status: Set(draft_status()),
            current_tier: Set(review_tier()),
            submitted_by: Set(created_by),
            submitted_at: Set(None),
            last_reviewed_by: Set(None),
            last_reviewed_at: Set(None),
            rejection_reason: Set(None),
            priority: Set("Routine".to_string()),
            metadata: Set(metadata),
            submission_method: Set(SUBMISSION_METHOD.to_string()),
            created_at: Set(Utc::now()),
            updated_at: Set(Utc::now()),
            created_by_role: Set(created_by_role()),
            created_by_user_id: Set(created_by),
            created_by_name: Set(actor
                .name
                .clone()
                .or_else(|| actor.preferred_username.clone())),
            edited_by: Set(None),
            edited_by_name: Set(None),
        };
        let mut attempts = 0;
        let created = loop {
            let seq = state.submission_repo.next_reference_seq(year).await?;
            model.reference = Set(Some(format!("SUB-{year}-{seq:05}")));
            match state.submission_repo.create(model.clone()).await {
                Ok(s) => break s,
                Err(e) if attempts < 3 => {
                    attempts += 1;
                    tracing::warn!(error = %e, "Submission reference collision, retrying");
                }
                Err(e) => return Err(e),
            }
        };
        let sections = crate::repositories::submission_section::SubmissionSectionRepository::new_section_models(
            created.id,
            SUBMISSION_METHOD,
        );
        state.section_repo.create_many(sections).await?;
        created.id
    };

    persist_nf_parse_result(state, coop.id, submission_id, None, result).await?;

    let now = Utc::now();
    let statement = state
        .financial_statement_repo
        .create(financial_statement::ActiveModel {
            id: Set(Uuid::new_v4()),
            submission_id: Set(submission_id),
            cooperative_id: Set(coop.id),
            reporting_year: Set(year),
            accounting_year: Set(coop.accounting_year.clone()),
            currency: Set(Currency::Szl),
            is_validated: Set(false),
            validation_errors: Set(None),
            created_at: Set(now),
            updated_at: Set(now),
        })
        .await?;
    for (month, ledger) in ledgers {
        for line in &totals::with_totals(&ledger.lines, coa) {
            let Some(account) = coa.get(&line.account_code) else {
                continue;
            };
            state
                .line_item_repo
                .create(balance_sheet_line_item::ActiveModel {
                    id: Set(Uuid::new_v4()),
                    financial_statement_id: Set(statement.id),
                    account_code: Set(Some(line.account_code)),
                    account_name: Set(account.account_name.clone()),
                    account_category: Set(account.account_category.clone()),
                    account_subcategory: Set(account
                        .account_subcategory
                        .clone()
                        .unwrap_or_default()),
                    month: Set(*month),
                    value: Set(Some(line.value)),
                    ai_confidence: Set(None),
                    ai_flagged: Set(false),
                    manually_edited: Set(false),
                    raw_label: Set(Some("mambu".to_string())),
                    created_at: Set(now),
                    updated_at: Set(now),
                })
                .await?;
        }
    }

    {
        let coop_type = coop
            .institution_type
            .as_ref()
            .map(|t| t.as_str().to_string())
            .unwrap_or_else(|| "sacco".to_string());
        let all_accounts: Vec<chart_of_account::Model> = coa.values().cloned().collect();
        let detector = crate::services::abnormality_detector::AbnormalityDetector::new(
            state.line_item_repo.clone(),
            state.flag_repo.clone(),
            state.coa_repo.clone(),
        );
        match detector
            .run(
                submission_id,
                coop.id,
                statement.id,
                &all_accounts,
                &coop_type,
            )
            .await
        {
            Ok((errors, warnings)) => {
                let validated = errors.is_empty();
                let json = serde_json::json!({"errors": errors, "warnings": warnings});
                if let Err(e) = state
                    .financial_statement_repo
                    .set_validation_errors(statement.id, json, validated)
                    .await
                {
                    tracing::error!(error = %e, "Could not save validation result after Mambu sync");
                }
            }
            Err(e) => {
                tracing::error!(error = %e, "Validation failed after Mambu sync");
            }
        }
    }

    for section in state.section_repo.ensure_all(submission_id).await? {
        state
            .section_repo
            .update_status(section.id, "ready")
            .await?;
    }

    state
        .submission_repo
        .update_status(submission_id, draft_status(), review_tier())
        .await?;
    state
        .review_repo
        .create(submission_review::ActiveModel {
            id: Set(Uuid::new_v4()),
            submission_id: Set(submission_id),
            tier: Set(review_tier()),
            reviewer_id: Set(Uuid::parse_str(&actor.sub).ok()),
            action: Set(ReviewAction::Comment),
            comment: Set(Some(review_comment(
                as_of,
                Utc::now().date_naive(),
                trigger_of(actor),
            ))),
            target_tier: Set(None),
            created_at: Set(Utc::now()),
        })
        .await?;

    let workflow = SubmissionWorkflow::new(
        state.submission_repo.clone(),
        state.review_repo.clone(),
        state.flag_repo.clone(),
        state.section_repo.clone(),
        state.financial_statement_repo.clone(),
        state.line_item_repo.clone(),
        state.kpi_record_repo.clone(),
        state.db.clone(),
    );
    if let Err(e) = workflow
        .compute_and_save_kpis(submission_id, coop.id, year)
        .await
    {
        tracing::error!(submission_id = %submission_id, error = %e, "KPI computation failed after Mambu sync");
    }

    if let Err(e) = state
        .audit
        .log(
            actor,
            "MAMBU_SYNC",
            "submission",
            Some(&submission_id.to_string()),
            Some(serde_json::json!({
                "sync_run_id": run.id,
                "members": result.members.len(),
                "savings_accounts": result.savings_accounts.len(),
                "loans": result.loans.len(),
                "fixed_deposits": result.fixed_deposits.len(),
                "ledger_lines": ledgers.iter().map(|(_, l)| l.lines.len()).sum::<usize>(),
            })),
            None,
            None,
        )
        .await
    {
        tracing::error!(error = %e, "Failed to log audit for Mambu sync");
    }
    Ok(submission_id)
}

/// Records what a SACCO's sync is doing now. A failure to record it never stops the sync.
async fn set_phase(state: &AppState, item_id: Uuid, phase: &str, read: u64, total: u64) {
    let clamp = |n: u64| i32::try_from(n).unwrap_or(i32::MAX);
    if let Err(e) = state
        .mambu_repo
        .set_item_progress(item_id, phase, clamp(read), clamp(total))
        .await
    {
        tracing::debug!(error = %e, "Could not record the sync progress");
    }
}

/// Writes the number of deposit accounts read so far every few seconds, so a long read
/// shows progress. Stopped by the caller when the read is done.
fn spawn_progress_reporter(
    state: AppState,
    item_id: Uuid,
    progress: Arc<ReadProgress>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        loop {
            set_phase(
                &state,
                item_id,
                PHASE_READING_DEPOSITS,
                progress.read(),
                progress.total(),
            )
            .await;
            tokio::time::sleep(PROGRESS_EVERY).await;
        }
    })
}

#[cfg(test)]
mod import_guard_tests {
    use super::*;
    use crate::services::mambu::models::{ReportAmounts, ReportGlAccount, ReportItem};

    fn item(opening: f64, debits: f64, credits: f64, closing: f64) -> ReportItem {
        ReportItem {
            gl_account: ReportGlAccount::default(),
            amounts: ReportAmounts {
                opening_balance: opening,
                debits,
                credits,
                closing_balance: closing,
            },
        }
    }

    #[test]
    fn a_year_without_any_ledger_value_has_no_data() {
        assert!(!has_ledger_data(&[]));
        assert!(!has_ledger_data(&[(1, vec![])]));
        assert!(!has_ledger_data(&[(1, vec![item(0.0, 0.0, 0.0, 0.0)])]));
    }

    #[test]
    fn a_balance_or_a_movement_counts_as_data() {
        assert!(has_ledger_data(&[(1, vec![item(5.0, 0.0, 0.0, 5.0)])]));
        assert!(has_ledger_data(&[
            (1, vec![]),
            (2, vec![item(0.0, 3.0, 0.0, 0.0)])
        ]));
    }
}
