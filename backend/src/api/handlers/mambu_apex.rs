//! Mambu endpoints of the apex. Only the apex links its cooperatives to Mambu branches,
//! syncs them and reads the results; the Mambu credentials stay on the server.

use std::collections::HashSet;
use std::sync::Arc;

use axum::extract::{Extension, Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::Deserialize;
use uuid::Uuid;

use crate::api::dto::{
    MambuApexCooperativeResponse, MambuBranchPreviewResponse, MambuCancelResponse,
    MambuCooperativeLinkResponse, MambuStatusResponse, MambuSyncDetailResponse,
    MambuSyncRunResponse, SetMambuAutoSyncRequest, SetMambuBranchRequest, StartMambuSyncRequest,
};
use crate::api::handlers::cooperative::resolve_caller_cooperative_ids;
use crate::api::handlers::mambu::detail_response;
use crate::auth::claims::Claims;
use crate::error::{AppError, AppResult};
use crate::services::mambu::linking;
use crate::services::mambu::sync::{
    cancel_items, start_run, SyncScope, ITEM_PENDING, SYSTEM_ACTOR,
};
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

/// A run as the apex sees it: who pressed the button is hidden, only an automatic run
/// is marked, and the count is the apex's own part of the run.
fn present_run(mut run: MambuSyncRunResponse, own: usize) -> MambuSyncRunResponse {
    run.started_by = run
        .started_by
        .filter(|s| s == SYSTEM_ACTOR)
        .map(|_| "automatic".to_string());
    run.total_saccos = own as i32;
    run
}

/// Branch names for the screens, or none when there is nothing to show or Mambu cannot
/// list branches (the screens then show the id).
async fn branch_names_for(
    state: &AppState,
    needed: bool,
) -> std::collections::HashMap<String, String> {
    match (&state.mambu_client, needed) {
        (Some(client), true) => client.branch_names().await,
        _ => std::collections::HashMap::new(),
    }
}

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
    path = "/api/v1/apex/mambu/cooperatives",
    responses((status = 200, description = "The apex's cooperatives with their Mambu link and latest sync", body = Vec<MambuApexCooperativeResponse>)),
    tag = TAG,
)]
pub async fn apex_list_mambu_cooperatives(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    let ids = owned_cooperative_ids(&state, &claims).await?;
    let cooperatives = state.cooperative_repo.find_by_ids(ids.clone()).await?;
    let links: std::collections::HashMap<Uuid, _> = state
        .mambu_repo
        .list_links_for(ids.clone())
        .await?
        .into_iter()
        .map(|l| (l.cooperative_id, l))
        .collect();
    let latest = state
        .mambu_repo
        .latest_items_for_cooperatives(ids.clone())
        .await?;
    let running_runs: Vec<Uuid> = state
        .mambu_repo
        .list_running_runs()
        .await?
        .into_iter()
        .map(|r| r.id)
        .collect();
    let running: HashSet<Uuid> = state
        .mambu_repo
        .pending_cooperative_ids(running_runs)
        .await?;
    let locked = state.mambu_repo.synced_cooperative_ids(ids.clone()).await?;
    let branch_names = branch_names_for(&state, !links.is_empty()).await;
    let mut out: Vec<MambuApexCooperativeResponse> = cooperatives
        .into_iter()
        .map(|c| {
            let link = links.get(&c.id);
            let item = latest.get(&c.id);
            MambuApexCooperativeResponse {
                id: c.id,
                name: c.display_name,
                institution_type: c.institution_type.map(|t| t.as_str().to_string()),
                mambu_branch_id: link.map(|l| l.mambu_branch_id.clone()),
                mambu_branch_name: link.and_then(|l| branch_names.get(&l.mambu_branch_id).cloned()),
                link_locked: locked.contains(&c.id),
                auto_sync: link.map(|l| l.auto_sync).unwrap_or(false),
                running: running.contains(&c.id),
                last_synced_at: item.map(|i| i.updated_at),
                last_status: item.map(|i| i.status.clone()),
                last_error: item.and_then(|i| i.error.clone()),
                last_submission_id: item.and_then(|i| i.submission_id),
                last_warning_count: item
                    .and_then(|i| i.warnings.as_array().map(|a| a.len() as i32))
                    .unwrap_or(0),
                last_unmapped_accounts: item.map(|i| i.unmapped_ledger_accounts).unwrap_or(0),
            }
        })
        .collect();
    out.sort_by_key(|c| c.name.to_lowercase());
    Ok(Json(out))
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
    let branch_names = branch_names_for(&state, link.is_some()).await;
    Ok(Json(MambuCooperativeLinkResponse {
        cooperative_id: id,
        mambu_branch_name: link
            .as_ref()
            .and_then(|l| branch_names.get(&l.mambu_branch_id).cloned()),
        mambu_branch_id: link.map(|l| l.mambu_branch_id),
        link_locked: state.mambu_repo.has_synced(id).await?,
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
    let branch_names = branch_names_for(&state, true).await;
    Ok(Json(MambuCooperativeLinkResponse {
        cooperative_id: id,
        mambu_branch_name: branch_names.get(&branch_id).cloned(),
        mambu_branch_id: Some(branch_id),
        link_locked: false,
    }))
}

#[utoipa::path(
    delete,
    path = "/api/v1/apex/cooperatives/{id}/mambu-link",
    params(("id" = Uuid, Path, description = "Cooperative id")),
    responses(
        (status = 204, description = "Link removed"),
        (status = 409, description = "Already synced, the link is fixed", body = ErrorResponse),
    ),
    tag = TAG,
)]
pub async fn apex_clear_mambu_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    ensure_owned(&state, &claims, id).await?;
    linking::ensure_link_unlocked(&state, id).await?;
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
    put,
    path = "/api/v1/apex/cooperatives/{id}/mambu-auto-sync",
    params(("id" = Uuid, Path, description = "Cooperative id")),
    request_body = SetMambuAutoSyncRequest,
    responses(
        (status = 204, description = "Setting saved"),
        (status = 404, description = "Cooperative not found or not linked", body = ErrorResponse),
    ),
    tag = TAG,
)]
pub async fn apex_set_mambu_auto_sync(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Json(body): Json<SetMambuAutoSyncRequest>,
) -> AppResult<impl IntoResponse> {
    ensure_owned(&state, &claims, id).await?;
    if !state.mambu_repo.set_auto_sync(id, body.auto_sync).await? {
        return Err(AppError::NotFound(
            "This cooperative is not linked to a Mambu branch".into(),
        ));
    }
    audit(
        &state,
        &claims,
        "MAMBU_AUTO_SYNC",
        serde_json::json!({ "cooperative_id": id, "auto_sync": body.auto_sync }),
    )
    .await;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/api/v1/apex/mambu/syncs",
    request_body = StartMambuSyncRequest,
    responses(
        (status = 202, description = "Sync of the whole year started. Results are drafts at the apex", body = MambuSyncRunResponse),
        (status = 400, description = "Invalid request, nothing linked, or Mambu not configured", body = ErrorResponse),
        (status = 409, description = "Syncs are running or the cooldown is active", body = ErrorResponse),
    ),
    tag = TAG,
)]
pub async fn apex_start_mambu_sync(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(body): Json<StartMambuSyncRequest>,
) -> AppResult<impl IntoResponse> {
    let owned = owned_cooperative_ids(&state, &claims).await?;
    let ids = match body.cooperative_ids.filter(|ids| !ids.is_empty()) {
        Some(chosen) => {
            let owned: HashSet<Uuid> = owned.into_iter().collect();
            if chosen.iter().any(|id| !owned.contains(id)) {
                return Err(AppError::NotFound("Cooperative not found".into()));
            }
            chosen
        }
        None => owned,
    };
    let count = ids.len();
    let run = start_run(
        &state,
        body.year,
        0,
        claims.clone(),
        SyncScope::Cooperatives(ids),
    )
    .await?;
    tracing::info!(run_id = %run.id, year = body.year, cooperatives = count, "Mambu sync started");
    audit(
        &state,
        &claims,
        "MAMBU_SYNC_START",
        serde_json::json!({ "run_id": run.id, "year": body.year, "cooperatives": count }),
    )
    .await;
    Ok((
        StatusCode::ACCEPTED,
        Json(present_run(MambuSyncRunResponse::from(run), count)),
    ))
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
    let runs = state
        .mambu_repo
        .list_runs_for_cooperatives(ids.clone(), MAX_RUNS)
        .await?;
    let mut out = Vec::with_capacity(runs.len());
    for run in runs {
        let own = state
            .mambu_repo
            .list_items_for_cooperatives(run.id, ids.clone())
            .await?
            .len();
        out.push(present_run(MambuSyncRunResponse::from(run), own));
    }
    Ok(Json(out))
}

#[utoipa::path(
    post,
    path = "/api/v1/apex/mambu/syncs/{id}/cancel",
    params(("id" = Uuid, Path, description = "Sync run id")),
    responses(
        (status = 200, description = "The apex's cooperatives of this run that were stopped", body = MambuCancelResponse),
        (status = 404, description = "Run not found", body = ErrorResponse),
        (status = 409, description = "Nothing of this run is running", body = ErrorResponse),
    ),
    tag = TAG,
)]
pub async fn apex_cancel_mambu_sync(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let ids = owned_cooperative_ids(&state, &claims).await?;
    let items = state
        .mambu_repo
        .list_items_for_cooperatives(id, ids)
        .await?;
    if items.is_empty() {
        return Err(AppError::NotFound("Sync run not found".into()));
    }
    if !items.iter().any(|i| i.status == ITEM_PENDING) {
        return Err(AppError::Conflict(
            "Nothing of this sync is running, so there is nothing to cancel".into(),
        ));
    }
    let cancelled = cancel_items(&state, id, items).await?;
    audit(
        &state,
        &claims,
        "MAMBU_SYNC_CANCEL",
        serde_json::json!({ "run_id": id, "cancelled": cancelled }),
    )
    .await;
    Ok(Json(MambuCancelResponse {
        cancelled: cancelled as i32,
    }))
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
    let run = state
        .mambu_repo
        .find_run(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Sync run not found".into()))?;
    let items = state
        .mambu_repo
        .list_items_for_cooperatives(id, ids)
        .await?;
    if items.is_empty() {
        return Err(AppError::NotFound("Sync run not found".into()));
    }
    let mut detail: MambuSyncDetailResponse = detail_response(&state, run, items).await?;
    let own = detail.items.len();
    detail.run = present_run(detail.run, own);
    Ok(Json(detail))
}
