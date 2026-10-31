//! Mambu endpoints for cooperatives and apexes. They only ever reach the
//! cooperatives the caller owns; the Mambu credentials stay on the server.

use std::sync::Arc;

use axum::extract::{Extension, Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use chrono::Utc;
use serde::Deserialize;
use uuid::Uuid;

use crate::api::dto::{
    MambuBranchPreviewResponse, MambuCooperativeLinkResponse, MambuCooperativeStatusResponse,
    MambuStatusResponse, MambuSyncRunResponse, SetMambuBranchRequest, StartApexMambuSyncRequest,
    StartMambuSyncRequest,
};
use crate::api::handlers::cooperative::{
    resolve_caller_cooperative, resolve_caller_cooperative_ids,
};
use crate::api::handlers::mambu::detail_response;
use crate::auth::claims::Claims;
use crate::error::{AppError, AppResult};
use crate::services::mambu::linking;
use crate::services::mambu::sync::{start_run, SyncLevel, SyncScope, COOLDOWN_MINUTES};
use crate::AppState;

const TAG: &str = "Mambu";
const MAX_RUNS: u64 = 30;

async fn audit(state: &AppState, claims: &Claims, action: &str, details: serde_json::Value) {
    if let Err(e) = state
        .audit
        .log(
            claims,
            action,
            "mambu_sync",
            None,
            Some(details),
            None,
            None,
        )
        .await
    {
        tracing::error!(error = %e, "Failed to log audit for Mambu change");
    }
}

async fn owned_cooperative_ids(state: &AppState, claims: &Claims) -> AppResult<Vec<Uuid>> {
    resolve_caller_cooperative_ids(state, claims).await
}

async fn ensure_owned(state: &AppState, claims: &Claims, cooperative_id: Uuid) -> AppResult<()> {
    if owned_cooperative_ids(state, claims)
        .await?
        .contains(&cooperative_id)
    {
        Ok(())
    } else {
        Err(AppError::NotFound("Cooperative not found".into()))
    }
}

async fn start(
    state: &AppState,
    claims: &Arc<Claims>,
    year: i32,
    month: u32,
    level: SyncLevel,
    scope: SyncScope,
) -> AppResult<(StatusCode, Json<MambuSyncRunResponse>)> {
    let run = start_run(state, year, month, claims.clone(), level, scope).await?;
    tracing::info!(run_id = %run.id, year, month, level = ?level, "Mambu sync started");
    audit(
        state,
        claims,
        "MAMBU_SYNC_START",
        serde_json::json!({ "run_id": run.id, "year": year, "month": month, "level": format!("{level:?}") }),
    )
    .await;
    Ok((StatusCode::ACCEPTED, Json(MambuSyncRunResponse::from(run))))
}

/// Runs that include one of the caller's cooperatives. The starter and the size
/// of a bulk run are hidden: the caller only sees its own part of the run.
async fn runs_for(
    state: &AppState,
    cooperative_ids: Vec<Uuid>,
) -> AppResult<Vec<MambuSyncRunResponse>> {
    let runs = state
        .mambu_repo
        .list_runs_for_cooperatives(cooperative_ids.clone(), MAX_RUNS)
        .await?;
    let mut out = Vec::with_capacity(runs.len());
    for run in runs {
        let own = state
            .mambu_repo
            .list_items_for_cooperatives(run.id, cooperative_ids.clone())
            .await?
            .len();
        let mut response = MambuSyncRunResponse::from(run);
        response.started_by = None;
        response.total_saccos = own as i32;
        out.push(response);
    }
    Ok(out)
}

async fn run_detail(
    state: &AppState,
    cooperative_ids: Vec<Uuid>,
    id: Uuid,
) -> AppResult<crate::api::dto::MambuSyncDetailResponse> {
    let run = state
        .mambu_repo
        .find_run(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Sync run not found".into()))?;
    let items = state
        .mambu_repo
        .list_items_for_cooperatives(id, cooperative_ids)
        .await?;
    if items.is_empty() {
        return Err(AppError::NotFound("Sync run not found".into()));
    }
    let mut detail = detail_response(state, run, items).await?;
    detail.run.started_by = None;
    detail.run.total_saccos = detail.items.len() as i32;
    Ok(detail)
}

// ---- Cooperative ----------------------------------------------------------

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/mambu/status",
    responses((status = 200, description = "Mambu link and sync state of the caller's SACCO", body = MambuCooperativeStatusResponse)),
    tag = TAG,
)]
pub async fn coop_mambu_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    let coop = resolve_caller_cooperative(&state, &claims).await?;
    let link = state.mambu_repo.find_link(coop.id).await?;
    let running_ids: Vec<Uuid> = state
        .mambu_repo
        .list_running_runs()
        .await?
        .into_iter()
        .map(|r| r.id)
        .collect();
    let running = state
        .mambu_repo
        .pending_cooperative_ids(running_ids)
        .await?
        .contains(&coop.id);
    let window = chrono::Duration::minutes(COOLDOWN_MINUTES);
    let last = state
        .mambu_repo
        .last_sync_starts(vec![coop.id], Utc::now() - window)
        .await?
        .remove(&coop.id);
    let cooldown_seconds_left = last
        .map(|t| (window - (Utc::now() - t)).num_seconds().max(0))
        .unwrap_or(0);
    Ok(Json(MambuCooperativeStatusResponse {
        configured: state.mambu_client.is_some(),
        linked: link.is_some(),
        mambu_branch_id: link.map(|l| l.mambu_branch_id),
        running,
        cooldown_seconds_left,
    }))
}

#[utoipa::path(
    post,
    path = "/api/v1/cooperative/mambu/syncs",
    request_body = StartMambuSyncRequest,
    responses(
        (status = 202, description = "Sync started. The result is a draft for the SACCO to check and submit", body = MambuSyncRunResponse),
        (status = 400, description = "Invalid request, not linked, or Mambu not configured", body = ErrorResponse),
        (status = 409, description = "A sync is running or the cooldown is active", body = ErrorResponse),
    ),
    tag = TAG,
)]
pub async fn coop_start_mambu_sync(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(body): Json<StartMambuSyncRequest>,
) -> AppResult<impl IntoResponse> {
    let coop = resolve_caller_cooperative(&state, &claims).await?;
    start(
        &state,
        &claims,
        body.year,
        body.month,
        SyncLevel::Cooperative,
        SyncScope::Cooperatives(vec![coop.id]),
    )
    .await
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/mambu/syncs",
    responses((status = 200, description = "Recent syncs of the caller's SACCO", body = Vec<MambuSyncRunResponse>)),
    tag = TAG,
)]
pub async fn coop_list_mambu_syncs(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    let coop = resolve_caller_cooperative(&state, &claims).await?;
    Ok(Json(runs_for(&state, vec![coop.id]).await?))
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/mambu/syncs/{id}",
    params(("id" = Uuid, Path, description = "Sync run id")),
    responses(
        (status = 200, description = "Result of the SACCO in this run", body = MambuSyncDetailResponse),
        (status = 404, description = "Run not found", body = ErrorResponse),
    ),
    tag = TAG,
)]
pub async fn coop_get_mambu_sync(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop = resolve_caller_cooperative(&state, &claims).await?;
    Ok(Json(run_detail(&state, vec![coop.id], id).await?))
}

// ---- Apex -----------------------------------------------------------------

#[utoipa::path(
    get,
    path = "/api/v1/apex/mambu/status",
    responses((status = 200, description = "Whether the Mambu integration is configured", body = MambuStatusResponse)),
    tag = TAG,
)]
pub async fn apex_mambu_status(State(state): State<AppState>) -> AppResult<impl IntoResponse> {
    Ok(Json(MambuStatusResponse {
        configured: state.mambu_client.is_some(),
    }))
}

#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct BranchPreviewQuery {
    /// Cooperative the branch is meant for. Lets an existing link show as available.
    pub cooperative_id: Option<Uuid>,
}

#[utoipa::path(
    get,
    path = "/api/v1/apex/mambu/branches/{branch_id}",
    params(("branch_id" = String, Path, description = "Mambu branch ID"), BranchPreviewQuery),
    responses(
        (status = 200, description = "Branch found. Name is empty when it is linked elsewhere", body = MambuBranchPreviewResponse),
        (status = 404, description = "No such branch", body = ErrorResponse),
    ),
    tag = TAG,
)]
pub async fn apex_preview_mambu_branch(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(branch_id): Path<String>,
    Query(query): Query<BranchPreviewQuery>,
) -> AppResult<impl IntoResponse> {
    if let Some(id) = query.cooperative_id {
        ensure_owned(&state, &claims, id).await?;
    }
    let preview = linking::preview_branch(&state, &branch_id, query.cooperative_id).await?;
    Ok(Json(MambuBranchPreviewResponse {
        id: preview.id,
        name: preview.name,
        available: preview.available,
    }))
}

#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct BranchSearchQuery {
    /// Mambu branch ID or part of the SACCO name (at least 3 letters)
    pub q: String,
    /// Cooperative the branch is meant for. Lets its current link show as available.
    pub cooperative_id: Option<Uuid>,
}

#[utoipa::path(
    get,
    path = "/api/v1/apex/mambu/branches",
    params(BranchSearchQuery),
    responses(
        (status = 200, description = "Free Mambu branches matching the text, at most 8", body = Vec<MambuBranchPreviewResponse>),
        (status = 400, description = "Text too short or Mambu not configured", body = ErrorResponse),
    ),
    tag = TAG,
)]
pub async fn apex_search_mambu_branches(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(query): Query<BranchSearchQuery>,
) -> AppResult<impl IntoResponse> {
    if let Some(id) = query.cooperative_id {
        ensure_owned(&state, &claims, id).await?;
    }
    let found = linking::search_branches(&state, &query.q, query.cooperative_id).await?;
    tracing::info!(user = %claims.sub, results = found.len(), "Mambu branch search");
    Ok(Json(
        found
            .into_iter()
            .map(|b| MambuBranchPreviewResponse {
                id: b.id,
                name: b.name,
                available: b.available,
            })
            .collect::<Vec<_>>(),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/apex/cooperatives/{id}/mambu-link",
    params(("id" = Uuid, Path, description = "Cooperative id")),
    responses((status = 200, description = "Mambu branch of the cooperative", body = MambuCooperativeLinkResponse)),
    tag = TAG,
)]
pub async fn apex_get_mambu_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    ensure_owned(&state, &claims, id).await?;
    let link = state.mambu_repo.find_link(id).await?;
    Ok(Json(MambuCooperativeLinkResponse {
        cooperative_id: id,
        mambu_branch_id: link.map(|l| l.mambu_branch_id),
    }))
}

#[utoipa::path(
    put,
    path = "/api/v1/apex/cooperatives/{id}/mambu-link",
    params(("id" = Uuid, Path, description = "Cooperative id")),
    request_body = SetMambuBranchRequest,
    responses(
        (status = 200, description = "Link saved", body = MambuCooperativeLinkResponse),
        (status = 404, description = "Cooperative or branch not found", body = ErrorResponse),
        (status = 409, description = "Branch already linked", body = ErrorResponse),
    ),
    tag = TAG,
)]
pub async fn apex_set_mambu_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Json(body): Json<SetMambuBranchRequest>,
) -> AppResult<impl IntoResponse> {
    ensure_owned(&state, &claims, id).await?;
    let branch_id =
        linking::link_cooperative(&state, id, &body.mambu_branch_id, &claims.sub).await?;
    audit(
        &state,
        &claims,
        "MAMBU_LINK",
        serde_json::json!({ "cooperative_id": id, "mambu_branch_id": branch_id }),
    )
    .await;
    Ok(Json(MambuCooperativeLinkResponse {
        cooperative_id: id,
        mambu_branch_id: Some(branch_id),
    }))
}

#[utoipa::path(
    delete,
    path = "/api/v1/apex/cooperatives/{id}/mambu-link",
    params(("id" = Uuid, Path, description = "Cooperative id")),
    responses((status = 204, description = "Link removed")),
    tag = TAG,
)]
pub async fn apex_clear_mambu_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    ensure_owned(&state, &claims, id).await?;
    state.mambu_repo.delete_link(id).await?;
    audit(
        &state,
        &claims,
        "MAMBU_UNLINK",
        serde_json::json!({ "cooperative_id": id }),
    )
    .await;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/api/v1/apex/mambu/syncs",
    request_body = StartApexMambuSyncRequest,
    responses(
        (status = 202, description = "Sync started. Results are drafts at the apex", body = MambuSyncRunResponse),
        (status = 409, description = "Syncs are running or the cooldown is active", body = ErrorResponse),
    ),
    tag = TAG,
)]
pub async fn apex_start_mambu_sync(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(body): Json<StartApexMambuSyncRequest>,
) -> AppResult<impl IntoResponse> {
    let ids = match body.cooperative_id {
        Some(id) => {
            ensure_owned(&state, &claims, id).await?;
            vec![id]
        }
        None => owned_cooperative_ids(&state, &claims).await?,
    };
    start(
        &state,
        &claims,
        body.year,
        body.month,
        SyncLevel::Apex,
        SyncScope::Cooperatives(ids),
    )
    .await
}

#[utoipa::path(
    get,
    path = "/api/v1/apex/mambu/syncs",
    responses((status = 200, description = "Recent syncs of the apex's cooperatives", body = Vec<MambuSyncRunResponse>)),
    tag = TAG,
)]
pub async fn apex_list_mambu_syncs(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    let ids = owned_cooperative_ids(&state, &claims).await?;
    Ok(Json(runs_for(&state, ids).await?))
}

#[utoipa::path(
    get,
    path = "/api/v1/apex/mambu/syncs/{id}",
    params(("id" = Uuid, Path, description = "Sync run id")),
    responses(
        (status = 200, description = "Results of the apex's cooperatives in this run", body = MambuSyncDetailResponse),
        (status = 404, description = "Run not found", body = ErrorResponse),
    ),
    tag = TAG,
)]
pub async fn apex_get_mambu_sync(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let ids = owned_cooperative_ids(&state, &claims).await?;
    Ok(Json(run_detail(&state, ids, id).await?))
}
