//! Assembles the Basic Analytics dashboard (and the questionnaire PDF report
//! data) from questionnaire answers.

use std::collections::{BTreeMap, HashMap, HashSet};

use uuid::Uuid;

use crate::api::dto::basic_dashboard::{
    AgeBands, BasicDashboardParams, BasicDashboardResponse, CooperativeRow, DashboardScope,
    DashboardThresholds, Demographics, GenderCount, MarketShare, PeriodOption, SeriesPoint,
    ShareRow,
};
use crate::entities::enums::{Currency, SubmissionStatus};
use crate::entities::{cooperative, questionnaire_response, submission};
use crate::error::AppResult;
use crate::services::currency::{frozen_rate_of, to_usd_frozen};
use crate::services::questionnaire_kpi::{
    build_indicators, merge_answers, ratio_pct, series_values, with_previous, Derived, Inputs,
    INSTITUTIONAL_CAPITAL_MINIMUM_PCT, LIQUIDITY_MINIMUM_PCT,
};
use crate::AppState;

const MAX_SERIES_POINTS: usize = 8;
const NATIVE_CURRENCY: &str = "SZL";

pub struct DashboardRequest {
    pub params: BasicDashboardParams,
    /// Cooperatives the caller may see (already authorised).
    pub cooperative_ids: Vec<Uuid>,
    /// Administrators also receive market share and the per-cooperative table.
    pub admin_view: bool,
    /// A submission that is included whatever its status (report generation).
    pub focus_submission: Option<Uuid>,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
struct PeriodKey {
    year: i32,
    order: i32,
    period_type: String,
    period_value: String,
}

fn period_order(period_type: &str, value: &str) -> i32 {
    let digits: String = value.chars().filter(char::is_ascii_digit).collect();
    match period_type {
        "YEARLY" => 0,
        _ => digits.parse().unwrap_or(0),
    }
}

fn period_label(key: &PeriodKey) -> String {
    match key.period_type.as_str() {
        "QUARTERLY" => format!("Q{} {}", key.order.max(1), key.year),
        "SEMI_ANNUAL" => format!("H{} {}", key.order.max(1), key.year),
        "MONTHLY" => {
            const MONTHS: [&str; 12] = [
                "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
            ];
            let idx = (key.order.clamp(1, 12) - 1) as usize;
            format!("{} {}", MONTHS[idx], key.year)
        }
        _ => key.year.to_string(),
    }
}

fn matches_filter(value: Option<&str>, wanted: &Option<String>) -> bool {
    match wanted
        .as_deref()
        .map(str::trim)
        .filter(|w| !w.is_empty() && !w.eq_ignore_ascii_case("all"))
    {
        None => true,
        Some(w) => value.is_some_and(|v| v.eq_ignore_ascii_case(w)),
    }
}

/// A filter value that narrows the selection; empty and "all" mean no filter.
fn active_filter(value: Option<&str>) -> Option<&str> {
    value
        .map(str::trim)
        .filter(|v| !v.is_empty() && !v.eq_ignore_ascii_case("all"))
}

struct CoopPeriod {
    coop: cooperative::Model,
    inputs: Inputs,
}

fn conversion_factor(sub: &submission::Model, usd: bool, rates: &HashMap<Currency, f64>) -> f64 {
    if !usd {
        return 1.0;
    }
    to_usd_frozen(1.0, &Currency::Szl, frozen_rate_of(sub), rates)
}

pub async fn build(state: &AppState, req: DashboardRequest) -> AppResult<BasicDashboardResponse> {
    let usd = !req
        .params
        .currency
        .as_deref()
        .is_some_and(|c| c.eq_ignore_ascii_case("native"));
    let rates = state.currency_service.load_rates().await?;

    let coops: Vec<cooperative::Model> = state
        .cooperative_repo
        .find_by_ids(req.cooperative_ids.clone())
        .await?
        .into_iter()
        .filter(|c| matches_filter(c.region.as_ref().map(|r| r.as_str()), &req.params.region))
        .filter(|c| matches_filter(c.sector.as_ref().map(|s| s.as_str()), &req.params.sector))
        .collect();
    let coop_by_id: HashMap<Uuid, &cooperative::Model> = coops.iter().map(|c| (c.id, c)).collect();
    let coop_ids: Vec<Uuid> = coops.iter().map(|c| c.id).collect();

    let submissions: HashMap<Uuid, submission::Model> = state
        .submission_repo
        .find_by_cooperative_ids(coop_ids.clone())
        .await?
        .into_iter()
        .map(|s| (s.id, s))
        .collect();
    let individual = coops.len() == 1;
    let responses: Vec<questionnaire_response::Model> = state
        .questionnaire_repo
        .find_by_cooperatives(coop_ids.clone())
        .await?;

    let eligible = |sub: &submission::Model| -> bool {
        sub.status == SubmissionStatus::Approved
            || req.focus_submission == Some(sub.id)
            || (individual
                && matches!(
                    sub.status,
                    SubmissionStatus::Submitted | SubmissionStatus::InReview
                ))
    };

    // period -> coop -> (financial, non-financial) answers
    type Answers = (Option<serde_json::Value>, Option<serde_json::Value>);
    let mut by_period: BTreeMap<PeriodKey, HashMap<Uuid, (Answers, Uuid)>> = BTreeMap::new();
    for r in &responses {
        let Some(sub) = submissions.get(&r.submission_id) else {
            continue;
        };
        if !eligible(sub) {
            continue;
        }
        let key = PeriodKey {
            year: r.reporting_year,
            order: period_order(&r.period_type, &r.period_value),
            period_type: r.period_type.clone(),
            period_value: r.period_value.clone(),
        };
        let slot = by_period
            .entry(key)
            .or_default()
            .entry(r.cooperative_id)
            .or_insert(((None, None), sub.id));
        if r.questionnaire_type == "financial" {
            slot.0 .0 = Some(r.answers.clone());
        } else {
            slot.0 .1 = Some(r.answers.clone());
        }
    }

    let period_inputs = |key: &PeriodKey| -> Vec<CoopPeriod> {
        let Some(entries) = by_period.get(key) else {
            return vec![];
        };
        entries
            .iter()
            .filter_map(|(coop_id, ((fin, nf), sub_id))| {
                let coop = coop_by_id.get(coop_id)?;
                let mut inputs = Inputs::from_answers(&merge_answers(fin.as_ref(), nf.as_ref()));
                if let Some(sub) = submissions.get(sub_id) {
                    inputs.scale_money(conversion_factor(sub, usd, &rates));
                }
                Some(CoopPeriod {
                    coop: (*coop).clone(),
                    inputs,
                })
            })
            .collect()
    };
    let consolidate = |list: &[CoopPeriod]| -> Inputs {
        let mut total = Inputs::default();
        for c in list {
            total.add(&c.inputs);
        }
        total
    };

    // ── period selection ──
    let keys: Vec<PeriodKey> = by_period.keys().cloned().collect();
    let focus_key = req.focus_submission.and_then(|sid| {
        responses
            .iter()
            .find(|r| r.submission_id == sid)
            .map(|r| PeriodKey {
                year: r.reporting_year,
                order: period_order(&r.period_type, &r.period_value),
                period_type: r.period_type.clone(),
                period_value: r.period_value.clone(),
            })
    });
    let wanted_type = active_filter(req.params.period_type.as_deref()).map(str::to_uppercase);
    let wanted_value = active_filter(req.params.period_value.as_deref());
    let selected: Option<PeriodKey> = focus_key.or_else(|| {
        keys.iter()
            .rev()
            .find(|k| {
                req.params.reporting_year.map_or(true, |y| y == k.year)
                    && wanted_type.as_deref().map_or(true, |t| t == k.period_type)
                    && wanted_value.map_or(true, |v| v.eq_ignore_ascii_case(&k.period_value))
            })
            .cloned()
    });

    let available_periods: Vec<PeriodOption> = keys
        .iter()
        .rev()
        .map(|k| PeriodOption {
            reporting_year: k.year,
            period_type: k.period_type.clone(),
            period_value: k.period_value.clone(),
            label: period_label(k),
        })
        .collect();

    let current: Vec<CoopPeriod> = selected.as_ref().map(&period_inputs).unwrap_or_default();
    let total_inputs = consolidate(&current);
    let derived = Derived::from_inputs(&total_inputs);
    let mut indicators = build_indicators(&total_inputs, &derived);

    let same_type: Vec<&PeriodKey> = selected
        .as_ref()
        .map(|s| {
            keys.iter()
                .filter(|k| k.period_type == s.period_type && *k <= s)
                .collect()
        })
        .unwrap_or_default();
    if same_type.len() >= 2 {
        let prev_key = same_type[same_type.len() - 2];
        let prev_inputs = consolidate(&period_inputs(prev_key));
        let prev = build_indicators(&prev_inputs, &Derived::from_inputs(&prev_inputs));
        with_previous(&mut indicators, &prev);
    }

    // ── series ──
    let mut series: HashMap<String, Vec<SeriesPoint>> = HashMap::new();
    let start = same_type.len().saturating_sub(MAX_SERIES_POINTS);
    for key in &same_type[start..] {
        let inputs = consolidate(&period_inputs(key));
        let d = Derived::from_inputs(&inputs);
        for (name, values) in series_values(&inputs, &d) {
            series
                .entry(name.to_string())
                .or_default()
                .push(SeriesPoint {
                    period_label: period_label(key),
                    reporting_year: key.year,
                    period_type: key.period_type.clone(),
                    period_value: key.period_value.clone(),
                    values: values
                        .into_iter()
                        .map(|(k, v)| (k.to_string(), v))
                        .collect(),
                });
        }
    }

    // ── per-cooperative rows and market share (administrators) ──
    let mut rows: Vec<CooperativeRow> = Vec::new();
    if req.admin_view {
        for c in &current {
            let d = Derived::from_inputs(&c.inputs);
            rows.push(CooperativeRow {
                cooperative_id: c.coop.id,
                name: c.coop.display_name.clone(),
                region: c.coop.region.as_ref().map(|r| r.as_str().to_string()),
                sector: c.coop.sector.as_ref().map(|s| s.as_str().to_string()),
                total_members: d.registered,
                total_assets: d.total_assets,
                total_deposits: d.deposits,
                gross_loans: d.gross_loans,
                par_gt_30_pct: d.par_pct(d.overdue_gt_30),
                liquidity_ratio_pct: d.liquidity_ratio_pct(),
                institutional_capital_ratio_pct: d.institutional_capital_ratio_pct(),
                net_income: d.net_income,
            });
        }
        rows.sort_by(|a, b| a.name.cmp(&b.name));
    }
    let market_share = (req.admin_view && rows.len() > 1).then(|| MarketShare {
        by_assets: shares(&rows, |r| r.total_assets.unwrap_or(0.0)),
        by_loans: shares(&rows, |r| r.gross_loans.unwrap_or(0.0)),
    });

    let i = &total_inputs;
    let gender = |m: f64, f: f64| GenderCount { male: m, female: f };
    let demographics = Demographics {
        registered: gender(i.reg_m, i.reg_f),
        active: gender(i.act_m, i.act_f),
        age: AgeBands {
            age_18_25: i.age_18_25,
            age_26_35: i.age_26_35,
            age_36_60: i.age_36_60,
            age_61_plus: i.age_61_plus,
        },
        board: gender(i.board_m, i.board_f),
        executive: gender(i.exec_m, i.exec_f),
        credit_committee: gender(i.credit_m, i.credit_f),
        savings_accounts: gender(i.sav_acc_m, i.sav_acc_f),
        loan_accounts: gender(i.loan_acc_m, i.loan_acc_f),
    };

    let rate_to_usd = usd
        .then(|| {
            selected
                .as_ref()
                .and_then(|k| by_period.get(k))
                .and_then(|m| m.values().next())
                .and_then(|(_, sid)| {
                    submissions
                        .get(sid)
                        .map(|s| 1.0 / conversion_factor(s, true, &rates))
                })
        })
        .flatten()
        .filter(|r| r.is_finite());

    let reporting: HashSet<Uuid> = current.iter().map(|c| c.coop.id).collect();
    Ok(BasicDashboardResponse {
        scope: DashboardScope {
            level: if individual {
                "individual"
            } else {
                "consolidated"
            }
            .to_string(),
            cooperatives_reporting: reporting.len() as u32,
            cooperatives_in_scope: coops.len() as u32,
            reporting_year: selected.as_ref().map(|k| k.year),
            period_type: selected.as_ref().map(|k| k.period_type.clone()),
            period_value: selected.as_ref().map(|k| k.period_value.clone()),
            period_label: selected.as_ref().map(period_label).unwrap_or_default(),
            currency: if usd { "USD" } else { NATIVE_CURRENCY }.to_string(),
            native_currency: NATIVE_CURRENCY.to_string(),
            rate_to_usd,
            available_periods,
        },
        thresholds: DashboardThresholds {
            liquidity_minimum_pct: LIQUIDITY_MINIMUM_PCT,
            institutional_capital_minimum_pct: INSTITUTIONAL_CAPITAL_MINIMUM_PCT,
        },
        indicators,
        series,
        market_share,
        demographics,
        cooperatives: rows,
    })
}

fn shares(rows: &[CooperativeRow], value: impl Fn(&CooperativeRow) -> f64) -> Vec<ShareRow> {
    let total: f64 = rows.iter().map(&value).filter(|v| *v > 0.0).sum();
    let mut out: Vec<ShareRow> = rows
        .iter()
        .filter(|r| value(r) > 0.0)
        .map(|r| ShareRow {
            cooperative_id: r.cooperative_id,
            name: r.name.clone(),
            value: value(r),
            share_pct: ratio_pct(Some(value(r)), Some(total)).unwrap_or(0.0),
        })
        .collect();
    out.sort_by(|a, b| b.value.total_cmp(&a.value));
    out
}

#[cfg(test)]
mod tests {
    use super::active_filter;

    #[test]
    fn all_and_blank_filters_do_not_narrow() {
        assert_eq!(active_filter(None), None);
        assert_eq!(active_filter(Some("")), None);
        assert_eq!(active_filter(Some("  ")), None);
        assert_eq!(active_filter(Some("all")), None);
        assert_eq!(active_filter(Some("ALL")), None);
    }

    #[test]
    fn a_real_value_is_kept_trimmed() {
        assert_eq!(active_filter(Some(" Q1 ")), Some("Q1"));
    }
}
