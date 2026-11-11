//! Chooses where the ledger of a SACCO comes from.
//!
//! The Mambu general ledger (journal entries) is read first: it always balances. When it
//! cannot be read, the monthly accounting reports are used, which for older periods may
//! not balance; the caller then leaves such months empty and says so.

use chrono::{Datelike, Duration, NaiveDate, Utc};
use rust_decimal::Decimal;
use sea_orm::Set;

use crate::entities::mambu_ledger_month;
use tokio::task::JoinSet;

use crate::error::{AppError, AppResult};
use crate::repositories::MambuRepository;
use crate::services::mambu::client::{MambuApiClient, ReadProgress};
use crate::services::mambu::journal::{self, CachedMonth, JournalTotals};
use crate::services::mambu::mapper::{self, month_end};
use crate::services::mambu::models::ReportItem;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LedgerSource {
    Journal,
    Reports,
}

pub struct LedgerInput {
    pub source: LedgerSource,
    /// Report-shaped items for each month asked for.
    pub months: Vec<(u32, Vec<ReportItem>)>,
    /// Months for which no ledger could be read at all.
    pub failed_months: Vec<u32>,
    /// All earnings at the end of the previous year, when they can be trusted.
    pub year_start_earnings: Option<Decimal>,
}

#[allow(clippy::too_many_arguments)]
pub async fn load_ledger(
    client: &MambuApiClient,
    repo: &MambuRepository,
    branch_id: &str,
    year: i32,
    months: &[u32],
    whole_year: bool,
    as_of: NaiveDate,
    progress: Option<&ReadProgress>,
) -> AppResult<LedgerInput> {
    let last = months.iter().copied().max().unwrap_or(1);
    let until = month_end(year, last).unwrap_or(as_of);
    match journal_totals(client, repo, branch_id, until, progress).await {
        Ok(totals) if !totals.is_empty() => {
            let items = months
                .iter()
                .map(|&m| (m, totals.report_items(year, m)))
                .collect();
            let year_start_earnings =
                mapper::earnings_of_report(&totals.report_items(year - 1, 12));
            return Ok(LedgerInput {
                source: LedgerSource::Journal,
                months: items,
                failed_months: Vec::new(),
                year_start_earnings,
            });
        }
        Ok(_) => {
            tracing::warn!(branch = %branch_id, "Mambu journal is empty, the accounting reports are used");
        }
        Err(e) => {
            tracing::warn!(branch = %branch_id, error = %e, "Mambu journal not readable, the accounting reports are used");
        }
    }
    from_reports(client, branch_id, year, months, whole_year, as_of).await
}

/// The monthly accounting reports, read one at a time: Mambu refuses a new report while
/// it is still building another. The report of the previous year end only splits the
/// surplus, so it comes last and its failure is not an error.
async fn from_reports(
    client: &MambuApiClient,
    branch_id: &str,
    year: i32,
    months: &[u32],
    whole_year: bool,
    as_of: NaiveDate,
) -> AppResult<LedgerInput> {
    let mut items: Vec<(u32, Vec<ReportItem>)> = Vec::new();
    let mut failed_months: Vec<u32> = Vec::new();
    for &m in months {
        let start = NaiveDate::from_ymd_opt(year, m, 1).unwrap_or(as_of);
        let end = month_end(year, m).unwrap_or(as_of);
        match client.accounting_report(branch_id, start, end).await {
            Ok(report) => items.push((m, report.items)),
            Err(e) if whole_year => {
                tracing::warn!(branch = %branch_id, month = m, error = %e, "Mambu report not available for a month");
                failed_months.push(m);
            }
            Err(e) => return Err(e),
        }
    }
    Ok(LedgerInput {
        source: LedgerSource::Reports,
        months: items,
        failed_months,
        year_start_earnings: prior_year_end_earnings(client, branch_id, year).await,
    })
}

async fn prior_year_end_earnings(
    client: &MambuApiClient,
    branch_id: &str,
    year: i32,
) -> Option<Decimal> {
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

/// Months of the general ledger read at the same time.
const MONTHS_AT_ONCE: usize = 3;

/// A month that ended this many days ago is taken as closed: nothing is booked into it
/// any more, so what was read once is kept and not read again.
const CLOSED_AFTER_DAYS: i64 = 45;

/// The last day of the newest month that is taken as closed, as seen from `today`.
fn last_closed_day(today: NaiveDate) -> NaiveDate {
    first_of_month(today - Duration::days(CLOSED_AFTER_DAYS)) - Duration::days(1)
}

/// True when every closed month of a branch is already in the cache.
pub async fn cache_is_current(repo: &MambuRepository, branch_id: &str) -> bool {
    match repo.ledger_cached_through(branch_id).await {
        Ok(Some(through)) => through >= last_closed_day(Utc::now().date_naive()),
        _ => false,
    }
}

fn first_of_month(date: NaiveDate) -> NaiveDate {
    NaiveDate::from_ymd_opt(date.year(), date.month(), 1).unwrap_or(date)
}

fn end_of_month(date: NaiveDate) -> NaiveDate {
    let next = if date.month() == 12 {
        NaiveDate::from_ymd_opt(date.year() + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(date.year(), date.month() + 1, 1)
    };
    next.map(|n| n - Duration::days(1)).unwrap_or(date)
}

/// The general ledger of a branch up to `until`. Closed months come from the cache; the
/// rest is read from Mambu. Months read for the first time are kept a year at a time, so
/// a failure part-way does not lose what was already read.
async fn journal_totals(
    client: &MambuApiClient,
    repo: &MambuRepository,
    branch_id: &str,
    until: NaiveDate,
    progress: Option<&ReadProgress>,
) -> AppResult<JournalTotals> {
    let branch_key = client.branch_key(branch_id).await?;
    let (y, m, d) = journal::JOURNAL_START;
    let mut covered_through = NaiveDate::from_ymd_opt(y, m, d).unwrap_or(until) - Duration::days(1);
    let mut totals = JournalTotals::default();
    match repo.ledger_cache(branch_id).await {
        Ok(Some((through, rows))) => {
            for row in rows {
                totals.add_cached(CachedMonth {
                    month_start: row.month_start,
                    gl_code: row.gl_code,
                    account_type: row.account_type,
                    name: row.account_name,
                    debit: row.debit,
                    credit: row.credit,
                });
            }
            covered_through = through;
        }
        Ok(None) => {}
        Err(e) => {
            tracing::warn!(branch = %branch_id, error = %e, "Mambu ledger cache not readable, the journal is read in full");
        }
    }

    let closed_end = last_closed_day(Utc::now().date_naive());
    let keep_until = closed_end.min(until);
    // The months still to be read, so a first sync of a SACCO with a long history shows
    // how far it has come. Each month is kept as soon as it is read, so a sync that is
    // stopped or restarted loses at most the month it was on.
    if let Some(progress) = progress {
        let mut ahead = covered_through;
        let mut months = 0;
        while ahead < keep_until {
            ahead = end_of_month(ahead + Duration::days(1)).min(keep_until);
            months += 1;
        }
        progress.set_total(months);
    }
    while covered_through < keep_until {
        // A few months are read at the same time: the small months are mostly waiting for
        // Mambu, so they overlap well, and the shared limit on requests in flight keeps
        // the big ones from asking for more than Mambu serves quickly.
        let mut plan: Vec<(NaiveDate, NaiveDate)> = Vec::new();
        let mut ahead = covered_through;
        while plan.len() < MONTHS_AT_ONCE && ahead < keep_until {
            let from = ahead + Duration::days(1);
            let to = end_of_month(from).min(keep_until);
            plan.push((from, to));
            ahead = to;
        }
        let mut reads: JoinSet<AppResult<(NaiveDate, NaiveDate, JournalTotals)>> = JoinSet::new();
        for (from, to) in plan {
            let client = client.clone();
            let key = branch_key.clone();
            reads.spawn(async move {
                let mut part = JournalTotals::default();
                journal::read_range(&client, &key, from, to, &mut part).await?;
                Ok((from, to, part))
            });
        }
        let mut done = Vec::new();
        while let Some(read) = reads.join_next().await {
            done.push(read.map_err(|e| {
                tracing::warn!(error = %e, "Mambu journal month task failed");
                AppError::InternalServerError("Could not read the Mambu journal".into())
            })??);
        }
        // Kept in date order: the cache is complete up to the last month saved.
        done.sort_by_key(|(from, _, _)| *from);
        for (from, to, part) in done {
            let rows = part.cached_months(from, to);
            let saved = repo
                .save_ledger_cache(branch_id, to, to_models(branch_id, &rows))
                .await;
            if let Err(e) = saved {
                tracing::warn!(branch = %branch_id, error = %e, "Mambu ledger cache not saved");
            }
            for row in rows {
                totals.add_cached(row);
            }
            covered_through = to;
            if let Some(progress) = progress {
                progress.add_read(1);
            }
        }
    }
    if covered_through < until {
        journal::read_range(
            client,
            &branch_key,
            covered_through + Duration::days(1),
            until,
            &mut totals,
        )
        .await?;
    }
    Ok(totals)
}

fn to_models(branch_id: &str, rows: &[CachedMonth]) -> Vec<mambu_ledger_month::ActiveModel> {
    rows.iter()
        .map(|r| mambu_ledger_month::ActiveModel {
            mambu_branch_id: Set(branch_id.to_string()),
            month_start: Set(r.month_start),
            gl_code: Set(r.gl_code.clone()),
            account_type: Set(r.account_type.clone()),
            account_name: Set(r.name.clone()),
            debit: Set(r.debit),
            credit: Set(r.credit),
        })
        .collect()
}

/// Reads the closed months of a branch into the cache, so the first sync of a newly
/// linked SACCO does not have to. Only closed months are kept, nothing else is read.
pub async fn warm_cache(
    client: &MambuApiClient,
    repo: &MambuRepository,
    branch_id: &str,
) -> AppResult<()> {
    let closed_end = last_closed_day(Utc::now().date_naive());
    journal_totals(client, repo, branch_id, closed_end, None).await?;
    tracing::info!(branch = %branch_id, through = %closed_end, "Mambu ledger cache is warm");
    Ok(())
}
