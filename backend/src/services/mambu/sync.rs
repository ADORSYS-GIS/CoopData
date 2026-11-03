use std::collections::{HashMap, HashSet};
use std::sync::Arc;

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
use crate::services::mambu::client::MambuApiClient;
use crate::services::mambu::mapper::{
    self, branch_region, classify_deposit, map_fixed_deposit, map_ledger, map_loan, map_member,
    map_savings, month_end, share_balance_for, DropReason, KIND_FIXED_DEPOSIT, KIND_IGNORE,
    KIND_SHARE,
};
use crate::services::mambu::models::MambuBranch;
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

/// Syncs that may run at the same time. More requests wait, so Mambu is not flooded.
pub const MAX_CONCURRENT_RUNS: usize = 3;

/// A cooperative or apex cannot start a new sync for the same SACCO sooner than this.
pub const COOLDOWN_MINUTES: i64 = 5;

/// Who asked for the sync. It decides where the result lands in the review workflow.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SyncLevel {
    /// Bulk sync of all SACCOs. The result waits for the Ministry review.
    Ministry,
    /// Sync of the cooperatives of one apex. The result is a draft at the apex.
    Apex,
    /// Sync of one SACCO. The result is a draft the SACCO checks and submits.
    Cooperative,
}

impl SyncLevel {
    fn created_by_role(self) -> SubmissionCreatedByRole {
        match self {
            Self::Ministry => SubmissionCreatedByRole::Ministry,
            Self::Apex => SubmissionCreatedByRole::Apex,
            Self::Cooperative => SubmissionCreatedByRole::Cooperative,
        }
    }

    fn tier(self) -> ReviewTier {
        match self {
            Self::Ministry => ReviewTier::Ministry,
            Self::Apex => ReviewTier::Apex,
            Self::Cooperative => ReviewTier::Cooperative,
        }
    }

    fn status(self) -> SubmissionStatus {
        match self {
            Self::Ministry => SubmissionStatus::InReview,
            Self::Apex | Self::Cooperative => SubmissionStatus::Draft,
        }
    }

    fn enforces_cooldown(self) -> bool {
        self != Self::Ministry
    }

    fn may_replace(self, status: &SubmissionStatus) -> bool {
        match self {
            Self::Ministry => {
                matches!(status, SubmissionStatus::Draft | SubmissionStatus::InReview)
            }
            Self::Apex | Self::Cooperative => matches!(status, SubmissionStatus::Draft),
        }
    }

    fn review_comment(self, as_of: NaiveDate) -> String {
        match self {
            Self::Ministry => format!("Imported from Mambu for {as_of}. Review before approving."),
            Self::Apex | Self::Cooperative => {
                format!("Imported from Mambu for {as_of}. Check the numbers, then submit.")
            }
        }
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
    level: SyncLevel,
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
            match level {
                SyncLevel::Ministry => {
                    "No SACCO is linked to a Mambu branch yet. Link at least one SACCO first."
                }
                SyncLevel::Apex => {
                    "None of your cooperatives is linked to a Mambu branch yet. Link them first."
                }
                SyncLevel::Cooperative => {
                    "This cooperative is not linked to a Mambu branch yet. Ask your apex to link it."
                }
            }
            .into(),
        ));
    }

    let busy = state
        .mambu_repo
        .pending_cooperative_ids(active_runs.iter().map(|r| r.id).collect())
        .await?;
    let recent: HashSet<Uuid> = if level.enforces_cooldown() {
        state
            .mambu_repo
            .last_sync_starts(
                links.iter().map(|l| l.cooperative_id).collect(),
                Utc::now() - chrono::Duration::minutes(COOLDOWN_MINUTES),
            )
            .await?
            .into_keys()
            .collect()
    } else {
        HashSet::new()
    };
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
        execute_run(task_state, client, task_run, items, links, actor, level).await;
    });
    Ok(run)
}

async fn execute_run(
    state: AppState,
    client: Arc<MambuApiClient>,
    run: mambu_sync_run::Model,
    items: Vec<mambu_sync_item::Model>,
    links: Vec<mambu_branch_link::Model>,
    actor: Arc<Claims>,
    level: SyncLevel,
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

    let year = run.reporting_year;
    let month = run.month as u32;
    for (mut item, link) in items.into_iter().zip(links) {
        let result = sync_one(
            &state, &client, &refs, &run, &link, year, month, &actor, level,
        )
        .await;
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
        coa,
    })
}

fn tally(counts: &mut HashMap<&'static str, usize>, reason: DropReason) {
    *counts.entry(reason.code()).or_default() += 1;
}

#[allow(clippy::too_many_arguments)]
async fn sync_one(
    state: &AppState,
    client: &MambuApiClient,
    refs: &ReferenceData,
    run: &mambu_sync_run::Model,
    link: &mambu_branch_link::Model,
    year: i32,
    month: u32,
    actor: &Arc<Claims>,
    level: SyncLevel,
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

    let existing = state
        .submission_repo
        .find_by_cooperative_and_period(coop.id, year, PeriodType::Monthly, &period_value)
        .await?;
    match &existing {
        Some(s) if s.submission_method != SUBMISSION_METHOD => {
            return Ok(Outcome::Skipped(format!(
                "A submission for this period already exists ({} method). It was not changed.",
                s.submission_method
            )))
        }
        Some(s) if !level.may_replace(&s.status) => {
            return Ok(Outcome::Skipped(format!(
                "The submission for this period is already {}. It was not changed.",
                s.status.as_str().replace('_', " ")
            )))
        }
        Some(_) => {}
        None => {
            let year_submissions = state
                .submission_repo
                .find_all_by_cooperative_and_year(coop.id, year)
                .await?;
            if let Err(reason) = crate::services::period_rules::check_frequency(
                &year_submissions,
                PeriodType::Monthly,
                None,
            )
            .and_then(|_| {
                crate::services::period_rules::check_period_overlap(
                    &year_submissions,
                    PeriodType::Monthly,
                    &period_value,
                    None,
                )
            }) {
                return Ok(Outcome::Skipped(reason));
            }
        }
    }

    let clients = client.clients(&link.mambu_branch_id).await?;
    let deposits = client.deposits(&link.mambu_branch_id).await?;
    let loans = client.loans(&link.mambu_branch_id).await?;
    // The month reports are essential and are read first, one at a time: Mambu refuses a
    // new report while it is still building another. The report of the previous year end
    // only splits the surplus, so it comes last and its failure is not an error.
    let mut reports: Vec<(u32, crate::services::mambu::models::MambuReport)> = Vec::new();
    let mut unreliable_months: Vec<u32> = Vec::new();
    for &m in &months {
        let start = NaiveDate::from_ymd_opt(year, m, 1).unwrap_or(as_of);
        let end = month_end(year, m).unwrap_or(as_of);
        match client
            .accounting_report(&link.mambu_branch_id, start, end)
            .await
        {
            Ok(report) => reports.push((m, report)),
            Err(e) if whole_year => {
                tracing::warn!(branch = %link.mambu_branch_id, month = m, error = %e, "Mambu report not available for a month");
                unreliable_months.push(m);
            }
            Err(e) => return Err(e),
        }
    }
    let year_start_earnings = prior_year_end_earnings(client, &link.mambu_branch_id, year).await;
    let mut ledgers: Vec<(i16, mapper::LedgerResult)> = Vec::new();
    for (m, report) in &reports {
        let ledger = map_ledger(&report.items, year_start_earnings, &refs.account_mappings);
        let summary = mapper::summarize_earnings(&report.items);
        tracing::info!(
            branch = %link.mambu_branch_id,
            month = m,
            items = report.items.len(),
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

    for c in &clients {
        match map_member(c, fallback_region.clone(), as_of) {
            Ok(record) => {
                holder_codes.insert(c.encoded_key.clone(), record.member_id.clone());
                member_index.insert(record.member_id.clone(), result.members.len());
                result.members.push(record);
            }
            Err(reason) => tally(&mut drops, reason),
        }
    }

    let mut fd_defaulted = 0usize;
    let mut ignored_deposits = 0usize;
    for d in &deposits {
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
            Ok(record) => result.loans.push(record),
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

    let submission_id = write_submission(
        state,
        &coop,
        run,
        existing,
        year,
        &period_value,
        as_of,
        approximate,
        &result,
        &ledgers,
        &refs.coa,
        actor,
        level,
    )
    .await?;

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

/// All earnings at the end of the previous year, from a report that balances. Used to
/// split the surplus; a failure only means the split is not done.
async fn prior_year_end_earnings(
    client: &MambuApiClient,
    branch_id: &str,
    year: i32,
) -> Option<rust_decimal::Decimal> {
    let start = NaiveDate::from_ymd_opt(year - 1, 12, 1)?;
    let end = NaiveDate::from_ymd_opt(year - 1, 12, 31)?;
    match client.accounting_report(branch_id, start, end).await {
        Ok(report) => mapper::earnings_of_report(&report.items),
        Err(e) => {
            tracing::warn!(branch = %branch_id, error = %e, "Mambu previous year end report not available");
            None
        }
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
    existing: Option<submission::Model>,
    year: i32,
    period_value: &str,
    as_of: NaiveDate,
    approximate: bool,
    result: &NfParseResult,
    ledgers: &[(i16, mapper::LedgerResult)],
    coa: &HashMap<i32, chart_of_account::Model>,
    actor: &Arc<Claims>,
    level: SyncLevel,
) -> AppResult<Uuid> {
    let metadata = serde_json::json!({
        "source": "mambu",
        "sync_run_id": run.id,
        "triggered_by": format!("{level:?}").to_lowercase(),
        "as_of": as_of.to_string(),
        "lists_as_at_sync_time": approximate,
    });
    let submission_id = match existing {
        Some(sub) => {
            state
                .submission_repo
                .update_metadata(sub.id, metadata)
                .await?;
            sub.id
        }
        None => {
            let created_by = Uuid::parse_str(&actor.sub).ok();
            let mut model = submission::ActiveModel {
                id: Set(Uuid::new_v4()),
                reference: Set(None),
                cooperative_id: Set(coop.id),
                reporting_year: Set(year),
                period_type: Set(PeriodType::Monthly),
                period_value: Set(period_value.to_string()),
                fiscal_start_month: Set(1),
                status: Set(level.status()),
                current_tier: Set(level.tier()),
                submitted_by: Set(match level {
                    SyncLevel::Ministry => None,
                    _ => created_by,
                }),
                submitted_at: Set(match level {
                    SyncLevel::Ministry => Some(Utc::now()),
                    _ => None,
                }),
                last_reviewed_by: Set(None),
                last_reviewed_at: Set(None),
                rejection_reason: Set(None),
                priority: Set("Routine".to_string()),
                metadata: Set(metadata),
                submission_method: Set(SUBMISSION_METHOD.to_string()),
                created_at: Set(Utc::now()),
                updated_at: Set(Utc::now()),
                created_by_role: Set(level.created_by_role()),
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
        }
    };

    persist_nf_parse_result(state, coop.id, submission_id, None, result).await?;

    if let Some(old) = state
        .financial_statement_repo
        .find_by_submission(submission_id)
        .await?
    {
        state.financial_statement_repo.delete(old.id).await?;
    }
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
        for line in &ledger.lines {
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
        .update_status(submission_id, level.status(), level.tier())
        .await?;
    state
        .review_repo
        .create(submission_review::ActiveModel {
            id: Set(Uuid::new_v4()),
            submission_id: Set(submission_id),
            tier: Set(level.tier()),
            reviewer_id: Set(Uuid::parse_str(&actor.sub).ok()),
            action: Set(ReviewAction::Comment),
            comment: Set(Some(level.review_comment(as_of))),
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
