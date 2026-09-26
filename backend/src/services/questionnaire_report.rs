//! PDF report for submissions filled in through the questionnaire.
//!
//! Adds a parallel path to the existing report pipeline: the same LLM
//! narrative generator, the same metadata storage and the same Gotenberg
//! rendering, but fed by the questionnaire KPI engine and rendered by the
//! `/print/questionnaire/{id}` page. Reports of every other submission method
//! keep using the original path untouched.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::dto::basic_dashboard::{BasicDashboardParams, BasicDashboardResponse};
use crate::entities::{cooperative, submission};
use crate::error::{AppError, AppResult};
use crate::services::basic_dashboard::{build, DashboardRequest};
use crate::services::export_generator::ExportGenerator;
use crate::AppState;

pub const QUESTIONNAIRE_METHOD: &str = "questionnaire";

pub fn is_questionnaire_method(method: &str) -> bool {
    method.eq_ignore_ascii_case(QUESTIONNAIRE_METHOD)
}

// ── Output ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct QuestionnaireNarratives {
    pub executive_summary: String,
    pub membership_governance: String,
    pub portfolio_quality: String,
    pub liquidity_capital: String,
    pub financial_structure_profitability: String,
    pub outlook_recommendations: String,
}

pub fn encode_questionnaire_narrative_params(n: &QuestionnaireNarratives) -> String {
    format!(
        "&executive_summary={}&membership_governance={}&portfolio_quality={}&liquidity_capital={}&financial_structure_profitability={}&outlook_recommendations={}",
        urlencoding::encode(&n.executive_summary),
        urlencoding::encode(&n.membership_governance),
        urlencoding::encode(&n.portfolio_quality),
        urlencoding::encode(&n.liquidity_capital),
        urlencoding::encode(&n.financial_structure_profitability),
        urlencoding::encode(&n.outlook_recommendations),
    )
}

// ── Input context ──────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct QuestionnaireIndicatorSnapshot {
    pub key: String,
    pub group: String,
    pub value: Option<f64>,
    pub unit: String,
    pub status: String,
    pub previous: Option<f64>,
    pub change_pct: Option<f64>,
}

#[derive(Debug, Clone)]
pub struct QuestionnaireTrend {
    pub name: String,
    pub points: Vec<(String, f64)>,
}

#[derive(Debug, Clone)]
pub struct QuestionnaireNarrativeContext {
    pub coop_name: String,
    pub region: String,
    pub sector: String,
    pub institution_type: String,
    pub reg_no: String,
    pub period_label: String,
    pub currency: String,
    pub liquidity_minimum_pct: f64,
    pub institutional_capital_minimum_pct: f64,
    pub indicators: Vec<QuestionnaireIndicatorSnapshot>,
    pub trends: Vec<QuestionnaireTrend>,
}

/// (series key, value name) pairs summarised for the narrative.
const TREND_LINES: [(&str, &str); 8] = [
    ("asset_evolution", "total_assets"),
    ("savings_trend", "total_deposits"),
    ("loan_portfolio", "gross_loans"),
    ("par_trend", "par_gt_30_pct"),
    ("liquidity", "maintained_pct"),
    ("financial_structure", "earning_asset_ratio"),
    ("profitability", "net_income"),
    ("institutional_capital", "ratio_pct"),
];

/// Cooperative details the narrative needs.
#[derive(Debug, Clone)]
pub struct CoopMeta {
    pub name: String,
    pub region: String,
    pub sector: String,
    pub institution_type: String,
    pub reg_no: String,
}

impl CoopMeta {
    pub fn from_model(coop: &cooperative::Model) -> Self {
        CoopMeta {
            name: coop.display_name.clone(),
            region: coop
                .region
                .as_ref()
                .map(|r| r.as_str().to_string())
                .unwrap_or_else(|| "Unknown".into()),
            sector: coop
                .sector
                .as_ref()
                .map(|s| s.as_str().to_string())
                .unwrap_or_else(|| "Unknown".into()),
            institution_type: coop
                .institution_type
                .as_ref()
                .map(|t| t.as_str().to_string())
                .unwrap_or_else(|| "sacco".into()),
            reg_no: coop.reg_no.clone().unwrap_or_default(),
        }
    }
}

pub fn build_context(
    coop: &CoopMeta,
    dashboard: &BasicDashboardResponse,
) -> QuestionnaireNarrativeContext {
    let indicators = dashboard
        .indicators
        .iter()
        .map(|i| QuestionnaireIndicatorSnapshot {
            key: i.key.clone(),
            group: i.group.clone(),
            value: i.value,
            unit: i.unit.clone(),
            status: i.status.clone(),
            previous: i.previous,
            change_pct: i.change_pct,
        })
        .collect();

    let trends = TREND_LINES
        .iter()
        .filter_map(|(series, name)| {
            let points: Vec<(String, f64)> = dashboard
                .series
                .get(*series)?
                .iter()
                .filter_map(|p| Some((p.period_label.clone(), *p.values.get(*name)?)))
                .collect();
            (points.len() > 1).then(|| QuestionnaireTrend {
                name: name.to_string(),
                points,
            })
        })
        .collect();

    QuestionnaireNarrativeContext {
        coop_name: coop.name.clone(),
        region: coop.region.clone(),
        sector: coop.sector.clone(),
        institution_type: coop.institution_type.clone(),
        reg_no: coop.reg_no.clone(),
        period_label: dashboard.scope.period_label.clone(),
        currency: dashboard.scope.currency.clone(),
        liquidity_minimum_pct: dashboard.thresholds.liquidity_minimum_pct,
        institutional_capital_minimum_pct: dashboard.thresholds.institutional_capital_minimum_pct,
        indicators,
        trends,
    }
}

// ── Prompts ────────────────────────────────────────────────────────────────

const RULES: &str = "RULES:
- Use specific numbers from the data
- Do NOT invent data. Indicators marked not_reported were not provided; say so instead of guessing
- Indicators marked approximate are estimates; state that when you quote them
- Be professional but actionable: the report is reviewed by apex, federation and ministry officials
- Do NOT use markdown formatting, write plain text only
- Maximum 150 words per paragraph
- Write in third person (\"The cooperative\", not \"Your cooperative\")";

fn fmt_value(unit: &str, value: f64, currency: &str) -> String {
    match unit {
        "percent" | "ratio" => format!("{value:.2}%"),
        "currency" => format!("{currency} {value:.0}"),
        _ => format!("{value:.0}"),
    }
}

pub fn fmt_indicator_table(ctx: &QuestionnaireNarrativeContext, groups: &[&str]) -> String {
    let mut table = String::from(
        "| Indicator | Value | Previous period | Change | Status |\n|---|---|---|---|---|\n",
    );
    for i in ctx
        .indicators
        .iter()
        .filter(|i| groups.contains(&i.group.as_str()))
    {
        let value = i
            .value
            .map(|v| fmt_value(&i.unit, v, &ctx.currency))
            .unwrap_or_else(|| "not reported".into());
        let previous = i
            .previous
            .map(|v| fmt_value(&i.unit, v, &ctx.currency))
            .unwrap_or_else(|| "-".into());
        let change = i
            .change_pct
            .map(|c| {
                if i.unit == "percent" || i.unit == "ratio" {
                    format!("{c:+.2} pts")
                } else {
                    format!("{c:+.1}%")
                }
            })
            .unwrap_or_else(|| "-".into());
        table.push_str(&format!(
            "| {} | {} | {} | {} | {} |\n",
            i.key, value, previous, change, i.status
        ));
    }
    table
}

fn fmt_trends(ctx: &QuestionnaireNarrativeContext) -> String {
    if ctx.trends.is_empty() {
        return "(no earlier periods available)".into();
    }
    ctx.trends
        .iter()
        .map(|t| {
            let points = t
                .points
                .iter()
                .map(|(label, v)| format!("{label}: {v:.2}"))
                .collect::<Vec<_>>()
                .join(", ");
            format!("- {}: {}", t.name, points)
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn header(ctx: &QuestionnaireNarrativeContext) -> String {
    format!(
        "COOPERATIVE:\n- Name: {}\n- Region: {}\n- Sector: {}\n- Institution type: {}\n- Registration number: {}\n- Reporting period: {}\n- Currency: {} (converted from SZL when USD)\n",
        ctx.coop_name, ctx.region, ctx.sector, ctx.institution_type, ctx.reg_no, ctx.period_label, ctx.currency
    )
}

fn prompt(
    ctx: &QuestionnaireNarrativeContext,
    role: &str,
    groups: &[&str],
    task: &str,
    field: &str,
    with_thresholds: bool,
) -> String {
    let thresholds = if with_thresholds {
        format!(
            "REGULATORY MINIMUMS:\n- Liquidity to member savings: {:.0}%\n- Institutional capital to assets: {:.0}%\n\n",
            ctx.liquidity_minimum_pct, ctx.institutional_capital_minimum_pct
        )
    } else {
        String::new()
    };
    format!(
        "You are a senior analyst specializing in SACCO (Savings and Credit Cooperative) oversight in Eswatini. {role}\n\n{header}\nINDICATORS:\n{table}\nTRENDS ACROSS PERIODS:\n{trends}\n\n{thresholds}TASK:\n{task}\n\n{rules}\n\nReturn ONLY a minified JSON object with this exact structure:\n{{\"{field}\":\"...\"}}\nNo markdown fences, no explanation, no extra keys.",
        role = role,
        header = header(ctx),
        table = fmt_indicator_table(ctx, groups),
        trends = fmt_trends(ctx),
        thresholds = thresholds,
        task = task,
        rules = RULES,
        field = field,
    )
}

const ALL_GROUPS: [&str; 9] = [
    "membership",
    "savings",
    "loans",
    "risk",
    "liquidity",
    "structure",
    "capital",
    "profitability",
    "governance",
];

pub fn executive_summary_prompt(ctx: &QuestionnaireNarrativeContext) -> String {
    prompt(
        ctx,
        "Write the executive summary of the cooperative's periodic performance report.",
        &ALL_GROUPS,
        "Write exactly THREE paragraphs: (1) overall assessment of size, growth and soundness; (2) key strengths with specific values; (3) main risks and vulnerabilities with specific values.",
        "executive_summary",
        true,
    )
}

pub fn membership_governance_prompt(ctx: &QuestionnaireNarrativeContext) -> String {
    prompt(
        ctx,
        "Analyse membership and governance.",
        &["membership", "governance"],
        "Write ONE paragraph on membership size, activity, women and youth participation, and the gender balance of board, executive and credit committee.",
        "membership_governance",
        false,
    )
}

pub fn portfolio_quality_prompt(ctx: &QuestionnaireNarrativeContext) -> String {
    prompt(
        ctx,
        "Analyse the savings and loan portfolios and their quality.",
        &["savings", "loans", "risk"],
        "Write ONE paragraph on the loan and savings portfolios, portfolio at risk (PAR) across the overdue buckets, value at risk, interest in suspense and the trend across periods.",
        "portfolio_quality",
        false,
    )
}

pub fn liquidity_capital_prompt(ctx: &QuestionnaireNarrativeContext) -> String {
    prompt(
        ctx,
        "Analyse liquidity and institutional capital against the regulatory minimums.",
        &["liquidity", "capital"],
        "Write ONE paragraph on liquidity to member savings versus its minimum, and institutional capital to assets versus its minimum, with the size of any shortfall or excess.",
        "liquidity_capital",
        true,
    )
}

pub fn financial_structure_profitability_prompt(ctx: &QuestionnaireNarrativeContext) -> String {
    prompt(
        ctx,
        "Analyse the financial structure and profitability.",
        &["structure", "profitability"],
        "Write ONE paragraph on the earning asset, member savings, member share and borrowed funds ratios, and on income, expenditure, net income and return on assets.",
        "financial_structure_profitability",
        false,
    )
}

pub fn outlook_recommendations_prompt(ctx: &QuestionnaireNarrativeContext) -> String {
    prompt(
        ctx,
        "Write the outlook and recommendations section.",
        &ALL_GROUPS,
        "Write ONE paragraph with 3 concrete recommendations for the cooperative and its supervisors, each tied to a specific indicator value, and one sentence on data gaps (indicators not reported).",
        "outlook_recommendations",
        true,
    )
}

#[derive(Deserialize)]
pub struct ExecutiveSummaryOut {
    pub executive_summary: String,
}
#[derive(Deserialize)]
pub struct MembershipGovernanceOut {
    pub membership_governance: String,
}
#[derive(Deserialize)]
pub struct PortfolioQualityOut {
    pub portfolio_quality: String,
}
#[derive(Deserialize)]
pub struct LiquidityCapitalOut {
    pub liquidity_capital: String,
}
#[derive(Deserialize)]
pub struct StructureProfitabilityOut {
    pub financial_structure_profitability: String,
}
#[derive(Deserialize)]
pub struct OutlookOut {
    pub outlook_recommendations: String,
}

// ── Export path ────────────────────────────────────────────────────────────

/// Dashboard data for one questionnaire submission (also served to the print page).
pub async fn dashboard_for_submission(
    state: &AppState,
    submission: &submission::Model,
) -> AppResult<BasicDashboardResponse> {
    build(
        state,
        DashboardRequest {
            params: BasicDashboardParams {
                reporting_year: Some(submission.reporting_year),
                period_type: Some(submission.period_type.as_str().to_string()),
                period_value: Some(submission.period_value.clone()),
                region: None,
                sector: None,
                cooperative_id: Some(submission.cooperative_id),
                federation_id: None,
                apex_id: None,
                currency: None,
            },
            cooperative_ids: vec![submission.cooperative_id],
            admin_view: false,
            focus_submission: Some(submission.id),
        },
    )
    .await
}

impl ExportGenerator {
    /// Routes a single-submission PDF request by submission method.
    pub(crate) async fn generate_submission_pdf(
        state: &AppState,
        submission_id: Uuid,
    ) -> AppResult<Vec<u8>> {
        let submission = state
            .submission_repo
            .find_by_id(submission_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;
        if is_questionnaire_method(&submission.submission_method) {
            Self::generate_questionnaire_pdf(state, submission_id).await
        } else {
            Self::generate_cooperative_pdf(state, submission_id).await
        }
    }

    pub(crate) async fn generate_questionnaire_narratives(
        state: &AppState,
        submission_id: Uuid,
    ) -> AppResult<QuestionnaireNarratives> {
        let submission = state
            .submission_repo
            .find_by_id(submission_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;
        let coop = state
            .cooperative_repo
            .find_by_id(submission.cooperative_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Cooperative not found".into()))?;
        let dashboard = dashboard_for_submission(state, &submission).await?;
        let ctx = build_context(&CoopMeta::from_model(&coop), &dashboard);

        let _permit = state
            .ai_semaphore
            .acquire()
            .await
            .map_err(|_| AppError::InternalServerError("AI semaphore closed".into()))?;
        state
            .narrative_generator
            .generate_questionnaire_narratives(&ctx)
            .await
    }

    pub(crate) async fn generate_questionnaire_pdf(
        state: &AppState,
        submission_id: Uuid,
    ) -> AppResult<Vec<u8>> {
        let narrative_params = match Self::generate_questionnaire_narratives(state, submission_id)
            .await
        {
            Ok(result) => {
                if let Err(e) = state
                    .submission_repo
                    .update_metadata(
                        submission_id,
                        serde_json::json!({ "ai_narratives": result }),
                    )
                    .await
                {
                    tracing::warn!(submission_id = %submission_id, error = %e, "[export] failed to persist questionnaire narratives");
                }
                encode_questionnaire_narrative_params(&result)
            }
            Err(e) => {
                tracing::warn!(submission_id = %submission_id, error = %e, "[export] questionnaire narratives failed, rendering without AI summary");
                String::new()
            }
        };

        let token = state.keycloak.get_admin_token().await?;
        let print_url = format!(
            "{}/print/questionnaire/{}?token={}{}",
            state.config.gotenberg_frontend_url, submission_id, token, narrative_params
        );
        Self::generate_pdf_via_gotenberg(state, &print_url).await
    }
}

/// Indicator values keyed by name (used by tests and the print helpers).
pub fn indicator_map(dashboard: &BasicDashboardResponse) -> HashMap<String, Option<f64>> {
    dashboard
        .indicators
        .iter()
        .map(|i| (i.key.clone(), i.value))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::dto::basic_dashboard::{
        AgeBands, DashboardScope, DashboardThresholds, Demographics, GenderCount, IndicatorValue,
        SeriesPoint,
    };

    fn dashboard() -> BasicDashboardResponse {
        let gender = || GenderCount {
            male: 0.0,
            female: 0.0,
        };
        let mut series = HashMap::new();
        series.insert(
            "asset_evolution".to_string(),
            vec![
                SeriesPoint {
                    period_label: "Q1 2025".into(),
                    reporting_year: 2025,
                    period_type: "QUARTERLY".into(),
                    period_value: "Q1".into(),
                    values: HashMap::from([("total_assets".to_string(), 100.0)]),
                },
                SeriesPoint {
                    period_label: "Q2 2025".into(),
                    reporting_year: 2025,
                    period_type: "QUARTERLY".into(),
                    period_value: "Q2".into(),
                    values: HashMap::from([("total_assets".to_string(), 120.0)]),
                },
            ],
        );
        series.insert(
            "par_trend".to_string(),
            vec![SeriesPoint {
                period_label: "Q2 2025".into(),
                reporting_year: 2025,
                period_type: "QUARTERLY".into(),
                period_value: "Q2".into(),
                values: HashMap::from([("par_gt_30_pct".to_string(), 4.0)]),
            }],
        );
        BasicDashboardResponse {
            scope: DashboardScope {
                level: "individual".into(),
                cooperatives_reporting: 1,
                cooperatives_in_scope: 1,
                reporting_year: Some(2025),
                period_type: Some("QUARTERLY".into()),
                period_value: Some("Q2".into()),
                period_label: "Q2 2025".into(),
                currency: "USD".into(),
                native_currency: "SZL".into(),
                rate_to_usd: Some(18.5),
                available_periods: vec![],
            },
            thresholds: DashboardThresholds {
                liquidity_minimum_pct: 15.0,
                institutional_capital_minimum_pct: 8.0,
            },
            indicators: vec![
                IndicatorValue {
                    key: "total_assets".into(),
                    group: "structure".into(),
                    value: Some(120.0),
                    unit: "currency".into(),
                    status: "computed".into(),
                    previous: Some(100.0),
                    change_pct: Some(20.0),
                    formula: String::new(),
                    sources: vec![],
                    note: None,
                },
                IndicatorValue {
                    key: "par_gt_90_pct".into(),
                    group: "risk".into(),
                    value: None,
                    unit: "percent".into(),
                    status: "not_reported".into(),
                    previous: None,
                    change_pct: None,
                    formula: String::new(),
                    sources: vec![],
                    note: None,
                },
            ],
            series,
            market_share: None,
            demographics: Demographics {
                registered: gender(),
                active: gender(),
                age: AgeBands {
                    age_18_25: 0.0,
                    age_26_35: 0.0,
                    age_36_60: 0.0,
                    age_61_plus: 0.0,
                },
                board: gender(),
                executive: gender(),
                credit_committee: gender(),
                savings_accounts: gender(),
                loan_accounts: gender(),
            },
            cooperatives: vec![],
        }
    }

    fn context() -> QuestionnaireNarrativeContext {
        let d = dashboard();
        QuestionnaireNarrativeContext {
            coop_name: "Test SACCO".into(),
            region: "Manzini".into(),
            sector: "finance".into(),
            institution_type: "sacco".into(),
            reg_no: "R-1".into(),
            period_label: d.scope.period_label.clone(),
            currency: d.scope.currency.clone(),
            liquidity_minimum_pct: 15.0,
            institutional_capital_minimum_pct: 8.0,
            indicators: d
                .indicators
                .iter()
                .map(|i| QuestionnaireIndicatorSnapshot {
                    key: i.key.clone(),
                    group: i.group.clone(),
                    value: i.value,
                    unit: i.unit.clone(),
                    status: i.status.clone(),
                    previous: i.previous,
                    change_pct: i.change_pct,
                })
                .collect(),
            trends: vec![QuestionnaireTrend {
                name: "total_assets".into(),
                points: vec![("Q1 2025".into(), 100.0), ("Q2 2025".into(), 120.0)],
            }],
        }
    }

    #[test]
    fn dispatch_helper_only_matches_the_questionnaire_method() {
        assert!(is_questionnaire_method("questionnaire"));
        assert!(is_questionnaire_method("Questionnaire"));
        for other in ["upload", "manual", "manual_grid", ""] {
            assert!(!is_questionnaire_method(other));
        }
    }

    #[test]
    fn narrative_params_are_url_encoded_and_complete() {
        let n = QuestionnaireNarratives {
            executive_summary: "A & B".into(),
            membership_governance: "m".into(),
            portfolio_quality: "p".into(),
            liquidity_capital: "l c".into(),
            financial_structure_profitability: "f".into(),
            outlook_recommendations: "o".into(),
        };
        let encoded = encode_questionnaire_narrative_params(&n);
        assert!(encoded.starts_with("&executive_summary=A%20%26%20B"));
        for key in [
            "membership_governance",
            "portfolio_quality",
            "liquidity_capital",
            "financial_structure_profitability",
            "outlook_recommendations",
        ] {
            assert!(encoded.contains(&format!("&{key}=")), "missing {key}");
        }
        assert!(encoded.contains("liquidity_capital=l%20c"));
    }

    #[test]
    fn indicator_table_marks_missing_values_and_changes() {
        let table = fmt_indicator_table(&context(), &["structure", "risk"]);
        assert!(table.contains("| total_assets | USD 120 | USD 100 | +20.0% | computed |"));
        assert!(table.contains("| par_gt_90_pct | not reported | - | - | not_reported |"));
    }

    #[test]
    fn prompts_carry_thresholds_only_where_relevant() {
        let ctx = context();
        assert!(liquidity_capital_prompt(&ctx).contains("Liquidity to member savings: 15%"));
        assert!(executive_summary_prompt(&ctx).contains("Institutional capital to assets: 8%"));
        assert!(!membership_governance_prompt(&ctx).contains("REGULATORY MINIMUMS"));
        assert!(portfolio_quality_prompt(&ctx).contains("\"portfolio_quality\":\"...\""));
    }

    #[test]
    fn context_keeps_only_trends_with_several_periods() {
        let coop = CoopMeta {
            name: "Fixture SACCO".into(),
            region: "Manzini".into(),
            sector: "finance".into(),
            institution_type: "sacco".into(),
            reg_no: "R-9".into(),
        };
        let ctx = build_context(&coop, &dashboard());
        assert_eq!(ctx.coop_name, "Fixture SACCO");
        assert_eq!(ctx.period_label, "Q2 2025");
        assert_eq!(ctx.trends.len(), 1);
        assert_eq!(ctx.trends[0].name, "total_assets");
        assert_eq!(ctx.indicators.len(), 2);
        assert_eq!(indicator_map(&dashboard())["par_gt_90_pct"], None);
    }
}
