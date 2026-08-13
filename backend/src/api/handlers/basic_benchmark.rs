use axum::extract::{Extension, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::api::dto::basic_benchmark::{
    BasicBenchmarkInsufficientData, BasicBenchmarkParams, BasicBenchmarkResponse, BasicBenchmarkRow,
};
use crate::api::handlers::cooperative::resolve_caller_cooperative_ids;
use crate::api::handlers::questionnaire::{get_f64_from_json, get_i32_from_json};
use crate::auth::claims::Claims;
use crate::error::AppResult;
use crate::services::benchmark::scoped_average;
use crate::AppState;

/// Metric keys benchmarked for questionnaire (basic-tier) cooperatives.
/// Mirrors the fields extracted from `questionnaire_responses.answers` by
/// `get_questionnaire_analytics` — membership, financial balances, income.
const BASIC_BENCHMARK_METRICS: [&str; 15] = [
    "total_registered_members",
    "total_active_members",
    "total_members_male",
    "total_members_female",
    "total_share_capital",
    "total_borrowed_funds",
    "total_savings_value",
    "total_loans_outstanding",
    "total_income",
    "total_expenditure",
    "total_net_income",
    "members_age_18_25",
    "members_age_26_35",
    "members_age_36_60",
    "members_age_61plus",
];

/// Returns a privacy-safe benchmark comparison for questionnaire cooperatives.
///
/// - **Cooperative callers** receive only their own row plus server-computed
///   national / regional / sector / sector+regional averages. The response type
///   is structurally incapable of containing other cooperatives' rows. When the
///   caller has no approved/submitted questionnaire data for the year, the
///   response is still `200 OK` with `cooperative: null` — "no data" is a
///   legitimate state, not an error.
/// - **Ministry / federation / apex callers** receive the full rows for their
///   authorized scope plus a national average; the frontend computes the
///   regional/sector slices client-side over those rows (they are authorized to
///   see the raw data).
#[utoipa::path(
    get,
    path = "/api/v1/analytics/basic-benchmark",
    params(BasicBenchmarkParams),
    responses(
        (status = 200, description = "Benchmark comparison for questionnaire cooperatives", body = BasicBenchmarkResponse),
        (status = 403, description = "Forbidden")
    ),
    tag = "Analytics"
)]
pub async fn get_basic_benchmark(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<BasicBenchmarkParams>,
) -> AppResult<impl IntoResponse> {
    let caller_coop_ids = resolve_caller_cooperative_ids(&state, &claims).await?;
    // A user may hold multiple Keycloak realm roles (e.g. apex + cooperative).
    // Mirror the frontend `mapKeycloakRolesToRole` priority: any admin role
    // (ministry/federation/apex) takes the full-scope path; cooperative is only
    // the coop path when it is the caller's highest role.
    let is_coop_caller =
        !claims.has_role("ministry") && !claims.has_role("federation") && !claims.has_role("apex");

    // Fetch every questionnaire response (Approved/Submitted only — the repo
    // method applies the submission-status filter) for the full population.
    // Individual rows are computed server-side and never exposed to coop callers.
    let responses = state
        .questionnaire_repo
        .find_responses_with_filters(params.reporting_year, None, None, None, None)
        .await?;

    let all_rows = build_questionnaire_rows(responses);

    let response = compute_basic_benchmark(
        all_rows,
        &caller_coop_ids,
        is_coop_caller,
        params.reporting_year,
    );

    tracing::info!(
        caller = %claims.sub,
        is_coop_caller,
        cooperatives_in_scope = response.rows.len(),
        has_own_data = response.cooperative.is_some(),
        "Basic benchmark computed"
    );

    Ok((StatusCode::OK, Json(response)))
}

/// Pure decision logic for the basic-benchmark endpoint. Extracted from the
/// handler so the privacy guarantees are unit-testable without a database:
///
/// - **Coop callers** receive only their own row (`cooperative`) plus
///   server-computed averages; `rows` is always empty — the response is
///   structurally incapable of leaking other cooperatives. A coop with no
///   approved/submitted questionnaire gets `cooperative: None` (a legitimate
///   empty state, not an error).
/// - **Admin callers** (ministry/federation/apex) receive the full `rows` for
///   their authorized scope plus a national average; regional/sector slices are
///   left for the frontend to compute client-side over those rows.
///
/// Every average slice is gated by `MIN_CONTRIBUTORS` (see
/// `services/benchmark.rs`) so a caller cannot derive an individual coop's value
/// from a small sample.
fn compute_basic_benchmark(
    all_rows: Vec<BasicBenchmarkRow>,
    caller_coop_ids: &[Uuid],
    is_coop_caller: bool,
    reporting_year: Option<i32>,
) -> BasicBenchmarkResponse {
    if !is_coop_caller {
        // Admin path: rows scoped to the caller's authorized cooperatives.
        let scoped_rows: Vec<BasicBenchmarkRow> = all_rows
            .into_iter()
            .filter(|r| caller_coop_ids.contains(&r.cooperative_id))
            .collect();
        // Informational national average over the scoped population, gated by
        // the same MIN_CONTRIBUTORS guard for consistency.
        let (national_average, national_insufficient) = scoped_average(
            &scoped_rows,
            |r| r.has_data,
            get_metric_value,
            &BASIC_BENCHMARK_METRICS,
        );
        return BasicBenchmarkResponse {
            reporting_year,
            cooperative: None,
            rows: scoped_rows,
            national_average,
            regional_average: None,
            sector_average: None,
            sector_regional_average: None,
            insufficient_data: BasicBenchmarkInsufficientData {
                national: national_insufficient,
                regional: true,
                sector: true,
                sector_regional: true,
            },
        };
    }

    // A cooperative caller without an approved/submitted questionnaire for the
    // year gets `cooperative: None` — the absence of data is a legitimate state
    // the UI renders as an empty state, not an error.
    let own_row = all_rows
        .iter()
        .find(|r| caller_coop_ids.contains(&r.cooperative_id))
        .cloned();

    // National average is gated by the same MIN_CONTRIBUTORS guard as the
    // regional/sector slices: with a small national with-data sample, a calling
    // coop that knows its own value could otherwise derive a competitor's.
    let (national_average, national_insufficient) = scoped_average(
        &all_rows,
        |r| r.has_data,
        get_metric_value,
        &BASIC_BENCHMARK_METRICS,
    );

    // Without an own row we cannot know the caller's region/sector, so those
    // slices are withheld (null + insufficient flag) rather than guessed.
    let (regional_average, regional_insufficient) =
        match own_row.as_ref().and_then(|r| r.region.as_deref()) {
            Some(region) => scoped_average(
                &all_rows,
                |r| r.has_data && r.region.as_deref() == Some(region),
                get_metric_value,
                &BASIC_BENCHMARK_METRICS,
            ),
            None => (None, true),
        };

    let (sector_average, sector_insufficient) =
        match own_row.as_ref().and_then(|r| r.sector.as_deref()) {
            Some(sector) => scoped_average(
                &all_rows,
                |r| r.has_data && r.sector.as_deref() == Some(sector),
                get_metric_value,
                &BASIC_BENCHMARK_METRICS,
            ),
            None => (None, true),
        };

    let (sector_regional_average, sector_regional_insufficient) = match (
        own_row.as_ref().and_then(|r| r.sector.as_deref()),
        own_row.as_ref().and_then(|r| r.region.as_deref()),
    ) {
        (Some(sector), Some(region)) => scoped_average(
            &all_rows,
            |r| {
                r.has_data
                    && r.sector.as_deref() == Some(sector)
                    && r.region.as_deref() == Some(region)
            },
            get_metric_value,
            &BASIC_BENCHMARK_METRICS,
        ),
        _ => (None, true),
    };

    BasicBenchmarkResponse {
        reporting_year,
        cooperative: own_row,
        rows: vec![],
        national_average,
        regional_average,
        sector_average,
        sector_regional_average,
        insufficient_data: BasicBenchmarkInsufficientData {
            national: national_insufficient,
            regional: regional_insufficient,
            sector: sector_insufficient,
            sector_regional: sector_regional_insufficient,
        },
    }
}

/// Builds one `BasicBenchmarkRow` per cooperative, merging the answers of all its
/// questionnaire responses (a coop may have both a `financial` and a
/// `non_financial` questionnaire against the same submission).
fn build_questionnaire_rows(
    responses: Vec<(
        crate::entities::questionnaire_response::Model,
        crate::entities::cooperative::Model,
    )>,
) -> Vec<BasicBenchmarkRow> {
    // Group answers per cooperative, merging JSON objects (a key present in
    // multiple responses keeps the first non-zero value).
    let mut merged: HashMap<Uuid, (crate::entities::cooperative::Model, serde_json::Value)> =
        HashMap::new();
    for (resp, coop) in responses {
        let entry = merged
            .entry(resp.cooperative_id)
            .or_insert_with(|| (coop, serde_json::json!({})));
        if let (Some(obj), Some(target)) = (resp.answers.as_object(), entry.1.as_object_mut()) {
            for (key, value) in obj {
                let existing_zero = target
                    .get(key)
                    .and_then(|v| v.as_f64())
                    .map(|v| v == 0.0)
                    .unwrap_or(true);
                if existing_zero {
                    target.insert(key.clone(), value.clone());
                }
            }
        }
    }

    merged
        .into_iter()
        .map(|(cooperative_id, (coop, answers))| {
            let metrics = metrics_from_answers(&answers);
            // "Has data" means the submission contained benchmarkable answers.
            // Presence — not non-zero value — determines this, so a cooperative
            // that submitted a questionnaire with zero values still counts.
            let has_data = has_benchmark_metrics(&answers);
            BasicBenchmarkRow {
                cooperative_id,
                name: coop.name.clone(),
                region: coop.region.as_ref().map(|r| r.as_str().to_string()),
                sector: coop.sector.as_ref().map(|s| s.as_str().to_string()),
                has_data,
                metrics,
            }
        })
        .collect()
}

/// Every alias key that can carry a benchmarkable questionnaire metric (mirrors
/// the aliases used in `metrics_from_answers` — keep the two lists in sync).
/// Presence of any of these keys in a cooperative's merged answers means it
/// genuinely submitted questionnaire data for the year.
const BENCHMARK_METRIC_KEYS: [&str; 43] = [
    "registered_members_male",
    "total_registered_male",
    "registered_male",
    "registered_members_female",
    "total_registered_female",
    "registered_female",
    "active_members_male",
    "total_active_male",
    "active_male",
    "active_members_female",
    "total_active_female",
    "active_female",
    "savings_value_male",
    "savings_male",
    "savings_value_female",
    "savings_female",
    "outstanding_value_male",
    "loans_male",
    "outstanding_value_female",
    "loans_female",
    "amount_owed_by_members",
    "total_share_capital",
    "share_capital",
    "borrowed_funds_total",
    "borrowed_funds",
    "current_total_income",
    "total_income",
    "current_total_expenditure",
    "total_expenditure",
    "current_net_income",
    "net_income",
    "age_18_25_male",
    "age_18_25_female",
    "registered_members_18_25",
    "age_26_35_male",
    "age_26_35_female",
    "registered_members_26_35",
    "age_36_60_male",
    "age_36_60_female",
    "registered_members_36_60",
    "age_61plus_male",
    "age_61plus_female",
    "registered_members_61plus",
];

/// Returns true when the merged `answers` object contains any of the
/// benchmarkable metric keys. Used to distinguish "submitted real questionnaire
/// data" (even all-zero values) from "no relevant answers".
fn has_benchmark_metrics(answers: &serde_json::Value) -> bool {
    answers
        .as_object()
        .map(|obj| {
            BENCHMARK_METRIC_KEYS
                .iter()
                .any(|key| obj.contains_key(*key))
        })
        .unwrap_or(false)
}

/// Extracts the benchmarkable questionnaire metrics from a merged `answers` JSON
/// object. Uses the same key aliases as `get_questionnaire_analytics`.
fn metrics_from_answers(answers: &serde_json::Value) -> HashMap<String, f64> {
    let reg_m = get_i32_from_json(
        answers,
        &[
            "registered_members_male",
            "total_registered_male",
            "registered_male",
        ],
    );
    let reg_f = get_i32_from_json(
        answers,
        &[
            "registered_members_female",
            "total_registered_female",
            "registered_female",
        ],
    );
    let act_m = get_i32_from_json(
        answers,
        &["active_members_male", "total_active_male", "active_male"],
    );
    let act_f = get_i32_from_json(
        answers,
        &[
            "active_members_female",
            "total_active_female",
            "active_female",
        ],
    );

    let savings_m = get_f64_from_json(answers, &["savings_value_male", "savings_male"]);
    let savings_f = get_f64_from_json(answers, &["savings_value_female", "savings_female"]);
    let loans_m = get_f64_from_json(answers, &["outstanding_value_male", "loans_male"]);
    let loans_f = get_f64_from_json(answers, &["outstanding_value_female", "loans_female"]);
    let nf_loans_owed = get_f64_from_json(answers, &["amount_owed_by_members"]);

    let mut metrics = HashMap::new();
    metrics.insert(
        "total_registered_members".to_string(),
        (reg_m + reg_f) as f64,
    );
    metrics.insert("total_active_members".to_string(), (act_m + act_f) as f64);
    metrics.insert("total_members_male".to_string(), reg_m as f64);
    metrics.insert("total_members_female".to_string(), reg_f as f64);
    metrics.insert(
        "total_share_capital".to_string(),
        get_f64_from_json(answers, &["total_share_capital", "share_capital"]),
    );
    metrics.insert(
        "total_borrowed_funds".to_string(),
        get_f64_from_json(answers, &["borrowed_funds_total", "borrowed_funds"]),
    );
    metrics.insert("total_savings_value".to_string(), savings_m + savings_f);
    metrics.insert(
        "total_loans_outstanding".to_string(),
        loans_m + loans_f + nf_loans_owed,
    );
    metrics.insert(
        "total_income".to_string(),
        get_f64_from_json(answers, &["current_total_income", "total_income"]),
    );
    metrics.insert(
        "total_expenditure".to_string(),
        get_f64_from_json(answers, &["current_total_expenditure", "total_expenditure"]),
    );
    metrics.insert(
        "total_net_income".to_string(),
        get_f64_from_json(answers, &["current_net_income", "net_income"]),
    );
    metrics.insert(
        "members_age_18_25".to_string(),
        get_i32_from_json(
            answers,
            &[
                "age_18_25_male",
                "age_18_25_female",
                "registered_members_18_25",
            ],
        ) as f64,
    );
    metrics.insert(
        "members_age_26_35".to_string(),
        get_i32_from_json(
            answers,
            &[
                "age_26_35_male",
                "age_26_35_female",
                "registered_members_26_35",
            ],
        ) as f64,
    );
    metrics.insert(
        "members_age_36_60".to_string(),
        get_i32_from_json(
            answers,
            &[
                "age_36_60_male",
                "age_36_60_female",
                "registered_members_36_60",
            ],
        ) as f64,
    );
    metrics.insert(
        "members_age_61plus".to_string(),
        get_i32_from_json(
            answers,
            &[
                "age_61plus_male",
                "age_61plus_female",
                "registered_members_61plus",
            ],
        ) as f64,
    );
    metrics
}

/// Extracts a metric value from a questionnaire row.
fn get_metric_value(row: &BasicBenchmarkRow, key: &str) -> Option<f64> {
    row.metrics.get(key).copied()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    fn row(
        id: Uuid,
        name: &str,
        region: Option<&str>,
        sector: Option<&str>,
        has_data: bool,
        metrics: HashMap<String, f64>,
    ) -> BasicBenchmarkRow {
        BasicBenchmarkRow {
            cooperative_id: id,
            name: name.to_string(),
            region: region.map(|s| s.to_string()),
            sector: sector.map(|s| s.to_string()),
            has_data,
            metrics,
        }
    }

    fn metric(key: &str, val: f64) -> HashMap<String, f64> {
        let mut m = HashMap::new();
        m.insert(key.to_string(), val);
        m
    }

    /// Three with-data coops in the same region/sector — enough to disclose
    /// every average slice (MIN_CONTRIBUTORS = 3).
    fn population() -> Vec<BasicBenchmarkRow> {
        vec![
            row(
                Uuid::new_v4(),
                "A",
                Some("Hhohho"),
                Some("Savings"),
                true,
                metric("total_income", 10.0),
            ),
            row(
                Uuid::new_v4(),
                "B",
                Some("Hhohho"),
                Some("Savings"),
                true,
                metric("total_income", 20.0),
            ),
            row(
                Uuid::new_v4(),
                "C",
                Some("Hhohho"),
                Some("Savings"),
                true,
                metric("total_income", 30.0),
            ),
        ]
    }

    // ── Structural privacy: coop callers never receive other coops' rows ─────

    #[test]
    fn coop_caller_receives_empty_rows_structural_privacy() {
        let own = Uuid::new_v4();
        let mut rows = population();
        rows.push(row(
            own,
            "Mine",
            Some("Hhohho"),
            Some("Savings"),
            true,
            metric("total_income", 100.0),
        ));

        let resp = compute_basic_benchmark(rows, &[own], true, Some(2025));

        assert!(
            resp.rows.is_empty(),
            "coop caller must never receive other cooperatives' rows"
        );
        assert_eq!(resp.cooperative.as_ref().unwrap().cooperative_id, own);
    }

    #[test]
    fn coop_caller_without_data_gets_cooperative_none_not_error() {
        // Caller has no row in the population (no approved/submitted data).
        let own = Uuid::new_v4();
        let resp = compute_basic_benchmark(population(), &[own], true, Some(2025));

        assert!(
            resp.cooperative.is_none(),
            "no-data is a legitimate empty state, not an error"
        );
        assert!(resp.rows.is_empty());
    }

    // ── Admin callers receive scoped rows ────────────────────────────────────

    #[test]
    fn admin_caller_receives_scoped_rows() {
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let mut rows = population();
        rows.push(row(
            a,
            "A",
            Some("Hhohho"),
            Some("Savings"),
            true,
            metric("total_income", 10.0),
        ));
        rows.push(row(
            b,
            "B",
            Some("Hhohho"),
            Some("Savings"),
            true,
            metric("total_income", 20.0),
        ));

        let resp = compute_basic_benchmark(rows, &[a, b], false, Some(2025));

        assert!(resp.cooperative.is_none(), "admin callers get no own row");
        let scoped: HashSet<Uuid> = resp.rows.iter().map(|r| r.cooperative_id).collect();
        assert_eq!(scoped.len(), 2);
        assert!(scoped.contains(&a) && scoped.contains(&b));
        assert!(
            resp.rows
                .iter()
                .all(|r| r.cooperative_id == a || r.cooperative_id == b),
            "admin rows must be limited to the authorized scope"
        );
    }

    // ── MIN_CONTRIBUTORS guard ───────────────────────────────────────────────

    #[test]
    fn min_contributors_withholds_averages_below_three() {
        // Only two with-data coops in the population → national average withheld.
        let a = Uuid::new_v4();
        let b = Uuid::new_v4();
        let rows = vec![
            row(
                a,
                "A",
                Some("Hhohho"),
                Some("Savings"),
                true,
                metric("total_income", 10.0),
            ),
            row(
                b,
                "B",
                Some("Hhohho"),
                Some("Savings"),
                true,
                metric("total_income", 20.0),
            ),
        ];

        let resp = compute_basic_benchmark(rows, &[a], true, Some(2025));

        assert!(resp.national_average.is_none());
        assert!(resp.insufficient_data.national);
    }

    #[test]
    fn min_contributors_discloses_averages_at_three() {
        let a = Uuid::new_v4();
        let mut rows = population();
        rows.push(row(
            a,
            "Mine",
            Some("Hhohho"),
            Some("Savings"),
            true,
            metric("total_income", 100.0),
        ));

        let resp = compute_basic_benchmark(rows, &[a], true, Some(2025));

        assert!(!resp.insufficient_data.national);
        // 10 + 20 + 30 + 100 = 160 / 4 = 40
        assert_eq!(resp.national_average.unwrap()["total_income"], 40.0);
    }

    #[test]
    fn regional_sector_slices_are_withheld_when_own_row_missing() {
        // Caller has no own row → region/sector unknown → slices withheld.
        let own = Uuid::new_v4();
        let resp = compute_basic_benchmark(population(), &[own], true, Some(2025));

        assert!(resp.regional_average.is_none());
        assert!(resp.sector_average.is_none());
        assert!(resp.sector_regional_average.is_none());
        assert!(resp.insufficient_data.regional);
        assert!(resp.insufficient_data.sector);
        assert!(resp.insufficient_data.sector_regional);
    }

    // ── has_benchmark_metrics: presence-based, all-zero counts as data ───────

    #[test]
    fn has_benchmark_metrics_counts_all_zero_submission_as_data() {
        // Metric keys present but all zero → still counts as submitted data.
        let answers = serde_json::json!({
            "total_income": 0,
            "total_share_capital": 0,
            "registered_members_male": 0,
        });
        assert!(has_benchmark_metrics(&answers));
    }

    #[test]
    fn has_benchmark_metrics_false_when_no_benchmarkable_keys() {
        let answers = serde_json::json!({ "some_unrelated_field": "x" });
        assert!(!has_benchmark_metrics(&answers));
    }

    #[test]
    fn has_benchmark_metrics_false_for_non_object() {
        assert!(!has_benchmark_metrics(&serde_json::json!(null)));
        assert!(!has_benchmark_metrics(&serde_json::json!([1, 2, 3])));
    }

    // ── metrics_from_answers: alias resolution ───────────────────────────────

    #[test]
    fn metrics_from_answers_resolves_aliases_and_sums_genders() {
        let answers = serde_json::json!({
            "registered_members_male": 30,
            "registered_members_female": 20,
            "active_members_male": 25,
            "active_members_female": 15,
            "savings_value_male": 100.0,
            "savings_value_female": 50.0,
            "outstanding_value_male": 40.0,
            "outstanding_value_female": 10.0,
            "amount_owed_by_members": 5.0,
            "total_share_capital": 500.0,
            "borrowed_funds_total": 200.0,
            "current_total_income": 1000.0,
            "current_total_expenditure": 700.0,
            "current_net_income": 300.0,
        });

        let m = metrics_from_answers(&answers);

        assert_eq!(m["total_registered_members"], 50.0);
        assert_eq!(m["total_active_members"], 40.0);
        assert_eq!(m["total_members_male"], 30.0);
        assert_eq!(m["total_members_female"], 20.0);
        assert_eq!(m["total_savings_value"], 150.0);
        assert_eq!(m["total_loans_outstanding"], 55.0);
        assert_eq!(m["total_share_capital"], 500.0);
        assert_eq!(m["total_borrowed_funds"], 200.0);
        assert_eq!(m["total_income"], 1000.0);
        assert_eq!(m["total_expenditure"], 700.0);
        assert_eq!(m["total_net_income"], 300.0);
    }
}
