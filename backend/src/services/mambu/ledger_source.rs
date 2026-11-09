//! Chooses where the ledger of a SACCO comes from.
//!
//! The Mambu general ledger (journal entries) is read first: it always balances. When it
//! cannot be read, the monthly accounting reports are used, which for older periods may
//! not balance; the caller then leaves such months empty and says so.

use chrono::{Datelike, Duration, NaiveDate, Utc};
use rust_decimal::Decimal;
use sea_orm::Set;

use crate::entities::mambu_ledger_month;
use crate::error::AppResult;
use crate::repositories::MambuRepository;
use crate::services::mambu::client::MambuApiClient;
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

pub async fn load_ledger(
    client: &MambuApiClient,
    repo: &MambuRepository,
    branch_id: &str,
    year: i32,
    months: &[u32],
    whole_year: bool,
    as_of: NaiveDate,
) -> AppResult<LedgerInput> {
    let last = months.iter().copied().max().unwrap_or(1);
    let until = month_end(year, last).unwrap_or(as_of);
    match journal_totals(client, repo, branch_id, until).await {
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

/// A month that ended this many days ago is taken as closed: nothing is booked into it
/// any more, so what was read once is kept and not read again.
const CLOSED_AFTER_DAYS: i64 = 45;

fn first_of_month(date: NaiveDate) -> NaiveDate {
    NaiveDate::from_ymd_opt(date.year(), date.month(), 1).unwrap_or(date)
}

fn end_of_year(date: NaiveDate) -> NaiveDate {
    NaiveDate::from_ymd_opt(date.year(), 12, 31).unwrap_or(date)
}

/// The general ledger of a branch up to `until`. Closed months come from the cache; the
/// rest is read from Mambu. Months read for the first time are kept a year at a time, so
/// a failure part-way does not lose what was already read.
async fn journal_totals(
    client: &MambuApiClient,
    repo: &MambuRepository,
    branch_id: &str,
    until: NaiveDate,
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

    let closed_end = first_of_month(Utc::now().date_naive() - Duration::days(CLOSED_AFTER_DAYS))
        - Duration::days(1);
    let keep_until = closed_end.min(until);
    while covered_through < keep_until {
        let from = covered_through + Duration::days(1);
        let to = end_of_year(from).min(keep_until);
        let mut part = JournalTotals::default();
        journal::read_range(client, &branch_key, from, to, &mut part).await?;
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
    let closed_end = first_of_month(Utc::now().date_naive() - Duration::days(CLOSED_AFTER_DAYS))
        - Duration::days(1);
    journal_totals(client, repo, branch_id, closed_end).await?;
    tracing::info!(branch = %branch_id, through = %closed_end, "Mambu ledger cache is warm");
    Ok(())
}
