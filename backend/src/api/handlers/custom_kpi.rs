use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Extension;
use axum::Json;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::api::dto::custom_kpi::{
    CreateCustomKpiRequest, CustomKpiDto, EvaluateKpiRequest, EvaluateKpiResponse,
    UpdateCustomKpiRequest,
};
use crate::auth::claims::Claims;
use crate::error::{AppError, AppResult};
use crate::AppState;
use evalexpr::{ContextWithMutableVariables, HashMapContext};
use rust_decimal::prelude::ToPrimitive;

#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct EvaluateKpiParams {
    pub cooperative_id: Option<uuid::Uuid>,
    pub submission_id: Option<uuid::Uuid>,
}

#[utoipa::path(
    post,
    path = "/api/v1/ministry/custom-kpis",
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
        return Err(AppError::Forbidden(
            "Only Ministry users can create Custom KPIs".into(),
        ));
    }

    if let Err(e) = evalexpr::build_operator_tree::<evalexpr::DefaultNumericTypes>(&payload.formula)
    {
        return Err(AppError::BadRequest(format!(
            "Invalid formula syntax: {}",
            e
        )));
    }

    let created_by = match state.user_repo.find_by_keycloak_id(&claims.sub).await {
        Ok(Some(u)) => Some(u.id),
        _ => None,
    };

    let kpi = state
        .custom_kpi_repo
        .create(
            payload.name,
            payload.description,
            payload.formula,
            created_by,
            payload
                .translations
                .unwrap_or_else(|| serde_json::json!({})),
        )
        .await?;

    let response: CustomKpiDto = kpi.into();
    Ok((StatusCode::CREATED, Json(response)))
}

#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ListCustomKpisParams {
    #[serde(default)]
    pub lang: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/custom-kpis",
    params(ListCustomKpisParams),
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
    Query(params): Query<ListCustomKpisParams>,
) -> AppResult<impl IntoResponse> {
    if !crate::auth::rbac::ScopeEnforcement::is_ministry(&claims) {
        return Err(AppError::Forbidden(
            "Only Ministry users can access Custom KPIs".into(),
        ));
    }

    let lang = crate::services::localization::normalize_lang(params.lang.as_deref());
    let kpis = state.custom_kpi_repo.find_all().await?;
    let response: Vec<CustomKpiDto> = kpis
        .into_iter()
        .map(|k| CustomKpiDto::from_model_resolved(k, lang.clone()))
        .collect();

    Ok((StatusCode::OK, Json(response)))
}

#[utoipa::path(
    delete,
    path = "/api/v1/ministry/custom-kpis/{id}",
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
        return Err(AppError::Forbidden(
            "Only Ministry users can delete Custom KPIs".into(),
        ));
    }

    state.custom_kpi_repo.delete(id).await?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    put,
    path = "/api/v1/ministry/custom-kpis/{id}",
    params(
        ("id" = Uuid, Path, description = "ID of the custom KPI to update")
    ),
    request_body = UpdateCustomKpiRequest,
    responses(
        (status = 200, description = "Custom KPI updated", body = CustomKpiDto),
        (status = 400, description = "Invalid formula"),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not Found")
    ),
    tag = "Analytics"
)]
pub async fn update_custom_kpi(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCustomKpiRequest>,
) -> AppResult<impl IntoResponse> {
    if !crate::auth::rbac::ScopeEnforcement::is_ministry(&claims) {
        return Err(AppError::Forbidden(
            "Only Ministry users can update Custom KPIs".into(),
        ));
    }

    let kpi = state
        .custom_kpi_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Custom KPI not found".into()))?;

    let mut active: crate::entities::custom_kpi::ActiveModel = kpi.into();
    if let Some(name) = payload.name {
        active.name = sea_orm::Set(name);
    }
    if let Some(desc) = payload.description {
        active.description = sea_orm::Set(Some(desc));
    }
    if let Some(formula) = payload.formula {
        if let Err(e) = evalexpr::build_operator_tree::<evalexpr::DefaultNumericTypes>(&formula) {
            return Err(AppError::BadRequest(format!(
                "Invalid formula syntax: {}",
                e
            )));
        }
        active.formula = sea_orm::Set(formula);
    }
    if let Some(translations) = payload.translations {
        if !translations.is_null()
            && !(translations.is_object() && translations.as_object().unwrap().is_empty())
        {
            active.translations = sea_orm::Set(translations);
        }
    }

    let updated = state.custom_kpi_repo.update_model(active).await?;

    let response: CustomKpiDto = updated.into();
    Ok((StatusCode::OK, Json(response)))
}

#[utoipa::path(
    post,
    path = "/api/v1/ministry/custom-kpis/evaluate",
    params(EvaluateKpiParams),
    request_body = EvaluateKpiRequest,
    responses(
        (status = 200, description = "Evaluation result", body = EvaluateKpiResponse),
        (status = 401, description = "Unauthorized"),
        (status = 403, description = "Forbidden")
    ),
    tag = "Analytics"
)]
pub async fn evaluate_custom_kpi(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<EvaluateKpiParams>,
    Json(payload): Json<EvaluateKpiRequest>,
) -> AppResult<impl IntoResponse> {
    if !crate::auth::rbac::ScopeEnforcement::is_ministry(&claims) {
        return Err(AppError::Forbidden(
            "Only Ministry users can evaluate Custom KPIs".into(),
        ));
    }

    let expr =
        match evalexpr::build_operator_tree::<evalexpr::DefaultNumericTypes>(&payload.formula) {
            Ok(e) => e,
            Err(e) => {
                return Ok((
                    StatusCode::OK,
                    Json(EvaluateKpiResponse {
                        value: 0.0,
                        is_valid: false,
                        error: Some(format!("Parse error: {}", e)),
                    }),
                ))
            }
        };

    let mut ctx: HashMapContext = HashMapContext::new();

    let ratio_names = [
        "total_assets",
        "gross_loan_portfolio",
        "net_loan_portfolio",
        "total_member_deposits",
        "total_equity",
        "net_surplus",
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

    let catalog_items = state
        .non_financial_indicator_catalog_repo
        .find_all()
        .await
        .unwrap_or_default();

    let use_real_data = params.cooperative_id.is_some() || params.submission_id.is_some();

    let raw_account_codes = [
        1100, 1101, 1102, 1103, 1104, 1200, 1201, 1202, 1203, 1204, 1205, 1250, 1251, 1252, 1300,
        1301, 1302, 1303, 1304, 1305, 1999, 2100, 2101, 2102, 2103, 2200, 2201, 2202, 2300, 2301,
        2302, 2303, 2999, 3100, 3101, 3102, 3200, 3201, 3202, 3203, 3300, 3301, 3302, 3999, 4101,
        4102, 4201, 4999, 5101, 5102, 5201, 5202, 5203, 5204, 5301, 5999, 6999,
    ];

    if use_real_data {
        let mut kpi_values: HashMap<String, f64> = HashMap::new();
        let mut target_sub_id: Option<Uuid> = None;

        if let Some(submission_id) = params.submission_id {
            target_sub_id = Some(submission_id);
        } else if let Some(cooperative_id) = params.cooperative_id {
            let submissions = state
                .submission_repo
                .find_by_cooperative_ids(vec![cooperative_id])
                .await
                .unwrap_or_default();
            let approved: Vec<_> = submissions
                .into_iter()
                .filter(|s| {
                    s.status == crate::entities::enums::SubmissionStatus::Approved
                        || s.status == crate::entities::enums::SubmissionStatus::Submitted
                })
                .collect();
            if let Some(latest) = approved
                .iter()
                .max_by_key(|s| (s.reporting_year, s.created_at))
            {
                target_sub_id = Some(latest.id);
            }
        }

        // Initialize all raw codes to 0.0 for compiler safety
        for code in &raw_account_codes {
            ctx.set_value(format!("ac_{}", code), evalexpr::Value::Float(0.0))
                .unwrap();
        }

        if let Some(submission_id) = target_sub_id {
            // Load and insert raw account code values
            if let Ok(Some(fs)) = state
                .financial_statement_repo
                .find_by_submission(submission_id)
                .await
            {
                if let Ok(line_items) = state
                    .line_item_repo
                    .find_by_financial_statement(fs.id)
                    .await
                {
                    for item in line_items {
                        if let Some(code) = item.account_code {
                            let val = item.value.and_then(|v| v.to_f64()).unwrap_or(0.0);
                            ctx.set_value(format!("ac_{}", code), evalexpr::Value::Float(val))
                                .unwrap();
                        }
                    }
                }
            }

            let records = state
                .kpi_record_repo
                .find_by_submission(submission_id)
                .await
                .unwrap_or_default();
            for rec in &records {
                kpi_values.insert(rec.kpi_name.clone(), rec.value);
            }

            if let Ok(entries) = state
                .non_financial_indicator_entry_repo
                .find_by_submission_id(submission_id)
                .await
            {
                for entry in entries {
                    if let Some(cat) = catalog_items.iter().find(|c| c.id == entry.catalog_id) {
                        let val_f64 = if let Some(val) = entry.value_numeric {
                            val.to_f64().unwrap_or(0.0)
                        } else if let Some(val) = entry.value_boolean {
                            if val {
                                1.0
                            } else {
                                0.0
                            }
                        } else {
                            0.0
                        };
                        kpi_values.insert(cat.indicator_name.clone(), val_f64);
                    }
                }
            }
        }

        for name in &ratio_names {
            let val = kpi_values.get(*name).copied().unwrap_or(0.0);
            ctx.set_value(name.to_string(), evalexpr::Value::Float(val))
                .unwrap();
        }

        for cat in &catalog_items {
            let val = kpi_values.get(&cat.indicator_name).copied().unwrap_or(0.0);
            ctx.set_value(cat.indicator_name.clone(), evalexpr::Value::Float(val))
                .unwrap();
        }
    } else {
        for name in &ratio_names {
            ctx.set_value(name.to_string(), evalexpr::Value::Float(100.0))
                .unwrap();
        }
        for cat in &catalog_items {
            ctx.set_value(cat.indicator_name.clone(), evalexpr::Value::Float(100.0))
                .unwrap();
        }
        for code in &raw_account_codes {
            ctx.set_value(format!("ac_{}", code), evalexpr::Value::Float(100.0))
                .unwrap();
        }
    }

    match expr.eval_with_context(&ctx) {
        Ok(v) => {
            let num = match v {
                evalexpr::Value::Float(f) => f,
                evalexpr::Value::Int(i) => i as f64,
                _ => 0.0,
            };
            Ok((
                StatusCode::OK,
                Json(EvaluateKpiResponse {
                    value: num,
                    is_valid: true,
                    error: None,
                }),
            ))
        }
        Err(e) => Ok((
            StatusCode::OK,
            Json(EvaluateKpiResponse {
                value: 0.0,
                is_valid: false,
                error: Some(format!("Evaluation error: {}", e)),
            }),
        )),
    }
}
