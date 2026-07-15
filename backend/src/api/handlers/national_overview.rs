use axum::extract::{Extension, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use std::collections::HashMap;
use std::sync::Arc;

use crate::api::handlers::cooperative::resolve_caller_cooperative_ids;
use crate::api::dto::national_overview::{
    CoopKpiRow, KpiStatusCount, NationalOverviewResponse, TrafficLightDistribution,
};
use crate::auth::claims::Claims;
use crate::error::AppResult;
use crate::services::kpi_engine::KpiEngine;
use crate::AppState;

#[utoipa::path(
    get,
    path = "/api/v1/analytics/national-overview",
    responses(
        (status = 200, description = "National dashboard overview", body = NationalOverviewResponse),
        (status = 401, description = "Unauthorized")
    ),
    tag = "Analytics"
)]
pub async fn get_national_overview(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    let coop_ids = resolve_caller_cooperative_ids(&state, &claims).await?;

    // Batch 1: fetch all cooperatives
    let mut cooperatives = Vec::new();
    for cid in &coop_ids {
        if let Ok(Some(c)) = state.cooperative_repo.find_by_id(*cid).await {
            cooperatives.push(c);
        }
    }

    // Batch 2: fetch latest financial statement per cooperative
    let mut fs_map: HashMap<uuid::Uuid, uuid::Uuid> = HashMap::new(); // coop_id -> fs_id
    for coop in &cooperatives {
        if let Ok(Some(fs)) = state
            .financial_statement_repo
            .find_latest_by_cooperative(coop.id)
            .await
        {
            fs_map.insert(coop.id, fs.id);
        }
    }

    // Batch 3: fetch line items for all financial statements
    let fs_ids: Vec<_> = fs_map.values().copied().collect();
    let all_line_items = if fs_ids.is_empty() {
        vec![]
    } else {
        state
            .line_item_repo
            .find_by_financial_statement_ids(fs_ids)
            .await
            .unwrap_or_default()
    };

    // Group line items by financial_statement_id
    let mut items_by_fs: HashMap<uuid::Uuid, Vec<_>> = HashMap::new();
    for item in all_line_items {
        items_by_fs
            .entry(item.financial_statement_id)
            .or_default()
            .push(item);
    }

    // Compute KPIs per cooperative
    let ratio_names = [
        "par30",
        "par90",
        "npl_ratio",
        "loan_loss_coverage",
        "roa",
        "roe",
        "operating_expense_ratio",
        "capital_adequacy_ratio",
        "liquid_funds_ratio",
        "operational_self_sufficiency",
        "net_interest_margin",
        "deposits_to_loans",
    ];

    let mut status_counts: HashMap<String, KpiStatusCount> = HashMap::new();
    for name in &ratio_names {
        status_counts.insert(
            name.to_string(),
            KpiStatusCount {
                green: 0,
                amber: 0,
                red: 0,
                no_data: 0,
            },
        );
    }

    let mut coop_rows: Vec<CoopKpiRow> = Vec::new();

    for coop in &cooperatives {
        let fs_id = fs_map.get(&coop.id);
        let items = fs_id
            .and_then(|fid| items_by_fs.get(fid))
            .map(|v| v.as_slice())
            .unwrap_or(&[]);

        let kpis = KpiEngine::compute(items);
        let mut kpi_map = HashMap::new();
        for name in &ratio_names {
            if let Some(kpi) = kpis.get_by_name(name) {
                kpi_map.insert(name.to_string(), kpi.clone());
                if let Some(counts) = status_counts.get_mut(*name) {
                    match kpi.status.as_deref() {
                        Some("green") => counts.green += 1,
                        Some("amber") => counts.amber += 1,
                        Some("red") => counts.red += 1,
                        _ => counts.no_data += 1,
                    }
                }
            }
        }

        coop_rows.push(CoopKpiRow {
            cooperative_id: coop.id,
            name: coop.display_name.clone(),
            region: coop.region.as_ref().map(|r| r.as_str().to_string()),
            sector: coop.sector.clone(),
            institution_type: coop
                .institution_type
                .as_ref()
                .map(|t| t.as_str().to_string()),
            has_data: !items.is_empty(),
            kpis: kpi_map,
        });
    }

    let total = cooperatives.len() as u64;

    let mut distributions = HashMap::new();
    for name in &ratio_names {
        if let Some(counts) = status_counts.get(*name) {
            let with_data = counts.green + counts.amber + counts.red;
            distributions.insert(
                name.to_string(),
                TrafficLightDistribution {
                    green_pct: pct(counts.green, with_data),
                    amber_pct: pct(counts.amber, with_data),
                    red_pct: pct(counts.red, with_data),
                    no_data_pct: pct(counts.no_data, total),
                    green_count: counts.green,
                    amber_count: counts.amber,
                    red_count: counts.red,
                    no_data_count: counts.no_data,
                },
            );
        }
    }

    tracing::info!(
        caller = %claims.sub,
        cooperatives_in_scope = total,
        "National overview computed"
    );

    Ok((
        StatusCode::OK,
        Json(NationalOverviewResponse {
            total_cooperatives: total,
            cooperatives_with_data: coop_rows.iter().filter(|r| r.has_data).count() as u64,
            distributions,
            cooperatives: coop_rows,
        }),
    ))
}

fn pct(part: u64, total: u64) -> f64 {
    if total == 0 {
        return 0.0;
    }
    (part as f64 / total as f64) * 100.0
}
