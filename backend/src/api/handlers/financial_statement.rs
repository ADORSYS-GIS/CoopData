use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::api::dto::financial::{
    FinancialStatementResponse, LineItemBulkUpdateRequest, LineItemResponse,
};
use crate::auth::claims::Claims;

use crate::error::{AppError, AppResult};
use crate::AppState;

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/financial-statements/{id}",
    params(("id" = Uuid, Path, description = "Financial statement ID")),
    responses(
        (status = 200, description = "Financial statement", body = FinancialStatementResponse),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Cooperative"
)]
pub async fn get_financial_statement(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let fs = state
        .financial_statement_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Financial statement not found".into()))?;

    if !coop_ids.contains(&fs.cooperative_id) {
        return Err(AppError::Forbidden("Access denied".into()));
    }

    Ok((StatusCode::OK, Json(FinancialStatementResponse::from(fs))))
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/financial-statements/{id}/line-items",
    params(("id" = Uuid, Path, description = "Financial statement ID")),
    responses(
        (status = 200, description = "Line items", body = Vec<LineItemResponse>),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Cooperative"
)]
pub async fn list_line_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let fs = state
        .financial_statement_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Financial statement not found".into()))?;

    if !coop_ids.contains(&fs.cooperative_id) {
        return Err(AppError::Forbidden("Access denied".into()));
    }

    let items = state
        .line_item_repo
        .find_by_financial_statement(id)
        .await?
        .into_iter()
        .map(LineItemResponse::from)
        .collect::<Vec<_>>();

    Ok((StatusCode::OK, Json(items)))
}

#[utoipa::path(
    patch,
    path = "/api/v1/cooperative/financial-statements/{id}/line-items",
    params(("id" = Uuid, Path, description = "Financial statement ID")),
    request_body = LineItemBulkUpdateRequest,
    responses(
        (status = 200, description = "Line items updated", body = Vec<LineItemResponse>),
        (status = 400, description = "Invalid input"),
        (status = 403, description = "Forbidden")
    ),
    tag = "Cooperative"
)]
pub async fn update_line_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Json(body): Json<LineItemBulkUpdateRequest>,
) -> AppResult<impl IntoResponse> {
    let coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let fs = state
        .financial_statement_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Financial statement not found".into()))?;

    if !coop_ids.contains(&fs.cooperative_id) {
        return Err(AppError::Forbidden("Access denied".into()));
    }

    let mut updated = vec![];
    for update in body.updates {
        if let Some(value) = update.value {
            use rust_decimal::prelude::FromPrimitive;
            let decimal =
                rust_decimal::Decimal::from_f64(value).unwrap_or(rust_decimal::Decimal::ZERO);
            let item = state
                .line_item_repo
                .update_value(update.id, decimal, update.account_code)
                .await?;
            updated.push(LineItemResponse::from(item));
        }
    }

    Ok((StatusCode::OK, Json(updated)))
}
