use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use axum::Extension;
use std::sync::Arc;
use uuid::Uuid;

use crate::api::dto::custom_kpi::{CreateCustomKpiRequest, CustomKpiDto, EvaluateKpiRequest, EvaluateKpiResponse};
use crate::error::{AppError, AppResult};
use crate::AppState;
use crate::auth::claims::Claims;
use evalexpr::{ContextWithMutableVariables, HashMapContext};

#[utoipa::path(
    post,
    path = "/api/v1/analytics/custom-kpis",
    request_body = CreateCustomKpiRequest,
    responses(
        (status = 201, description = "Custom KPI created", body = CustomKpiDto),
        (status = 400, description = "Invalid formula"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden")
    ),
    tag = "Analytics"
)]
pub async fn create_custom_kpi(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(payload): Json<CreateCustomKpiRequest>,
) -> AppResult<impl IntoResponse> {
    if !crate::auth::rbac::ScopeEnforcement::is_ministry(&claims) {
        return Err(AppError::Forbidden("Only Ministry users can create Custom KPIs".into()));
    }

    if let Err(e) = evalexpr::build_operator_tree::<evalexpr::DefaultNumericTypes>(&payload.formula) {
        return Err(AppError::BadRequest(format!("Invalid formula syntax: {}", e)));
    }

    let kpi = state
        .custom_kpi_repo
        .create(
            payload.name,
            payload.description,
            payload.formula,
            Some(claims.sub.parse().unwrap()),
        )
        .await?;

    let response: CustomKpiDto = kpi.into();
    Ok((StatusCode::CREATED, Json(response)))
}

#[utoipa::path(
    get,
    path = "/api/v1/analytics/custom-kpis",
    responses(
        (status = 200, description = "List of custom KPIs", body = Vec<CustomKpiDto>),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden")
    ),
    tag = "Analytics"
)]
pub async fn list_custom_kpis(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    if !crate::auth::rbac::ScopeEnforcement::is_ministry(&claims) {
        return Err(AppError::Forbidden("Only Ministry users can access Custom KPIs".into()));
    }

    let kpis = state.custom_kpi_repo.find_all().await?;
    let response: Vec<CustomKpiDto> = kpis.into_iter().map(Into::into).collect();

    Ok((StatusCode::OK, Json(response)))
}

#[utoipa::path(
    delete,
    path = "/api/v1/analytics/custom-kpis/{id}",
    params(
        ("id" = Uuid, Path, description = "ID of the custom KPI to delete")
    ),
    responses(
        (status = 204, description = "Custom KPI deleted"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden")
    ),
    tag = "Analytics"
)]
pub async fn delete_custom_kpi(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    if !crate::auth::rbac::ScopeEnforcement::is_ministry(&claims) {
        return Err(AppError::Forbidden("Only Ministry users can delete Custom KPIs".into()));
    }

    state.custom_kpi_repo.delete(id).await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/api/v1/analytics/custom-kpis/evaluate",
    request_body = EvaluateKpiRequest,
    responses(
        (status = 200, description = "Evaluation result", body = EvaluateKpiResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden")
    ),
    tag = "Analytics"
)]
pub async fn evaluate_custom_kpi(
    Extension(claims): Extension<Arc<Claims>>,
    Json(payload): Json<EvaluateKpiRequest>,
) -> AppResult<impl IntoResponse> {
    if !crate::auth::rbac::ScopeEnforcement::is_ministry(&claims) {
        return Err(AppError::Forbidden("Only Ministry users can evaluate Custom KPIs".into()));
    }

    let mut ctx: HashMapContext = HashMapContext::new();
    
    let expr = match evalexpr::build_operator_tree::<evalexpr::DefaultNumericTypes>(&payload.formula) {
        Ok(e) => e,
        Err(e) => return Ok((StatusCode::OK, Json(EvaluateKpiResponse {
            value: 0.0,
            is_valid: false,
            error: Some(format!("Parse error: {}", e)),
        })))
    };
    
    let ratio_names = [
        "total_assets", "gross_loan_portfolio", "net_loan_portfolio",
        "total_member_deposits", "total_equity", "par30", "par90",
        "npl_ratio", "loan_loss_coverage", "roa", "roe",
        "operating_expense_ratio", "capital_adequacy_ratio",
        "liquid_funds_ratio", "operational_self_sufficiency",
        "net_interest_margin", "deposits_to_loans",
    ];
    for name in &ratio_names {
        ctx.set_value(name.to_string(), evalexpr::Value::Float(100.0)).unwrap();
    }

    match expr.eval_with_context(&ctx) {
        Ok(v) => {
            let num = v.as_float().unwrap_or(0.0);
            Ok((StatusCode::OK, Json(EvaluateKpiResponse {
                value: num,
                is_valid: true,
                error: None,
            })))
        },
        Err(e) => {
            Ok((StatusCode::OK, Json(EvaluateKpiResponse {
                value: 0.0,
                is_valid: false,
                error: Some(format!("Evaluation error: {}", e)),
            })))
        }
    }
}
