//! Assembles the Basic Analytics dashboard (and the questionnaire PDF report
//! data) from questionnaire answers.

use std::collections::{BTreeMap, HashMap, HashSet};

use uuid::Uuid;

use crate::api::dto::basic_dashboard::{
    AgeBands, BasicDashboardParams, BasicDashboardResponse, CooperativeRow, DashboardScope,
    DashboardThresholds, Demographics, GenderCount, PeriodOption, SeriesPoint,
};
use crate::entities::enums::SubmissionStatus;
use crate::entities::{cooperative, questionnaire_response, submission};
use crate::error::AppResult;
use crate::services::questionnaire_kpi::{
    build_coa_indicators, build_indicators, merge_answers, with_previous, CoaBalances, Derived,
    Inputs, INSTITUTIONAL_CAPITAL_MINIMUM_PCT, LIQUIDITY_MINIMUM_PCT,
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
    coa: CoaBalances,
}

pub async fn build(state: &AppState, req: DashboardRequest) -> AppResult<BasicDashboardResponse> {
    // The platform no longer standardizes onto a comparison currency: every
    // figure is shown as reported, which is always SZL today.

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
            .filter_map(|(coop_id, (fin_nf, _sub_id))| {
                let (fin, nf) = fin_nf;
                let coop = coop_by_id.get(coop_id)?;
                let inputs = Inputs::from_answers(&merge_answers(fin.as_ref(), nf.as_ref()));
                let coa = fin
                    .as_ref()
                    .map(CoaBalances::from_answers)
                    .unwrap_or_default();
                Some(CoopPeriod {
                    coop: (*coop).clone(),
                    inputs,
                    coa,
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
    let consolidate_coa = |list: &[CoopPeriod]| -> CoaBalances {
        let mut total = CoaBalances::default();
        for c in list {
            total.add(&c.coa);
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
    let total_coa = consolidate_coa(&current);
    if total_coa.has_any() {
        indicators.extend(build_coa_indicators(&total_coa));
    }

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
        let prev_period = period_inputs(prev_key);
        let prev_inputs = consolidate(&prev_period);
        let mut prev = build_indicators(&prev_inputs, &Derived::from_inputs(&prev_inputs));
        let prev_coa = consolidate_coa(&prev_period);
        if prev_coa.has_any() {
            prev.extend(build_coa_indicators(&prev_coa));
        }
        with_previous(&mut indicators, &prev);
    }

    // ── series: one point per period and indicator group ──
    let mut series: HashMap<String, Vec<SeriesPoint>> = HashMap::new();
    let start = same_type.len().saturating_sub(MAX_SERIES_POINTS);
    for key in &same_type[start..] {
        let period = period_inputs(key);
        let inputs = consolidate(&period);
        let mut list = build_indicators(&inputs, &Derived::from_inputs(&inputs));
        let coa = consolidate_coa(&period);
        if coa.has_any() {
            list.extend(build_coa_indicators(&coa));
        }
        let mut by_group: HashMap<String, HashMap<String, f64>> = HashMap::new();
        for indicator in list {
            if let Some(v) = indicator.value {
                by_group
                    .entry(indicator.group)
                    .or_default()
                    .insert(indicator.key, v);
            }
        }
        for (group, values) in by_group {
            series.entry(group).or_default().push(SeriesPoint {
                period_label: period_label(key),
                reporting_year: key.year,
                period_type: key.period_type.clone(),
                period_value: key.period_value.clone(),
                values,
            });
        }
    }

    // ── per-cooperative rows (administrators) ──
    let mut rows: Vec<CooperativeRow> = Vec::new();
    if req.admin_view {
        for c in &current {
            let d = Derived::from_inputs(&c.inputs);
            let kpis = build_indicators(&c.inputs, &d);
            let kpi = |key: &str| kpis.iter().find(|k| k.key == key).and_then(|k| k.value);
            rows.push(CooperativeRow {
                cooperative_id: c.coop.id,
                name: c.coop.display_name.clone(),
                region: c.coop.region.as_ref().map(|r| r.as_str().to_string()),
                sector: c.coop.sector.as_ref().map(|s| s.as_str().to_string()),
                total_members: d.registered,
                active_members_pct: kpi("active_members_pct"),
                women_members_pct: kpi("women_members_pct"),
                par_gt_30_pct: kpi("par_gt_30_pct"),
                total_operating_margin_pct: kpi("total_operating_margin_pct"),
                monetary_reserve_coverage_pct: kpi("monetary_reserve_coverage_pct"),
            });
        }
        rows.sort_by(|a, b| a.name.cmp(&b.name));
    }

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
            currency: NATIVE_CURRENCY.to_string(),
            native_currency: NATIVE_CURRENCY.to_string(),
            available_periods,
        },
        thresholds: DashboardThresholds {
            liquidity_minimum_pct: LIQUIDITY_MINIMUM_PCT,
            institutional_capital_minimum_pct: INSTITUTIONAL_CAPITAL_MINIMUM_PCT,
        },
        indicators,
        series,
        demographics,
        cooperatives: rows,
    })
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
