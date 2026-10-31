use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::{Extension, Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use uuid::Uuid;

use crate::api::dto::{
    CoopAccountOption, MambuAccountMappingResponse, MambuBranchResponse, MambuCooperativeOption,
    MambuGlAccountResponse, MambuLinkResponse, MambuProductMappingResponse, MambuProductResponse,
    MambuStatusResponse, MambuSyncDetailResponse, MambuSyncItemResponse, MambuSyncRunResponse,
    StartMambuSyncRequest, UpsertMambuAccountMappingRequest, UpsertMambuLinkRequest,
    UpsertMambuProductMappingRequest,
};
use crate::auth::claims::Claims;
use crate::error::{AppError, AppResult};
use crate::services::mambu::client::MambuApiClient;
use crate::services::mambu::mapper::{
    classify_deposit, MappingResolver, KIND_FIXED_DEPOSIT, KIND_IGNORE, KIND_MANDATORY, KIND_SHARE,
    KIND_VOLUNTARY,
};
use crate::services::mambu::models::MambuDeposit;
use crate::services::mambu::sync::{SyncLevel, SyncScope};
use crate::AppState;

const TAG: &str = "Mambu";
const MAX_RUNS: u64 = 30;
const DEPOSIT_KINDS: [&str; 5] = [
    KIND_VOLUNTARY,
    KIND_MANDATORY,
    KIND_SHARE,
    KIND_FIXED_DEPOSIT,
    KIND_IGNORE,
];
const LOAN_TYPES: [&str; 5] = ["Personal", "Business", "Agriculture", "Education", "Other"];

fn client(state: &AppState) -> AppResult<Arc<MambuApiClient>> {
    state.mambu_client.clone().ok_or_else(|| {
        AppError::BadRequest("The Mambu integration is not configured on this server".into())
    })
}

async fn audit(
    state: &AppState,
    claims: &Claims,
    action: &str,
    resource: &str,
    details: serde_json::Value,
) {
    if let Err(e) = state
        .audit
        .log(claims, action, resource, None, Some(details), None, None)
        .await
    {
        tracing::error!(error = %e, "Failed to log audit for Mambu change");
    }
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/mambu/status",
    responses((status = 200, description = "Whether the Mambu integration is configured", body = MambuStatusResponse)),
    tag = TAG,
)]
pub async fn mambu_status(State(state): State<AppState>) -> AppResult<impl IntoResponse> {
    Ok(Json(MambuStatusResponse {
        configured: state.mambu_client.is_some(),
    }))
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/mambu/branches",
    responses(
        (status = 200, description = "Mambu branches with their CoopData link", body = Vec<MambuBranchResponse>),
        (status = 400, description = "Mambu is not configured", body = ErrorResponse),
    ),
    tag = TAG,
)]
pub async fn list_mambu_branches(State(state): State<AppState>) -> AppResult<impl IntoResponse> {
    let branches = client(&state)?.branches().await?;
    let links: HashMap<String, Uuid> = state
        .mambu_repo
        .list_links()
        .await?
        .into_iter()
        .map(|l| (l.mambu_branch_id, l.cooperative_id))
        .collect();
    let mut out: Vec<MambuBranchResponse> = branches
        .into_iter()
        .map(|b| MambuBranchResponse {
            region: crate::services::mambu::mapper::branch_region(&b)
                .map(|r| r.as_str().to_string()),
            linked_cooperative_id: links.get(&b.id).copied(),
            id: b.id,
            name: b.name,
            state: b.state,
        })
        .collect();
    out.sort_by_key(|a| a.name.to_lowercase());
    Ok(Json(out))
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/mambu/cooperatives",
    responses((status = 200, description = "CoopData cooperatives available for linking", body = Vec<MambuCooperativeOption>)),
    tag = TAG,
)]
pub async fn list_mambu_cooperatives(
    State(state): State<AppState>,
) -> AppResult<impl IntoResponse> {
    let links: HashMap<Uuid, String> = state
        .mambu_repo
        .list_links()
        .await?
        .into_iter()
        .map(|l| (l.cooperative_id, l.mambu_branch_id))
        .collect();
    let mut out: Vec<MambuCooperativeOption> = state
        .cooperative_repo
        .list_all()
        .await?
        .into_iter()
        .map(|c| MambuCooperativeOption {
            linked_mambu_branch_id: links.get(&c.id).cloned(),
            id: c.id,
            name: c.display_name,
            institution_type: c.institution_type.map(|t| t.as_str().to_string()),
        })
        .collect();
    out.sort_by_key(|a| a.name.to_lowercase());
    Ok(Json(out))
}

#[utoipa::path(
    put,
    path = "/api/v1/ministry/mambu/links",
    request_body = UpsertMambuLinkRequest,
    responses(
        (status = 200, description = "Link saved", body = MambuLinkResponse),
        (status = 404, description = "Cooperative not found", body = ErrorResponse),
        (status = 409, description = "Branch already linked", body = ErrorResponse),
    ),
    tag = TAG,
)]
pub async fn upsert_mambu_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(body): Json<UpsertMambuLinkRequest>,
) -> AppResult<impl IntoResponse> {
    let branch_id = body.mambu_branch_id.trim().to_string();
    if branch_id.is_empty() || branch_id.len() > 64 {
        return Err(AppError::BadRequest(
            "mambu_branch_id is required (max 64 characters)".into(),
        ));
    }
    if state
        .cooperative_repo
        .find_by_id(body.cooperative_id)
        .await?
        .is_none()
    {
        return Err(AppError::NotFound("Cooperative not found".into()));
    }
    if let Some(c) = &state.mambu_client {
        if !c.branches().await?.iter().any(|b| b.id == branch_id) {
            return Err(AppError::BadRequest(
                "That branch does not exist in Mambu".into(),
            ));
        }
    }
    if let Err(e) = state
        .mambu_repo
        .upsert_link(body.cooperative_id, &branch_id, Some(claims.sub.clone()))
        .await
    {
        let text = e.to_string().to_lowercase();
        if text.contains("duplicate") || text.contains("unique") {
            return Err(AppError::Conflict(
                "That Mambu branch is already linked to another cooperative".into(),
            ));
        }
        return Err(e);
    }
    audit(
        &state,
        &claims,
        "MAMBU_LINK",
        "cooperative",
        serde_json::json!({
            "cooperative_id": body.cooperative_id, "mambu_branch_id": branch_id,
        }),
    )
    .await;
    let link = state
        .mambu_repo
        .list_links()
        .await?
        .into_iter()
        .find(|l| l.cooperative_id == body.cooperative_id)
        .ok_or_else(|| AppError::InternalServerError("Link was not saved".into()))?;
    Ok(Json(MambuLinkResponse::from(link)))
}

#[utoipa::path(
    delete,
    path = "/api/v1/ministry/mambu/links/{cooperative_id}",
    params(("cooperative_id" = Uuid, Path, description = "Cooperative id")),
    responses((status = 204, description = "Link removed")),
    tag = TAG,
)]
pub async fn delete_mambu_link(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(cooperative_id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    state.mambu_repo.delete_link(cooperative_id).await?;
    audit(
        &state,
        &claims,
        "MAMBU_UNLINK",
        "cooperative",
        serde_json::json!({
            "cooperative_id": cooperative_id,
        }),
    )
    .await;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/api/v1/ministry/mambu/syncs",
    request_body = StartMambuSyncRequest,
    responses(
        (status = 202, description = "Sync started", body = MambuSyncRunResponse),
        (status = 400, description = "Invalid request or Mambu not configured", body = ErrorResponse),
        (status = 409, description = "A sync is already running", body = ErrorResponse),
    ),
    tag = TAG,
)]
pub async fn start_mambu_sync(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(body): Json<StartMambuSyncRequest>,
) -> AppResult<impl IntoResponse> {
    let run = crate::services::mambu::sync::start_run(
        &state,
        body.year,
        body.month,
        claims.clone(),
        SyncLevel::Ministry,
        SyncScope::All,
    )
    .await?;
    tracing::info!(run_id = %run.id, year = body.year, month = body.month, "Mambu sync started");
    audit(
        &state,
        &claims,
        "MAMBU_SYNC_START",
        "mambu_sync",
        serde_json::json!({
            "run_id": run.id, "year": body.year, "month": body.month,
        }),
    )
    .await;
    Ok((StatusCode::ACCEPTED, Json(MambuSyncRunResponse::from(run))))
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/mambu/syncs",
    responses((status = 200, description = "Recent sync runs", body = Vec<MambuSyncRunResponse>)),
    tag = TAG,
)]
pub async fn list_mambu_syncs(State(state): State<AppState>) -> AppResult<impl IntoResponse> {
    let runs: Vec<MambuSyncRunResponse> = state
        .mambu_repo
        .list_runs(MAX_RUNS)
        .await?
        .into_iter()
        .map(Into::into)
        .collect();
    Ok(Json(runs))
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/mambu/syncs/{id}",
    params(("id" = Uuid, Path, description = "Sync run id")),
    responses(
        (status = 200, description = "Run with per-SACCO results", body = MambuSyncDetailResponse),
        (status = 404, description = "Run not found", body = ErrorResponse),
    ),
    tag = TAG,
)]
pub async fn get_mambu_sync(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let run = state
        .mambu_repo
        .find_run(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Sync run not found".into()))?;
    let items = state.mambu_repo.list_items(id).await?;
    Ok(Json(detail_response(&state, run, items).await?))
}

pub(crate) async fn detail_response(
    state: &AppState,
    run: crate::entities::mambu_sync_run::Model,
    items: Vec<crate::entities::mambu_sync_item::Model>,
) -> AppResult<MambuSyncDetailResponse> {
    let coop_ids: Vec<Uuid> = items.iter().filter_map(|i| i.cooperative_id).collect();
    let names: HashMap<Uuid, String> = state
        .cooperative_repo
        .find_by_ids(coop_ids)
        .await?
        .into_iter()
        .map(|c| (c.id, c.display_name))
        .collect();
    let items = items
        .into_iter()
        .map(|i| {
            let name = i.cooperative_id.and_then(|c| names.get(&c).cloned());
            MambuSyncItemResponse::from_model(i, name)
        })
        .collect();
    Ok(MambuSyncDetailResponse {
        run: run.into(),
        items,
    })
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/mambu/gl-accounts",
    responses((status = 200, description = "Mambu ledger accounts with their current mapping", body = Vec<MambuGlAccountResponse>)),
    tag = TAG,
)]
pub async fn list_mambu_gl_accounts(State(state): State<AppState>) -> AppResult<impl IntoResponse> {
    let accounts = client(&state)?.gl_accounts().await?;
    let mappings: HashMap<String, (i32, i16)> = state
        .mambu_repo
        .list_account_mappings()
        .await?
        .into_iter()
        .map(|m| (m.mambu_gl_code, (m.coop_account_code, m.sign)))
        .collect();
    let resolver = MappingResolver::new(
        &mappings,
        accounts
            .iter()
            .filter(|a| a.usage.as_deref() == Some("HEADER"))
            .map(|a| (a.account_type.as_str(), a.gl_code.as_str())),
    );
    let resolved: HashMap<String, i32> = accounts
        .iter()
        .filter_map(|a| {
            resolver
                .resolve(&a.gl_code, &a.account_type)
                .map(|(code, _)| (a.gl_code.clone(), code))
        })
        .collect();
    let mut out: Vec<MambuGlAccountResponse> = accounts
        .into_iter()
        .filter(|a| a.usage.as_deref() != Some("HEADER"))
        .map(|a| MambuGlAccountResponse {
            mapped_to: resolved.get(&a.gl_code).copied(),
            currency: a.currency.and_then(|c| c.currency_code),
            gl_code: a.gl_code,
            name: a.name,
            account_type: a.account_type,
            usage: a.usage,
        })
        .collect();
    out.sort_by(|a, b| a.gl_code.cmp(&b.gl_code));
    Ok(Json(out))
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/mambu/coop-accounts",
    responses((status = 200, description = "CoopData chart of accounts", body = Vec<CoopAccountOption>)),
    tag = TAG,
)]
pub async fn list_coop_accounts(State(state): State<AppState>) -> AppResult<impl IntoResponse> {
    let out: Vec<CoopAccountOption> = state
        .coa_repo
        .find_all()
        .await?
        .into_iter()
        .filter(|c| !c.is_total && !c.is_section_header)
        .map(|c| CoopAccountOption {
            account_code: c.account_code,
            account_name: c.account_name,
            category: format!("{:?}", c.account_category).to_lowercase(),
        })
        .collect();
    Ok(Json(out))
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/mambu/account-mappings",
    responses((status = 200, description = "Ledger mappings", body = Vec<MambuAccountMappingResponse>)),
    tag = TAG,
)]
pub async fn list_account_mappings(State(state): State<AppState>) -> AppResult<impl IntoResponse> {
    let out: Vec<MambuAccountMappingResponse> = state
        .mambu_repo
        .list_account_mappings()
        .await?
        .into_iter()
        .map(Into::into)
        .collect();
    Ok(Json(out))
}

#[utoipa::path(
    put,
    path = "/api/v1/ministry/mambu/account-mappings",
    request_body = UpsertMambuAccountMappingRequest,
    responses(
        (status = 200, description = "Mapping saved", body = MambuAccountMappingResponse),
        (status = 400, description = "Invalid mapping", body = ErrorResponse),
    ),
    tag = TAG,
)]
pub async fn upsert_account_mapping(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(body): Json<UpsertMambuAccountMappingRequest>,
) -> AppResult<impl IntoResponse> {
    let code = body.mambu_gl_code.trim().to_string();
    if code.is_empty() || code.len() > 64 {
        return Err(AppError::BadRequest(
            "mambu_gl_code is required (max 64 characters)".into(),
        ));
    }
    if body.sign != 1 && body.sign != -1 {
        return Err(AppError::BadRequest("sign must be 1 or -1".into()));
    }
    if state
        .coa_repo
        .find_by_code(body.coop_account_code)
        .await?
        .is_none()
    {
        return Err(AppError::BadRequest("Unknown CoopData account code".into()));
    }
    state
        .mambu_repo
        .upsert_account_mapping(&code, body.coop_account_code, body.sign)
        .await?;
    audit(
        &state,
        &claims,
        "MAMBU_MAPPING",
        "mambu_account_mapping",
        serde_json::json!({
            "mambu_gl_code": code, "coop_account_code": body.coop_account_code, "sign": body.sign,
        }),
    )
    .await;
    Ok(Json(MambuAccountMappingResponse {
        mambu_gl_code: code,
        coop_account_code: body.coop_account_code,
        sign: body.sign,
    }))
}

#[utoipa::path(
    delete,
    path = "/api/v1/ministry/mambu/account-mappings/{code}",
    params(("code" = String, Path, description = "Mambu ledger code")),
    responses((status = 204, description = "Mapping removed")),
    tag = TAG,
)]
pub async fn delete_account_mapping(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(code): Path<String>,
) -> AppResult<impl IntoResponse> {
    state.mambu_repo.delete_account_mapping(&code).await?;
    audit(
        &state,
        &claims,
        "MAMBU_MAPPING_DELETE",
        "mambu_account_mapping",
        serde_json::json!({
            "mambu_gl_code": code,
        }),
    )
    .await;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/mambu/products",
    responses((status = 200, description = "Mambu deposit and loan products with their mapping", body = Vec<MambuProductResponse>)),
    tag = TAG,
)]
pub async fn list_mambu_products(State(state): State<AppState>) -> AppResult<impl IntoResponse> {
    let c = client(&state)?;
    let overrides: HashMap<(String, String), String> = state
        .mambu_repo
        .list_product_mappings()
        .await?
        .into_iter()
        .map(|m| ((m.product_kind, m.mambu_product_id), m.mapped_type))
        .collect();
    let mut out = Vec::new();
    for p in c.deposit_products().await? {
        let guess = {
            let probe = MambuDeposit {
                name: p.name.clone(),
                account_type: p.product_type.clone(),
                ..Default::default()
            };
            classify_deposit(&probe, None).to_string()
        };
        let mapped = overrides
            .get(&("deposit".to_string(), p.id.clone()))
            .cloned()
            .unwrap_or(guess);
        out.push(MambuProductResponse {
            mapped_type: Some(mapped),
            id: p.id,
            name: p.name,
            product_kind: "deposit".into(),
            product_type: p.product_type,
        });
    }
    for p in c.loan_products().await? {
        let guess = crate::services::mambu::mapper::loan_type_from(
            p.name.as_deref().unwrap_or(""),
            None,
            None,
        );
        let mapped = overrides
            .get(&("loan".to_string(), p.id.clone()))
            .cloned()
            .unwrap_or(guess);
        out.push(MambuProductResponse {
            mapped_type: Some(mapped),
            id: p.id,
            name: p.name,
            product_kind: "loan".into(),
            product_type: p.product_type,
        });
    }
    Ok(Json(out))
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/mambu/product-mappings",
    responses((status = 200, description = "Product mappings", body = Vec<MambuProductMappingResponse>)),
    tag = TAG,
)]
pub async fn list_product_mappings(State(state): State<AppState>) -> AppResult<impl IntoResponse> {
    let out: Vec<MambuProductMappingResponse> = state
        .mambu_repo
        .list_product_mappings()
        .await?
        .into_iter()
        .map(Into::into)
        .collect();
    Ok(Json(out))
}

#[utoipa::path(
    put,
    path = "/api/v1/ministry/mambu/product-mappings",
    request_body = UpsertMambuProductMappingRequest,
    responses(
        (status = 200, description = "Mapping saved", body = MambuProductMappingResponse),
        (status = 400, description = "Invalid mapping", body = ErrorResponse),
    ),
    tag = TAG,
)]
pub async fn upsert_product_mapping(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(body): Json<UpsertMambuProductMappingRequest>,
) -> AppResult<impl IntoResponse> {
    let id = body.mambu_product_id.trim().to_string();
    if id.is_empty() || id.len() > 64 {
        return Err(AppError::BadRequest(
            "mambu_product_id is required (max 64 characters)".into(),
        ));
    }
    let allowed: &[&str] = match body.product_kind.as_str() {
        "deposit" => &DEPOSIT_KINDS,
        "loan" => &LOAN_TYPES,
        _ => {
            return Err(AppError::BadRequest(
                "product_kind must be 'deposit' or 'loan'".into(),
            ))
        }
    };
    if !allowed.contains(&body.mapped_type.as_str()) {
        return Err(AppError::BadRequest(format!(
            "mapped_type must be one of: {}",
            allowed.join(", ")
        )));
    }
    state
        .mambu_repo
        .upsert_product_mapping(&id, &body.product_kind, &body.mapped_type)
        .await?;
    audit(&state, &claims, "MAMBU_MAPPING", "mambu_product_mapping", serde_json::json!({
        "mambu_product_id": id, "product_kind": body.product_kind, "mapped_type": body.mapped_type,
    }))
    .await;
    Ok(Json(MambuProductMappingResponse {
        mambu_product_id: id,
        product_kind: body.product_kind,
        mapped_type: body.mapped_type,
    }))
}

#[utoipa::path(
    delete,
    path = "/api/v1/ministry/mambu/product-mappings/{kind}/{id}",
    params(
        ("kind" = String, Path, description = "deposit or loan"),
        ("id" = String, Path, description = "Mambu product id"),
    ),
    responses((status = 204, description = "Mapping removed")),
    tag = TAG,
)]
pub async fn delete_product_mapping(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path((kind, id)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
    state.mambu_repo.delete_product_mapping(&id, &kind).await?;
    audit(
        &state,
        &claims,
        "MAMBU_MAPPING_DELETE",
        "mambu_product_mapping",
        serde_json::json!({
            "mambu_product_id": id, "product_kind": kind,
        }),
    )
    .await;
    Ok(StatusCode::NO_CONTENT)
}
