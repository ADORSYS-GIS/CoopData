use crate::{
    api::middleware::AuditContext,
    auth::Claims,
    entities::enums::SubmissionStatus,
    error::{AppError, AppResult},
    AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct GetQuestionnaireParams {
    pub questionnaire_type: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SaveQuestionnaireRequest {
    pub questionnaire_type: String, // 'financial' or 'non_financial'
    pub answers: serde_json::Value,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct QuestionnaireResponseDto {
    pub id: Uuid,
    pub submission_id: Uuid,
    pub cooperative_id: Uuid,
    pub questionnaire_type: String,
    pub reporting_year: i32,
    pub answers: serde_json::Value,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

impl From<crate::entities::questionnaire_response::Model> for QuestionnaireResponseDto {
    fn from(m: crate::entities::questionnaire_response::Model) -> Self {
        Self {
            id: m.id,
            submission_id: m.submission_id,
            cooperative_id: m.cooperative_id,
            questionnaire_type: m.questionnaire_type,
            reporting_year: m.reporting_year,
            answers: m.answers,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions/{id}/questionnaire",
    params(
        ("id" = Uuid, Path, description = "Submission ID"),
        GetQuestionnaireParams
    ),
    responses(
        (status = 200, description = "Questionnaire retrieved successfully", body = QuestionnaireResponseDto),
        (status = 404, description = "Submission not found"),
    ),
    tag = "Cooperative"
)]
pub async fn get_questionnaire_response(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(submission_id): Path<Uuid>,
    Query(params): Query<GetQuestionnaireParams>,
) -> AppResult<impl IntoResponse> {
    let sub = state
        .submission_repo
        .find_by_id(submission_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    // Scope check: Cooperative users can only fetch their own submissions
    if claims.has_role("cooperative") {
        let coop_id = state.cooperative_id_from_claims(&claims).await?;
        if sub.cooperative_id != coop_id {
            return Err(AppError::Forbidden(
                "You do not have access to this submission".into(),
            ));
        }
    }

    let response = if let Some(ref q_type) = params.questionnaire_type {
        state
            .questionnaire_repo
            .find_by_submission_and_type(submission_id, q_type)
            .await?
    } else {
        state
            .questionnaire_repo
            .find_by_submission(submission_id)
            .await?
    };

    if let Some(resp) = response {
        Ok((StatusCode::OK, Json(QuestionnaireResponseDto::from(resp))))
    } else {
        // Return empty payload if none exists yet
        let empty = QuestionnaireResponseDto {
            id: Uuid::nil(),
            submission_id,
            cooperative_id: sub.cooperative_id,
            questionnaire_type: params.questionnaire_type.unwrap_or_default(),
            reporting_year: sub.reporting_year,
            answers: serde_json::json!({}),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        Ok((StatusCode::OK, Json(empty)))
    }
}

#[utoipa::path(
    post,
    path = "/api/v1/cooperative/submissions/{id}/questionnaire",
    request_body = SaveQuestionnaireRequest,
    responses(
        (status = 200, description = "Questionnaire saved successfully", body = QuestionnaireResponseDto),
        (status = 400, description = "Bad request - submission is not a draft"),
        (status = 404, description = "Submission not found"),
    ),
    tag = "Cooperative"
)]
pub async fn save_questionnaire_response(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(submission_id): Path<Uuid>,
    Json(body): Json<SaveQuestionnaireRequest>,
) -> AppResult<impl IntoResponse> {
    if body.questionnaire_type != "financial" && body.questionnaire_type != "non_financial" {
        return Err(AppError::BadRequest(
            "Invalid questionnaire type. Must be 'financial' or 'non_financial'".into(),
        ));
    }

    let sub = state
        .submission_repo
        .find_by_id(submission_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if sub.status != SubmissionStatus::Draft {
        return Err(AppError::BadRequest(
            "Cannot edit a submitted/approved questionnaire".into(),
        ));
    }

    // Scope check: Cooperative users can only update their own submissions.
    // Ministry users can also edit questionnaires on behalf of the cooperative.
    if claims.has_role("cooperative") {
        let coop_id = state.cooperative_id_from_claims(&claims).await?;
        if sub.cooperative_id != coop_id {
            return Err(AppError::Forbidden(
                "You do not have access to this submission".into(),
            ));
        }
    } else if !claims.has_role("ministry") {
        return Err(AppError::Forbidden(
            "Only cooperative or ministry roles can save questionnaires".into(),
        ));
    }

    let saved = state
        .questionnaire_repo
        .save_response(
            submission_id,
            sub.cooperative_id,
            body.questionnaire_type.clone(),
            sub.reporting_year,
            body.answers,
        )
        .await?;

    // Mark corresponding sections as ready based on questionnaire type
    if saved.questionnaire_type == "financial" {
        if let Some(section) = state
            .section_repo
            .find_by_submission_and_section(submission_id, "financial")
            .await?
        {
            state
                .section_repo
                .update_status(section.id, "ready")
                .await?;
        }
    } else if saved.questionnaire_type == "non_financial" {
        for sec_key in &["members", "savings", "loans", "fixed_deposits"] {
            if let Some(section) = state
                .section_repo
                .find_by_submission_and_section(submission_id, sec_key)
                .await?
            {
                state
                    .section_repo
                    .update_status(section.id, "ready")
                    .await?;
            }
        }
    }

    // Auto-mark the "questionnaire" section as ready (for basic-tier submissions)
    if let Some(section) = state
        .section_repo
        .find_by_submission_and_section(submission_id, "questionnaire")
        .await?
    {
        state
            .section_repo
            .update_status(section.id, "ready")
            .await?;
    }

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "UPDATE",
            "questionnaire_response",
            Some(&saved.id.to_string()),
            Some(serde_json::json!({
                "submission_id": submission_id,
                "questionnaire_type": saved.questionnaire_type
            })),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    Ok((StatusCode::OK, Json(QuestionnaireResponseDto::from(saved))))
}

// ── Questionnaire Analytics Handler & DTOs ───────────────────────────────────

#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct QuestionnaireAnalyticsParams {
    pub reporting_year: Option<i32>,
    pub region: Option<String>,
    pub sector: Option<String>,
    pub cooperative_id: Option<Uuid>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AgeDemographics {
    pub age_18_25: i32,
    pub age_26_35: i32,
    pub age_36_60: i32,
    pub age_61plus: i32,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct QuestionnaireAnalyticsDetail {
    pub id: Uuid,
    pub cooperative_name: String,
    pub questionnaire_type: String,
    pub reporting_year: i32,
    pub region: String,
    pub total_members: i32,
    pub total_share_capital: f64,
    pub net_income: f64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct QuestionnaireAnalyticsResponse {
    pub total_reporting_cooperatives: i32,
    pub total_registered_members: i32,
    pub total_active_members: i32,
    pub total_members_male: i32,
    pub total_members_female: i32,
    pub total_share_capital: f64,
    pub total_borrowed_funds: f64,
    pub total_savings_value: f64,
    pub total_loans_outstanding: f64,
    pub total_income: f64,
    pub total_expenditure: f64,
    pub total_net_income: f64,
    pub members_by_age: AgeDemographics,
    pub region_counts: std::collections::HashMap<String, i32>,
    pub sector_counts: std::collections::HashMap<String, i32>,
    pub details: Vec<QuestionnaireAnalyticsDetail>,
}

fn get_f64_from_json(json: &serde_json::Value, keys: &[&str]) -> f64 {
    for key in keys {
        if let Some(val) = json.get(key) {
            if let Some(n) = val.as_f64() {
                return n;
            }
            if let Some(s) = val.as_str() {
                if let Ok(n) = s.parse::<f64>() {
                    return n;
                }
            }
            if let Some(i) = val.as_i64() {
                return i as f64;
            }
        }
    }
    0.0
}

fn get_i32_from_json(json: &serde_json::Value, keys: &[&str]) -> i32 {
    get_f64_from_json(json, keys) as i32
}

#[utoipa::path(
    get,
    path = "/api/v1/analytics/questionnaire",
    params(QuestionnaireAnalyticsParams),
    responses(
        (status = 200, description = "Questionnaire aggregated analytics", body = QuestionnaireAnalyticsResponse),
        (status = 401, description = "Unauthorized")
    ),
    tag = "Analytics"
)]
pub async fn get_questionnaire_analytics(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<QuestionnaireAnalyticsParams>,
) -> AppResult<impl IntoResponse> {
    // Scope filtering: ministry sees all; apex/federation are scoped to the
    // cooperatives under them; cooperative users are scoped to their own coop.
    let scoped_cooperative_ids = if claims.has_role("ministry") {
        params.cooperative_id.map(|id| vec![id])
    } else {
        let coop_ids = crate::api::handlers::cooperative::resolve_caller_cooperative_ids(
            &state, &claims,
        )
        .await?;
        Some(coop_ids)
    };

    let responses = state
        .questionnaire_repo
        .find_responses_with_filters(
            params.reporting_year,
            None,
            params.region,
            params.sector,
            scoped_cooperative_ids,
        )
        .await?;

    let mut total_registered_members = 0;
    let mut total_active_members = 0;
    let mut total_members_male = 0;
    let mut total_members_female = 0;
    let mut total_share_capital = 0.0;
    let mut total_borrowed_funds = 0.0;
    let mut total_savings_value = 0.0;
    let mut total_loans_outstanding = 0.0;
    let mut total_income = 0.0;
    let mut total_expenditure = 0.0;
    let mut total_net_income = 0.0;

    let mut age_18_25 = 0;
    let mut age_26_35 = 0;
    let mut age_36_60 = 0;
    let mut age_61plus = 0;

    let mut region_counts = std::collections::HashMap::new();
    let mut sector_counts = std::collections::HashMap::new();
    let mut details = Vec::new();
    let mut coop_ids = std::collections::HashSet::new();

    for (resp, coop) in responses {
        coop_ids.insert(resp.cooperative_id);
        let answers = &resp.answers;

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

        total_members_male += reg_m;
        total_members_female += reg_f;
        total_registered_members += reg_m + reg_f;
        total_active_members += act_m + act_f;

        let share_capital = get_f64_from_json(answers, &["total_share_capital", "share_capital"]);
        let borrowed = get_f64_from_json(answers, &["borrowed_funds_total", "borrowed_funds"]);

        let savings_m = get_f64_from_json(answers, &["savings_value_male", "savings_male"]);
        let savings_f = get_f64_from_json(answers, &["savings_value_female", "savings_female"]);
        let loans_m = get_f64_from_json(answers, &["outstanding_value_male", "loans_male"]);
        let loans_f = get_f64_from_json(answers, &["outstanding_value_female", "loans_female"]);
        let nf_loans_owed = get_f64_from_json(answers, &["amount_owed_by_members"]);

        total_share_capital += share_capital;
        total_borrowed_funds += borrowed;
        total_savings_value += savings_m + savings_f;
        total_loans_outstanding += loans_m + loans_f + nf_loans_owed;

        let inc = get_f64_from_json(answers, &["current_total_income", "total_income"]);
        let exp = get_f64_from_json(answers, &["current_total_expenditure", "total_expenditure"]);
        let net = get_f64_from_json(answers, &["current_net_income", "net_income"]);

        total_income += inc;
        total_expenditure += exp;
        total_net_income += net;

        age_18_25 += get_i32_from_json(
            answers,
            &[
                "age_18_25_male",
                "age_18_25_female",
                "registered_members_18_25",
            ],
        );
        age_26_35 += get_i32_from_json(
            answers,
            &[
                "age_26_35_male",
                "age_26_35_female",
                "registered_members_26_35",
            ],
        );
        age_36_60 += get_i32_from_json(
            answers,
            &[
                "age_36_60_male",
                "age_36_60_female",
                "registered_members_36_60",
            ],
        );
        age_61plus += get_i32_from_json(
            answers,
            &[
                "age_61plus_male",
                "age_61plus_female",
                "registered_members_61plus",
            ],
        );

        let reg_str = coop
            .region
            .as_ref()
            .map(|r| r.as_str().to_string())
            .unwrap_or_else(|| "Unknown".to_string());
        let sec_str = coop
            .sector
            .as_ref()
            .map(|s| s.as_str().to_string())
            .unwrap_or_else(|| "Unknown".to_string());

        *region_counts.entry(reg_str.clone()).or_insert(0) += 1;
        *sector_counts.entry(sec_str.clone()).or_insert(0) += 1;

        details.push(QuestionnaireAnalyticsDetail {
            id: resp.id,
            cooperative_name: coop.name.clone(),
            questionnaire_type: resp.questionnaire_type,
            reporting_year: resp.reporting_year,
            region: reg_str,
            total_members: reg_m + reg_f,
            total_share_capital: share_capital,
            net_income: net,
        });
    }

    let total_reporting = coop_ids.len() as i32;

    let response = QuestionnaireAnalyticsResponse {
        total_reporting_cooperatives: total_reporting,
        total_registered_members,
        total_active_members,
        total_members_male,
        total_members_female,
        total_share_capital,
        total_borrowed_funds,
        total_savings_value,
        total_loans_outstanding,
        total_income,
        total_expenditure,
        total_net_income,
        members_by_age: AgeDemographics {
            age_18_25,
            age_26_35,
            age_36_60,
            age_61plus,
        },
        region_counts,
        sector_counts,
        details,
    };

    Ok((StatusCode::OK, Json(response)))
}
