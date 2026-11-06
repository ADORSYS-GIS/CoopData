use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::{Extension, Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use uuid::Uuid;

use crate::api::dto::{
    CoopAccountOption, MambuAccountMappingResponse, MambuGlAccountResponse,
    MambuProductMappingResponse, MambuProductResponse, MambuSyncDetailResponse,
    MambuSyncItemResponse, UpsertMambuAccountMappingRequest, UpsertMambuProductMappingRequest,
};
use crate::auth::claims::Claims;
use crate::error::{AppError, AppResult};
use crate::services::mambu::client::MambuApiClient;
use crate::services::mambu::mapper::{
    classify_deposit, MappingResolver, KIND_FIXED_DEPOSIT, KIND_IGNORE, KIND_MANDATORY, KIND_SHARE,
    KIND_VOLUNTARY,
};
use crate::services::mambu::models::MambuDeposit;
use crate::AppState;

const TAG: &str = "Mambu";
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
    path = "/api/v1/apex/mambu/gl-accounts",
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
    path = "/api/v1/apex/mambu/coop-accounts",
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
    path = "/api/v1/apex/mambu/account-mappings",
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
    path = "/api/v1/apex/mambu/account-mappings",
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
    path = "/api/v1/apex/mambu/account-mappings/{code}",
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
    path = "/api/v1/apex/mambu/products",
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
    path = "/api/v1/apex/mambu/product-mappings",
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
    path = "/api/v1/apex/mambu/product-mappings",
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
    path = "/api/v1/apex/mambu/product-mappings/{kind}/{id}",
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
