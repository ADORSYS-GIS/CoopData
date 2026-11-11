//! Rebuilds the ledger of one branch from the Mambu general ledger (journal entries).
//!
//! Mambu's accounting report does not balance for older periods, but the journal of a
//! branch always does: every booking is a debit and a credit of the same amount. Adding
//! the lines up gives the balance of every account at every month end, in the same shape
//! as a report, so the report mapping is reused unchanged.

use std::collections::{BTreeMap, HashMap, HashSet};

use chrono::{Datelike, Duration, NaiveDate};
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use tokio::task::JoinSet;

use crate::error::{AppError, AppResult};
use crate::services::mambu::client::MambuApiClient;
use crate::services::mambu::mapper::to_decimal;
use crate::services::mambu::models::{
    MambuJournalEntry, ReportAmounts, ReportGlAccount, ReportItem,
};

const JOURNAL_PAGE: u32 = 1000;
/// A date range with more lines than this is split in two before it is paged, so deep
/// offsets are never needed.
const SPLIT_ABOVE: u64 = 30_000;
pub const JOURNAL_START: (i32, u32, u32) = (2015, 1, 1);
const LEDGER_CURRENCY: &str = "SZL";

#[derive(Debug, Clone)]
struct AccountInfo {
    account_type: String,
    name: Option<String>,
}

/// One account in one month, as it is kept between syncs.
#[derive(Debug, Clone)]
pub struct CachedMonth {
    pub month_start: NaiveDate,
    pub gl_code: String,
    pub account_type: String,
    pub name: Option<String>,
    pub debit: Decimal,
    pub credit: Decimal,
}

#[derive(Debug, Clone, Copy, Default)]
struct Movement {
    debit: Decimal,
    credit: Decimal,
}

/// Debits and credits per account and month of one branch.
#[derive(Debug, Default)]
pub struct JournalTotals {
    months: BTreeMap<(i32, u32), HashMap<String, Movement>>,
    accounts: HashMap<String, AccountInfo>,
    pub entries: usize,
}

fn is_debit_normal(account_type: &str) -> bool {
    matches!(account_type, "ASSET" | "EXPENSE")
}

fn booking_month(entry: &MambuJournalEntry) -> Option<(i32, u32)> {
    let date = entry.booking_date.as_deref()?.trim().get(..10)?;
    let date = NaiveDate::parse_from_str(date, "%Y-%m-%d").ok()?;
    Some((date.year(), date.month()))
}

impl JournalTotals {
    /// Adds one line. Lines in another currency are left out, like in a report.
    /// Returns false when the line cannot be placed in a month.
    pub fn add(&mut self, entry: &MambuJournalEntry) -> bool {
        let currency = entry
            .gl_account
            .currency
            .as_ref()
            .and_then(|c| c.currency_code.as_deref());
        if matches!(currency, Some(c) if c != LEDGER_CURRENCY) {
            return true;
        }
        let Some(month) = booking_month(entry) else {
            return false;
        };
        let amount = to_decimal(entry.amount);
        let code = entry.gl_account.gl_code.clone();
        self.accounts
            .entry(code.clone())
            .or_insert_with(|| AccountInfo {
                account_type: entry.gl_account.account_type.clone(),
                name: entry.gl_account.name.clone(),
            });
        let movement = self
            .months
            .entry(month)
            .or_default()
            .entry(code)
            .or_default();
        match entry.entry_type.as_str() {
            "DEBIT" => movement.debit += amount,
            "CREDIT" => movement.credit += amount,
            _ => return false,
        }
        self.entries += 1;
        true
    }

    pub fn is_empty(&self) -> bool {
        self.months.is_empty()
    }

    /// Adds a month that was added up before and kept.
    pub fn add_cached(&mut self, row: CachedMonth) {
        let month = (row.month_start.year(), row.month_start.month());
        self.accounts
            .entry(row.gl_code.clone())
            .or_insert_with(|| AccountInfo {
                account_type: row.account_type.clone(),
                name: row.name.clone(),
            });
        let movement = self
            .months
            .entry(month)
            .or_default()
            .entry(row.gl_code)
            .or_default();
        movement.debit += row.debit;
        movement.credit += row.credit;
    }

    /// The added-up months from the month of `from` to the month of `to`, to be kept.
    pub fn cached_months(&self, from: NaiveDate, to: NaiveDate) -> Vec<CachedMonth> {
        let first = (from.year(), from.month());
        let last = (to.year(), to.month());
        let mut rows = Vec::new();
        for ((year, month), accounts) in self.months.range(first..=last) {
            let Some(month_start) = NaiveDate::from_ymd_opt(*year, *month, 1) else {
                continue;
            };
            for (code, movement) in accounts {
                let Some(info) = self.accounts.get(code) else {
                    continue;
                };
                rows.push(CachedMonth {
                    month_start,
                    gl_code: code.clone(),
                    account_type: info.account_type.clone(),
                    name: info.name.clone(),
                    debit: movement.debit,
                    credit: movement.credit,
                });
            }
        }
        rows
    }

    /// The report of one month: opening and closing balance and the movement of the
    /// month for every account that has had a booking up to then. Signs are those of the
    /// Mambu balance sheet screen (liabilities, equity and income are positive credits).
    pub fn report_items(&self, year: i32, month: u32) -> Vec<ReportItem> {
        let target = (year, month);
        let mut opening: HashMap<&str, Decimal> = HashMap::new();
        let mut closing: HashMap<&str, Decimal> = HashMap::new();
        let mut month_movement: HashMap<&str, Movement> = HashMap::new();
        for (key, accounts) in self.months.range(..=target) {
            for (code, movement) in accounts {
                let Some(info) = self.accounts.get(code) else {
                    continue;
                };
                let delta = if is_debit_normal(&info.account_type) {
                    movement.debit - movement.credit
                } else {
                    movement.credit - movement.debit
                };
                *closing.entry(code.as_str()).or_default() += delta;
                if *key < target {
                    *opening.entry(code.as_str()).or_default() += delta;
                } else {
                    month_movement.insert(code.as_str(), *movement);
                }
            }
        }
        let number = |d: Decimal| d.to_f64().unwrap_or_default();
        let mut items: Vec<ReportItem> = closing
            .into_iter()
            .filter_map(|(code, close)| {
                let info = self.accounts.get(code)?;
                let movement = month_movement.get(code).copied().unwrap_or_default();
                Some(ReportItem {
                    gl_account: ReportGlAccount {
                        gl_code: code.to_string(),
                        name: info.name.clone(),
                        account_type: info.account_type.clone(),
                        usage: Some("DETAIL".to_string()),
                        currency: None,
                    },
                    amounts: ReportAmounts {
                        opening_balance: number(opening.get(code).copied().unwrap_or_default()),
                        debits: number(movement.debit),
                        credits: number(movement.credit),
                        closing_balance: number(close),
                    },
                })
            })
            .collect();
        items.sort_by(|a, b| a.gl_account.gl_code.cmp(&b.gl_account.gl_code));
        items
    }
}

/// Pages of one date range that are asked for at the same time.
const PARALLEL_PAGES: u64 = 4;

/// The calendar months between two dates (inclusive), the first and last one cut to fit.
fn month_ranges(from: NaiveDate, to: NaiveDate) -> Vec<(NaiveDate, NaiveDate)> {
    let mut months = Vec::new();
    let mut start = from;
    while start <= to {
        let (year, month) = (start.year(), start.month());
        let next = if month == 12 {
            NaiveDate::from_ymd_opt(year + 1, 1, 1)
        } else {
            NaiveDate::from_ymd_opt(year, month + 1, 1)
        };
        let Some(next) = next else { break };
        months.push((start, (next - Duration::days(1)).min(to)));
        start = next;
    }
    months
}

/// Reads the journal lines of a branch between two dates (inclusive) and adds them to
/// `totals`. A range with too many lines is split in two first, and the pages of a range
/// are read a few at a time.
pub async fn read_range(
    client: &MambuApiClient,
    branch_key: &str,
    from: NaiveDate,
    to: NaiveDate,
    totals: &mut JournalTotals,
) -> AppResult<()> {
    read_range_with(client, branch_key, from, to, totals, SPLIT_ABOVE).await
}

async fn read_range_with(
    client: &MambuApiClient,
    branch_key: &str,
    from: NaiveDate,
    to: NaiveDate,
    totals: &mut JournalTotals,
    split_above: u64,
) -> AppResult<()> {
    // Counting a range is cheap for a month (about 1.5 s) but slow for a big range (about
    // 40 s for half a year of a large SACCO, and it can time out), so the range is read
    // month by month and only a month that is still too big is split further.
    let mut ranges = month_ranges(from, to);
    ranges.reverse();
    while let Some((from, to)) = ranges.pop() {
        let count = client.journal_count(branch_key, from, to).await?;
        if count == 0 {
            continue;
        }
        if count > split_above && from < to {
            let middle = from + (to - from) / 2;
            ranges.push((middle + Duration::days(1), to));
            ranges.push((from, middle));
            continue;
        }
        let pages = count.div_ceil(u64::from(JOURNAL_PAGE));
        let spawn = |tasks: &mut JoinSet<AppResult<Vec<MambuJournalEntry>>>, page: u64| {
            let client = client.clone();
            let key = branch_key.to_string();
            let offset = (page * u64::from(JOURNAL_PAGE)) as u32;
            tasks.spawn(async move {
                client
                    .journal_page(&key, from, to, offset, JOURNAL_PAGE)
                    .await
            });
        };
        let mut tasks: JoinSet<AppResult<Vec<MambuJournalEntry>>> = JoinSet::new();
        let mut next_page = 0;
        while next_page < pages.min(PARALLEL_PAGES) {
            spawn(&mut tasks, next_page);
            next_page += 1;
        }
        let mut seen: HashSet<String> = HashSet::new();
        while let Some(finished) = tasks.join_next().await {
            let page = finished.map_err(|e| {
                tracing::warn!(error = %e, "Mambu journal page task failed");
                AppError::InternalServerError("Could not read the Mambu journal".into())
            })??;
            for entry in &page {
                if seen.insert(entry.encoded_key.clone()) && !totals.add(entry) {
                    return Err(AppError::InternalServerError(
                        "Unexpected response from Mambu".into(),
                    ));
                }
            }
            if next_page < pages {
                spawn(&mut tasks, next_page);
                next_page += 1;
            }
        }
        tracing::info!(%from, %to, count, read = seen.len(), "Mambu journal range read");
        if (seen.len() as u64) < count {
            tracing::warn!(%from, %to, count, read = seen.len(), "Mambu journal range incomplete");
            return Err(AppError::InternalServerError(
                "Mambu journal is incomplete".into(),
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::mambu::mapper::{detect_sign_style, SignStyle};
    use axum::extract::Query;
    use axum::routing::{get, post};
    use axum::{Json, Router};
    use serde_json::{json, Value};

    fn entry(
        date: &str,
        kind: &str,
        amount: f64,
        code: &str,
        account_type: &str,
    ) -> MambuJournalEntry {
        MambuJournalEntry {
            encoded_key: format!("{date}-{kind}-{code}-{amount}"),
            entry_type: kind.to_string(),
            amount,
            booking_date: Some(format!("{date}T10:00:00+02:00")),
            gl_account: ReportGlAccount {
                gl_code: code.to_string(),
                name: Some(format!("Account {code}")),
                account_type: account_type.to_string(),
                usage: Some("DETAIL".into()),
                currency: None,
            },
        }
    }

    fn sample() -> Vec<MambuJournalEntry> {
        vec![
            entry("2025-12-10", "DEBIT", 1000.0, "1101", "ASSET"),
            entry("2025-12-10", "CREDIT", 1000.0, "6001", "EQUITY"),
            entry("2026-01-05", "DEBIT", 300.0, "1101", "ASSET"),
            entry("2026-01-05", "CREDIT", 300.0, "4001", "INCOME"),
            entry("2026-02-02", "DEBIT", 50.0, "5101", "EXPENSE"),
            entry("2026-02-02", "CREDIT", 50.0, "1101", "ASSET"),
        ]
    }

    fn totals() -> JournalTotals {
        let mut t = JournalTotals::default();
        for e in sample() {
            assert!(t.add(&e));
        }
        t
    }

    fn closing(items: &[ReportItem], code: &str) -> f64 {
        items
            .iter()
            .find(|i| i.gl_account.gl_code == code)
            .map(|i| i.amounts.closing_balance)
            .unwrap_or_default()
    }

    #[test]
    fn every_month_end_balances_with_the_natural_signs() {
        let t = totals();
        for month in 1..=2 {
            let items = t.report_items(2026, month);
            assert_eq!(detect_sign_style(&items), Ok(SignStyle::Natural));
        }
        let december = t.report_items(2025, 12);
        assert_eq!(detect_sign_style(&december), Ok(SignStyle::Natural));
    }

    #[test]
    fn closing_balances_carry_over_and_movements_stay_in_their_month() {
        let t = totals();
        let jan = t.report_items(2026, 1);
        assert_eq!(closing(&jan, "1101"), 1300.0);
        assert_eq!(closing(&jan, "6001"), 1000.0);
        assert_eq!(closing(&jan, "4001"), 300.0);
        let cash = jan.iter().find(|i| i.gl_account.gl_code == "1101").unwrap();
        assert_eq!(cash.amounts.opening_balance, 1000.0);
        assert_eq!(cash.amounts.debits, 300.0);
        let feb = t.report_items(2026, 2);
        assert_eq!(closing(&feb, "1101"), 1250.0);
        assert_eq!(closing(&feb, "5101"), 50.0);
        let feb_income = feb.iter().find(|i| i.gl_account.gl_code == "4001").unwrap();
        assert_eq!(feb_income.amounts.credits, 0.0);
        assert_eq!(feb_income.amounts.closing_balance, 300.0);
    }

    #[test]
    fn lines_in_another_currency_and_unknown_types_are_handled() {
        let mut t = JournalTotals::default();
        let mut other = entry("2026-01-05", "DEBIT", 5.0, "1101", "ASSET");
        other.gl_account.currency = Some(crate::services::mambu::models::ReportCurrency {
            currency_code: Some("USD".into()),
        });
        assert!(t.add(&other));
        assert_eq!(t.entries, 0);
        assert!(!t.add(&entry("2026-01-05", "ODD", 5.0, "1101", "ASSET")));
        let mut undated = entry("2026-01-05", "DEBIT", 5.0, "1101", "ASSET");
        undated.booking_date = None;
        assert!(!t.add(&undated));
    }

    fn fake() -> Router {
        let lines: Vec<Value> = sample()
            .iter()
            .map(|e| {
                json!({
                    "encodedKey": e.encoded_key, "type": e.entry_type, "amount": e.amount,
                    "bookingDate": e.booking_date,
                    "glAccount": {"glCode": e.gl_account.gl_code, "type": e.gl_account.account_type,
                                  "name": e.gl_account.name, "usage": "DETAIL"}
                })
            })
            .collect();
        Router::new()
            .route(
                "/branches/ES0006",
                get(|| async { Json(json!({"encodedKey": "bk", "id": "ES0006"})) }),
            )
            .route(
                "/gljournalentries:search",
                post(
                    move |Query(q): Query<std::collections::HashMap<String, String>>,
                          Json(body): Json<Value>| {
                        let lines = lines.clone();
                        async move {
                            let between = &body["filterCriteria"][1];
                            let from = between["value"].as_str().unwrap_or("").to_string();
                            let to = between["secondValue"].as_str().unwrap_or("").to_string();
                            let hits: Vec<Value> = lines
                                .into_iter()
                                .filter(|l| {
                                    let d = l["bookingDate"].as_str().unwrap_or("");
                                    &d[..10] >= from.as_str() && &d[..10] <= to.as_str()
                                })
                                .collect();
                            let offset: usize =
                                q.get("offset").and_then(|v| v.parse().ok()).unwrap_or(0);
                            let limit: usize =
                                q.get("limit").and_then(|v| v.parse().ok()).unwrap_or(1000);
                            let total = hits.len();
                            let page: Vec<Value> =
                                hits.into_iter().skip(offset).take(limit).collect();
                            ([("items-total", total.to_string())], Json(page))
                        }
                    },
                ),
            )
    }

    async fn serve(app: Router) -> String {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
        format!("http://{addr}")
    }

    #[test]
    fn a_range_is_cut_into_calendar_months() {
        let d = |y, m, day| NaiveDate::from_ymd_opt(y, m, day).unwrap();

        let months = month_ranges(d(2025, 11, 15), d(2026, 2, 10));

        assert_eq!(
            months,
            vec![
                (d(2025, 11, 15), d(2025, 11, 30)),
                (d(2025, 12, 1), d(2025, 12, 31)),
                (d(2026, 1, 1), d(2026, 1, 31)),
                (d(2026, 2, 1), d(2026, 2, 10)),
            ]
        );
        assert_eq!(month_ranges(d(2024, 2, 1), d(2024, 2, 29)).len(), 1);
        assert!(month_ranges(d(2026, 3, 2), d(2026, 3, 1)).is_empty());
        assert_eq!(month_ranges(d(2015, 1, 1), d(2025, 12, 31)).len(), 132);
    }

    #[tokio::test]
    async fn the_journal_is_read_whole_and_split_when_a_range_is_too_big() {
        let base = serve(fake()).await;
        let client = MambuApiClient::with_api_key(&base, "test", 200);
        let start = NaiveDate::from_ymd_opt(2025, 1, 1).unwrap();
        let until = NaiveDate::from_ymd_opt(2026, 2, 28).unwrap();

        let mut whole = JournalTotals::default();
        read_range_with(&client, "bk", start, until, &mut whole, 1000)
            .await
            .unwrap();
        let mut split = JournalTotals::default();
        read_range_with(&client, "bk", start, until, &mut split, 2)
            .await
            .unwrap();

        assert_eq!(whole.entries, 6);
        assert_eq!(split.entries, 6);
        assert_eq!(closing(&split.report_items(2026, 2), "1101"), 1250.0);
        assert_eq!(
            closing(&whole.report_items(2026, 2), "6001"),
            closing(&split.report_items(2026, 2), "6001")
        );
    }
}
