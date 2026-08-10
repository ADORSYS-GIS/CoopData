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

    if !is_coop_caller {
        // Admin path: rows scoped to the caller's authorized cooperatives.
        let scoped_rows: Vec<BasicBenchmarkRow> = all_rows
            .into_iter()
            .filter(|r| caller_coop_ids.contains(&r.cooperative_id))
            .collect();
        // Informational national average over the scoped population, gated by
        // the same MIN_CONTRIBUTORS guard for consistency (the widget computes
        // its own client-side averages with the lower apex/fed threshold).
        let (national_average, national_insufficient) = scoped_average(
            &scoped_rows,
            |r| r.has_data,
            get_metric_value,
            &BASIC_BENCHMARK_METRICS,
        );
        tracing::info!(
            caller = %claims.sub,
            cooperatives_in_scope = scoped_rows.len(),
            "Basic benchmark computed for admin caller"
        );
        return Ok((
            StatusCode::OK,
            Json(BasicBenchmarkResponse {
                reporting_year: params.reporting_year,
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
            }),
        ));
    }

    // A cooperative caller without an approved/submitted questionnaire for the
    // year gets `cooperative: null` with 200 OK — the absence of data is a
    // legitimate state the UI renders as an empty state, not an error.
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

    tracing::info!(
        caller = %claims.sub,
        cooperative = own_row
            .as_ref()
            .map(|r| r.cooperative_id.to_string())
            .unwrap_or_default(),
        has_own_data = own_row.is_some(),
        "Basic benchmark computed for cooperative caller"
    );

    Ok((
        StatusCode::OK,
        Json(BasicBenchmarkResponse {
            reporting_year: params.reporting_year,
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
        }),
    ))
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
