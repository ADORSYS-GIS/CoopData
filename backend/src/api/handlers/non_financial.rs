use axum::extract::{Extension, Multipart, Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;

use sea_orm::{ActiveModelTrait, Set};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::api::dto::non_financial::*;
use crate::api::middleware::AuditContext;
use crate::auth::claims::Claims;

use crate::entities::{farm_coop, fixed_deposit, loan, member, savings_account, uploaded_file};
use crate::error::{AppError, AppResult};
use crate::services::nf_excel_parser::{NfExcelParser, NfParseWarning};
use crate::AppState;

use crate::api::handlers::cooperative::{
    resolve_caller_cooperative_ids, resolve_cooperative_id_for_nf,
};

const NF_TAG: &str = "Non-Financial";

fn empty_rows_imported() -> RowsImported {
    RowsImported {
        members: 0,
        savings_accounts: 0,
        loans: 0,
        fixed_deposits: 0,
        farm_coop: 0,
    }
}

fn parse_uploaded_by(claims: &Claims) -> Option<Uuid> {
    Uuid::parse_str(&claims.sub).ok()
}

#[utoipa::path(
    post,
    path = "/api/v1/cooperative/non-financial/upload",
    responses(
        (status = 201, description = "Upload processed successfully", body = NfUploadResponse),
        (status = 400, description = "Bad request - missing file, submission_id, or no valid sheets", body = ErrorResponse),
    ),
    tag = NF_TAG,
)]
pub async fn upload_non_financial(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    mut multipart: Multipart,
) -> AppResult<impl IntoResponse> {
    let coop_id = state.cooperative_id_from_claims(&claims).await?;

    let mut file_bytes: Option<Vec<u8>> = None;
    let mut file_name = String::new();
    let mut content_type = String::new();
    let mut submission_id: Option<Uuid> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?
    {
        match field.name() {
            Some("file") => {
                file_name = field.file_name().unwrap_or("upload.xlsx").to_string();
                content_type = field
                    .content_type()
                    .unwrap_or("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    .to_string();
                let bytes = field
                    .bytes()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
                file_bytes = Some(bytes.to_vec());
            }
            Some("submission_id") => {
                let text = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(e.to_string()))?;
                submission_id =
                    Some(Uuid::parse_str(text.trim()).map_err(|e| {
                        AppError::BadRequest(format!("Invalid submission_id: {}", e))
                    })?);
            }
            _ => {}
        }
    }

    let submission_id =
        submission_id.ok_or_else(|| AppError::BadRequest("submission_id is required".into()))?;
    let file_bytes = file_bytes.ok_or_else(|| AppError::BadRequest("file is required".into()))?;
    if !file_name.ends_with(".xlsx") && !file_name.ends_with(".xls") {
        return Err(AppError::BadRequest(
            "File must be an Excel file (.xlsx or .xls)".into(),
        ));
    }

    let existing_files = state
        .uploaded_file_repo
        .find_by_submission_id(submission_id)
        .await?;
    let existing = existing_files.iter().find(|f| f.original_name == file_name);

    if let Some(old) = existing {
        let _ = state.storage.delete_object(&old.storage_key).await;
    }

    let storage_key = format!("nf-uploads/{}/{}", submission_id, file_name);
    state
        .storage
        .put_object(&storage_key, &file_bytes, Some(&content_type))
        .await?;

    let upload_record = if let Some(old) = existing {
        let mut active: uploaded_file::ActiveModel = old.clone().into();
        active.storage_key = Set(storage_key.clone());
        active.size_bytes = Set(Some(file_bytes.len() as i64));
        active.mime_type = Set(Some(content_type.clone()));
        active.created_at = Set(chrono::Utc::now());
        active
            .update(&state.db)
            .await
            .map_err(AppError::DatabaseError)?
    } else {
        let model = uploaded_file::ActiveModel {
            id: Set(Uuid::new_v4()),
            submission_id: Set(submission_id),
            original_name: Set(file_name.clone()),
            mime_type: Set(Some(content_type)),
            storage_key: Set(storage_key.clone()),
            size_bytes: Set(Some(file_bytes.len() as i64)),
            uploaded_by: Set(parse_uploaded_by(&claims)),
            created_at: Set(chrono::Utc::now()),
        };
        state.uploaded_file_repo.create(model).await?
    };

    let parse_result = state
        .nf_excel_parser
        .parse(&file_bytes, Some(state.extractor.clone()))
        .await?;

    if parse_result.sheets_found.is_empty() {
        return Err(AppError::BadRequest(
            "No recognized sheets found. Expected: NF MSHIP, NF S, NF LOANS, NF FS".into(),
        ));
    }

    let mut warnings = parse_result.warnings.clone();

    let db_count = state.member_repo.count_by_cooperative(coop_id).await?;
    if !parse_result.members.is_empty() && parse_result.members.len() as u64 != db_count {
        warnings.push(NfParseWarning {
            sheet: "NF MSHIP".to_string(),
            row: 0,
            column: "member_count".to_string(),
            rule: "MEMBER_COUNT_DRIFT".to_string(),
            message: format!(
                "Parsed {} members but database has {} existing members",
                parse_result.members.len(),
                db_count
            ),
        });
    }

    let rows_parsed = RowsParsed {
        members: parse_result.members.len(),
        savings_accounts: parse_result.savings_accounts.len(),
        loans: parse_result.loans.len(),
        fixed_deposits: parse_result.fixed_deposits.len(),
        farm_coop: parse_result.farm_coop.len(),
    };

    if !parse_result.errors.is_empty() {
        if let Err(e) = state
            .audit
            .log(
                &claims,
                "UPLOAD",
                "non-financial",
                Some(&upload_record.id.to_string()),
                Some(serde_json::json!({
                    "submission_id": submission_id,
                    "errors": parse_result.errors.len(),
                })),
                audit_ctx.ip_address.as_deref(),
                audit_ctx.user_agent.as_deref(),
            )
            .await
        {
            tracing::error!("Failed to log audit: {}", e);
        }

        return Ok((
            StatusCode::CREATED,
            Json(NfUploadResponse {
                upload_id: upload_record.id,
                submission_id,
                sheets_found: parse_result.sheets_found.clone(),
                rows_parsed,
                errors: parse_result.errors.clone(),
                warnings,
                rows_imported: empty_rows_imported(),
            }),
        ));
    }

    let now = chrono::Utc::now();

    // Clear all existing NF data for this submission before re-importing.
    // Order matters: delete child tables before members (FK constraints).
    state
        .savings_account_repo
        .delete_by_cooperative_and_submission(coop_id, submission_id)
        .await?;
    state
        .loan_repo
        .delete_by_cooperative_and_submission(coop_id, submission_id)
        .await?;
    state
        .fixed_deposit_repo
        .delete_by_cooperative_and_submission(coop_id, submission_id)
        .await?;
    state
        .farm_coop_repo
        .delete_by_cooperative_and_submission(coop_id, submission_id)
        .await?;
    state
        .member_repo
        .delete_by_cooperative_and_submission(coop_id, submission_id)
        .await?;

    let mut member_active_models: Vec<member::ActiveModel> = Vec::new();
    for record in &parse_result.members {
        let new_id = Uuid::new_v4();
        member_active_models.push(member::ActiveModel {
            id: Set(new_id),
            cooperative_id: Set(coop_id),
            submission_id: Set(Some(submission_id)),
            member_id: Set(record.member_id.clone()),
            join_date: Set(record.join_date),
            status: Set(record.status.clone()),
            exit_date: Set(record.exit_date),
            gender: Set(record.gender.clone()),
            age_group: Set(record.age_group.clone()),
            region: Set(record.region.clone()),
            urban_rural: Set(record.urban_rural.clone()),
            agm_attendance: Set(record.agm_attendance),
            leadership_role: Set(record.leadership_role.clone()),
            voting_exercised: Set(record.voting_exercised),
            created_at: Set(now),
            updated_at: Set(now),
        });
    }
    let members_imported = if member_active_models.is_empty() {
        0
    } else {
        state.member_repo.bulk_upsert(member_active_models).await?
    };

    let mut member_map: HashMap<String, Uuid> = HashMap::new();
    {
        let (rows, _) = state
            .member_repo
            .find_by_cooperative_id(coop_id, None, 1, 100000)
            .await?;
        for m in &rows {
            member_map.insert(m.member_id.clone(), m.id);
        }
    }

    let mut savings_active_models: Vec<savings_account::ActiveModel> = Vec::new();
    for record in &parse_result.savings_accounts {
        let member_uuid = member_map.get(&record.member_business_id).ok_or_else(|| {
            AppError::ValidationError(format!(
                "Member '{}' not found for savings account '{}'",
                record.member_business_id, record.savings_account_id
            ))
        })?;
        savings_active_models.push(savings_account::ActiveModel {
            id: Set(Uuid::new_v4()),
            cooperative_id: Set(coop_id),
            submission_id: Set(Some(submission_id)),
            member_id: Set(*member_uuid),
            savings_account_id: Set(record.savings_account_id.clone()),
            account_type: Set(record.account_type.clone()),
            account_opening_date: Set(record.account_opening_date),
            account_status: Set(record.account_status.clone()),
            contribution_frequency: Set(record.contribution_frequency.clone()),
            last_contribution_date: Set(record.last_contribution_date.unwrap_or_default()),
            number_of_contributions: Set(record.number_of_contributions),
            balance_trend: Set(record.balance_trend.clone()),
            zero_balance_flag: Set(record.zero_balance_flag),
            withdrawal_frequency_category: Set(record.withdrawal_frequency_category.clone()),
            emergency_withdrawals_flag: Set(record.emergency_withdrawals_flag),
            interest_rate: Set(record.interest_rate),
            balance: Set(record.balance),
            created_at: Set(now),
            updated_at: Set(now),
        });
    }
    let savings_imported = if savings_active_models.is_empty() {
        0
    } else {
        state
            .savings_account_repo
            .bulk_upsert(savings_active_models)
            .await?
    };

    let mut loan_active_models: Vec<loan::ActiveModel> = Vec::new();
    for record in &parse_result.loans {
        let member_uuid = member_map.get(&record.member_business_id).ok_or_else(|| {
            AppError::ValidationError(format!(
                "Member '{}' not found for loan '{}'",
                record.member_business_id, record.loan_id
            ))
        })?;
        loan_active_models.push(loan::ActiveModel {
            id: Set(Uuid::new_v4()),
            cooperative_id: Set(coop_id),
            submission_id: Set(Some(submission_id)),
            member_id: Set(*member_uuid),
            loan_id: Set(record.loan_id.clone()),
            loan_product_type: Set(record.loan_product_type.clone()),
            loan_start_date: Set(record.loan_start_date),
            loan_maturity_date: Set(record.loan_maturity_date),
            loan_status: Set(record.loan_status.clone()),
            borrower_type: Set(record.borrower_type.clone()),
            youth_borrower_flag: Set(record.youth_borrower_flag),
            women_borrower_flag: Set(record.women_borrower_flag),
            rural_borrower_flag: Set(record.rural_borrower_flag),
            repayment_regularity: Set(record.repayment_regularity.clone()),
            days_past_due_category: Set(record.days_past_due_category.clone()),
            missed_installments_count: Set(record.missed_installments_count),
            restructured_loan_flag: Set(record.restructured_loan_flag),
            number_of_restructurings: Set(record.number_of_restructurings),
            early_settlement_flag: Set(record.early_settlement_flag),
            multiple_loans_flag: Set(record.multiple_loans_flag),
            large_borrower_flag: Set(record.large_borrower_flag),
            interest_rate: Set(record.interest_rate),
            balance: Set(record.balance),
            loan_amount: Set(record.loan_amount),
            created_at: Set(now),
            updated_at: Set(now),
        });
    }
    let loans_imported = if loan_active_models.is_empty() {
        0
    } else {
        state.loan_repo.bulk_upsert(loan_active_models).await?
    };

    let mut fd_active_models: Vec<fixed_deposit::ActiveModel> = Vec::new();
    for record in &parse_result.fixed_deposits {
        let member_uuid = member_map.get(&record.member_business_id).ok_or_else(|| {
            AppError::ValidationError(format!(
                "Member '{}' not found for fixed deposit '{}'",
                record.member_business_id, record.fixed_deposit_id
            ))
        })?;
        fd_active_models.push(fixed_deposit::ActiveModel {
            id: Set(Uuid::new_v4()),
            cooperative_id: Set(coop_id),
            submission_id: Set(Some(submission_id)),
            member_id: Set(*member_uuid),
            fixed_deposit_id: Set(record.fixed_deposit_id.clone()),
            deposit_type: Set(record.deposit_type.clone()),
            start_date: Set(record.start_date),
            maturity_date: Set(record.maturity_date),
            status: Set(record.status.clone()),
            tenure_category: Set(record.tenure_category.clone()),
            original_tenure_selected: Set(record.original_tenure_selected.clone()),
            early_withdrawal_flag: Set(record.early_withdrawal_flag),
            rollover_at_maturity_flag: Set(record.rollover_at_maturity_flag),
            number_of_renewals: Set(record.number_of_renewals),
            change_in_tenure_at_renewal: Set(record.change_in_tenure_at_renewal),
            single_depositor_dependency_flag: Set(record.single_depositor_dependency_flag),
            interest_rate: Set(record.interest_rate),
            balance: Set(record.balance),
            created_at: Set(now),
            updated_at: Set(now),
        });
    }
    let fd_imported = if fd_active_models.is_empty() {
        0
    } else {
        state
            .fixed_deposit_repo
            .bulk_upsert(fd_active_models)
            .await?
    };

    let mut farm_coop_active_models: Vec<farm_coop::ActiveModel> = Vec::new();
    for record in &parse_result.farm_coop {
        farm_coop_active_models.push(farm_coop::ActiveModel {
            id: Set(Uuid::new_v4()),
            cooperative_id: Set(coop_id),
            submission_id: Set(Some(submission_id)),
            cooperative_type: Set(record.cooperative_type.clone()),
            primary_activities: Set(record.primary_activities.clone()),
            year_of_establishment: Set(record.year_of_establishment),
            operational_status: Set(record.operational_status.clone()),
            active_producer_flag: Set(record.active_producer_flag),
            production_type: Set(record.production_type.clone()),
            participation_frequency: Set(record.participation_frequency.clone()),
            delivery_compliance: Set(record.delivery_compliance.clone()),
            production_cycle_type: Set(record.production_cycle_type.clone()),
            use_of_production_planning: Set(record.use_of_production_planning),
            use_of_shared_inputs: Set(record.use_of_shared_inputs),
            quality_compliance_flag: Set(record.quality_compliance_flag),
            market_channel_type: Set(record.market_channel_type.clone()),
            formal_offtake_agreement: Set(record.formal_offtake_agreement),
            buyer_concentration_flag: Set(record.buyer_concentration_flag),
            price_predictability_category: Set(record.price_predictability_category.clone()),
            access_to_storage: Set(record.access_to_storage),
            access_to_processing_facilities: Set(record.access_to_processing_facilities),
            transport_coordination: Set(record.transport_coordination.clone()),
            climate_exposure_type: Set(record.climate_exposure_type.clone()),
            irrigation_access: Set(record.irrigation_access),
            climate_mitigation_practices: Set(record.climate_mitigation_practices.clone()),
            created_at: Set(now),
            updated_at: Set(now),
        });
    }
    let farm_coop_imported = state
        .farm_coop_repo
        .bulk_insert(farm_coop_active_models)
        .await?;

    // Mark sections as in_progress when data is imported — user confirms ready manually
    if !parse_result.members.is_empty() {
        if let Some(sec) = state
            .section_repo
            .find_by_submission_and_section(submission_id, "members")
            .await?
        {
            state
                .section_repo
                .update_status(sec.id, "in_progress")
                .await?;
        }
    }
    if !parse_result.savings_accounts.is_empty() {
        if let Some(sec) = state
            .section_repo
            .find_by_submission_and_section(submission_id, "savings")
            .await?
        {
            state
                .section_repo
                .update_status(sec.id, "in_progress")
                .await?;
        }
    }
    if !parse_result.loans.is_empty() {
        if let Some(sec) = state
            .section_repo
            .find_by_submission_and_section(submission_id, "loans")
            .await?
        {
            state
                .section_repo
                .update_status(sec.id, "in_progress")
                .await?;
        }
    }
    if !parse_result.fixed_deposits.is_empty() {
        if let Some(sec) = state
            .section_repo
            .find_by_submission_and_section(submission_id, "fixed_deposits")
            .await?
        {
            state
                .section_repo
                .update_status(sec.id, "in_progress")
                .await?;
        }
    }
    if !parse_result.farm_coop.is_empty() {
        if let Some(sec) = state
            .section_repo
            .find_by_submission_and_section(submission_id, "farm_coop")
            .await?
        {
            state
                .section_repo
                .update_status(sec.id, "in_progress")
                .await?;
        }
    }

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "UPLOAD",
            "non-financial",
            Some(&upload_record.id.to_string()),
            Some(serde_json::json!({
                "submission_id": submission_id,
                "members_imported": members_imported,
                "savings_imported": savings_imported,
                "loans_imported": loans_imported,
                "fixed_deposits_imported": fd_imported,
                "farm_coop_imported": farm_coop_imported,
            })),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    Ok((
        StatusCode::CREATED,
        Json(NfUploadResponse {
            upload_id: upload_record.id,
            submission_id,
            sheets_found: parse_result.sheets_found.clone(),
            rows_parsed,
            errors: parse_result.errors.clone(),
            warnings,
            rows_imported: RowsImported {
                members: members_imported,
                savings_accounts: savings_imported,
                loans: loans_imported,
                fixed_deposits: fd_imported,
                farm_coop: farm_coop_imported,
            },
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/non-financial/members",
    params(NfListQueryParams),
    responses(
        (status = 200, description = "List members", body = NfPaginatedMembersResponse),
    ),
    tag = NF_TAG,
)]
pub async fn list_members(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<NfListQueryParams>,
) -> AppResult<impl IntoResponse> {
    let coop_id = resolve_cooperative_id_for_nf(&state, &claims, params.submission_id).await?;
    let page_size = params.page_size.min(200);
    let (rows, total) = state
        .member_repo
        .find_by_cooperative_id(coop_id, params.submission_id, params.page, page_size)
        .await?;
    let data: Vec<NfMemberResponse> = rows.into_iter().map(Into::into).collect();
    Ok((
        StatusCode::OK,
        Json(NfPaginatedMembersResponse {
            data,
            page: params.page,
            page_size,
            total,
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/non-financial/members/{id}",
    params(("id" = Uuid, Path, description = "Member ID")),
    responses(
        (status = 200, description = "Member found", body = NfMemberResponse),
        (status = 404, description = "Member not found", body = ErrorResponse),
    ),
    tag = NF_TAG,
)]
pub async fn get_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop_ids = resolve_caller_cooperative_ids(&state, &claims).await?;
    let m = state
        .member_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Member not found".into()))?;
    if !coop_ids.contains(&m.cooperative_id) {
        return Err(AppError::NotFound("Member not found".into()));
    }
    Ok((StatusCode::OK, Json(NfMemberResponse::from(m))))
}

#[utoipa::path(
    post,
    path = "/api/v1/cooperative/non-financial/members",
    request_body = NfCreateMemberRequest,
    responses(
        (status = 201, description = "Member created", body = NfMemberResponse),
        (status = 400, description = "Validation error", body = ErrorResponse),
        (status = 409, description = "Conflict - member_id already exists", body = ErrorResponse),
    ),
    tag = NF_TAG,
)]
pub async fn create_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<NfCreateMemberRequest>,
) -> AppResult<impl IntoResponse> {
    let coop_id = state.cooperative_id_from_claims(&claims).await?;
    let now = chrono::Utc::now();
    let active_model = member::ActiveModel {
        id: Set(Uuid::new_v4()),
        cooperative_id: Set(coop_id),
        submission_id: Set(body.submission_id),
        member_id: Set(body.member_id),
        join_date: Set(body.join_date),
        status: Set(body.status),
        exit_date: Set(body.exit_date),
        gender: Set(body.gender),
        age_group: Set(body.age_group),
        region: Set(body.region),
        urban_rural: Set(body.urban_rural),
        agm_attendance: Set(body.agm_attendance),
        leadership_role: Set(body.leadership_role),
        voting_exercised: Set(body.voting_exercised),
        created_at: Set(now),
        updated_at: Set(now),
    };
    let m = state.member_repo.create(active_model).await?;
    if let Err(e) = state
        .audit
        .log(
            &claims,
            "CREATE",
            "member",
            Some(&m.id.to_string()),
            Some(serde_json::json!({"member_id": &m.member_id})),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }
    Ok((StatusCode::CREATED, Json(NfMemberResponse::from(m))))
}

#[utoipa::path(
    put,
    path = "/api/v1/cooperative/non-financial/members/{id}",
    params(("id" = Uuid, Path, description = "Member ID")),
    request_body = NfUpdateMemberRequest,
    responses(
        (status = 200, description = "Member updated", body = NfMemberResponse),
        (status = 404, description = "Member not found", body = ErrorResponse),
    ),
    tag = NF_TAG,
)]
pub async fn update_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<Uuid>,
    Json(body): Json<NfUpdateMemberRequest>,
) -> AppResult<impl IntoResponse> {
    let coop_id = state.cooperative_id_from_claims(&claims).await?;
    let existing = state
        .member_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Member not found".into()))?;
    if existing.cooperative_id != coop_id {
        return Err(AppError::NotFound("Member not found".into()));
    }
    let mut active: member::ActiveModel = existing.into();
    if let Some(v) = body.join_date {
        active.join_date = Set(v);
    }
    if let Some(v) = body.status {
        active.status = Set(v);
    }
    if let Some(v) = body.exit_date {
        active.exit_date = Set(v);
    }
    if let Some(v) = body.gender {
        active.gender = Set(v);
    }
    if let Some(v) = body.age_group {
        active.age_group = Set(v);
    }
    if let Some(v) = body.region {
        active.region = Set(v);
    }
    if let Some(v) = body.urban_rural {
        active.urban_rural = Set(v);
    }
    if let Some(v) = body.agm_attendance {
        active.agm_attendance = Set(v);
    }
    if let Some(v) = body.leadership_role {
        active.leadership_role = Set(v);
    }
    if let Some(v) = body.voting_exercised {
        active.voting_exercised = Set(v);
    }
    if let Some(v) = body.submission_id {
        active.submission_id = Set(v);
    }
    active.updated_at = Set(chrono::Utc::now());
    let m = state.member_repo.update(active).await?;
    if let Err(e) = state
        .audit
        .log(
            &claims,
            "UPDATE",
            "member",
            Some(&m.id.to_string()),
            None,
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }
    Ok((StatusCode::OK, Json(NfMemberResponse::from(m))))
}

#[utoipa::path(
    delete,
    path = "/api/v1/cooperative/non-financial/members/{id}",
    params(("id" = Uuid, Path, description = "Member ID")),
    responses(
        (status = 204, description = "Member deleted"),
        (status = 404, description = "Member not found", body = ErrorResponse),
    ),
    tag = NF_TAG,
)]
pub async fn delete_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop_id = state.cooperative_id_from_claims(&claims).await?;
    let existing = state
        .member_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Member not found".into()))?;
    if existing.cooperative_id != coop_id {
        return Err(AppError::NotFound("Member not found".into()));
    }
    state.member_repo.delete(id).await?;
    if let Err(e) = state
        .audit
        .log(
            &claims,
            "DELETE",
            "member",
            Some(&id.to_string()),
            None,
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/non-financial/savings",
    params(NfListQueryParams),
    responses(
        (status = 200, description = "List savings accounts", body = PaginatedSavingsAccountsResponse),
    ),
    tag = NF_TAG,
)]
pub async fn list_savings_accounts(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<NfListQueryParams>,
) -> AppResult<impl IntoResponse> {
    let coop_id = resolve_cooperative_id_for_nf(&state, &claims, params.submission_id).await?;
    let page_size = params.page_size.min(200);
    let (rows, total) = state
        .savings_account_repo
        .find_by_cooperative_id(coop_id, params.submission_id, params.page, page_size)
        .await?;
    let data: Vec<SavingsAccountResponse> = rows.into_iter().map(Into::into).collect();
    Ok((
        StatusCode::OK,
        Json(PaginatedSavingsAccountsResponse {
            data,
            page: params.page,
            page_size,
            total,
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/non-financial/savings/{id}",
    params(("id" = Uuid, Path, description = "Savings Account ID")),
    responses(
        (status = 200, description = "Savings account found", body = SavingsAccountResponse),
        (status = 404, description = "Not found", body = ErrorResponse),
    ),
    tag = NF_TAG,
)]
pub async fn get_savings_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop_ids = resolve_caller_cooperative_ids(&state, &claims).await?;
    let m = state
        .savings_account_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Savings account not found".into()))?;
    if !coop_ids.contains(&m.cooperative_id) {
        return Err(AppError::NotFound("Savings account not found".into()));
    }
    Ok((StatusCode::OK, Json(SavingsAccountResponse::from(m))))
}

#[utoipa::path(
    post,
    path = "/api/v1/cooperative/non-financial/savings",
    request_body = CreateSavingsAccountRequest,
    responses(
        (status = 201, description = "Savings account created", body = SavingsAccountResponse),
        (status = 400, description = "Validation error", body = ErrorResponse),
    ),
    tag = NF_TAG,
)]
pub async fn create_savings_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<CreateSavingsAccountRequest>,
) -> AppResult<impl IntoResponse> {
    let coop_id = state.cooperative_id_from_claims(&claims).await?;
    let member = state
        .member_repo
        .find_by_id(body.member_id)
        .await?
        .ok_or_else(|| AppError::BadRequest("Member not found".into()))?;
    if member.cooperative_id != coop_id {
        return Err(AppError::BadRequest(
            "Member does not belong to this cooperative".into(),
        ));
    }
    let now = chrono::Utc::now();
    let active_model = savings_account::ActiveModel {
        id: Set(Uuid::new_v4()),
        cooperative_id: Set(coop_id),
        submission_id: Set(body.submission_id),
        member_id: Set(body.member_id),
        savings_account_id: Set(body.savings_account_id),
        account_type: Set(body.account_type),
        account_opening_date: Set(body.account_opening_date),
        account_status: Set(body.account_status),
        contribution_frequency: Set(body.contribution_frequency),
        last_contribution_date: Set(body.last_contribution_date.unwrap_or_default()),
        number_of_contributions: Set(body.number_of_contributions),
        balance_trend: Set(body.balance_trend),
        zero_balance_flag: Set(body.zero_balance_flag),
        withdrawal_frequency_category: Set(body.withdrawal_frequency_category),
        emergency_withdrawals_flag: Set(body.emergency_withdrawals_flag),
        interest_rate: Set(body.interest_rate),
        balance: Set(body.balance),
        created_at: Set(now),
        updated_at: Set(now),
    };
    let m = state.savings_account_repo.create(active_model).await?;
    if let Err(e) = state
        .audit
        .log(
            &claims,
            "CREATE",
            "savings_account",
            Some(&m.id.to_string()),
            None,
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }
    Ok((StatusCode::CREATED, Json(SavingsAccountResponse::from(m))))
}

#[utoipa::path(
    put,
    path = "/api/v1/cooperative/non-financial/savings/{id}",
    params(("id" = Uuid, Path, description = "Savings Account ID")),
    request_body = UpdateSavingsAccountRequest,
    responses(
        (status = 200, description = "Savings account updated", body = SavingsAccountResponse),
        (status = 404, description = "Not found", body = ErrorResponse),
    ),
    tag = NF_TAG,
)]
pub async fn update_savings_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateSavingsAccountRequest>,
) -> AppResult<impl IntoResponse> {
    let coop_id = state.cooperative_id_from_claims(&claims).await?;
    let existing = state
        .savings_account_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Savings account not found".into()))?;
    if existing.cooperative_id != coop_id {
        return Err(AppError::NotFound("Savings account not found".into()));
    }
    let mut active: savings_account::ActiveModel = existing.into();
    if let Some(v) = body.account_type {
        active.account_type = Set(v);
    }
    if let Some(v) = body.account_status {
        active.account_status = Set(v);
    }
    if let Some(v) = body.contribution_frequency {
        active.contribution_frequency = Set(v);
    }
    if let Some(v) = body.last_contribution_date {
        active.last_contribution_date = Set(v.unwrap_or_default());
    }
    if let Some(v) = body.number_of_contributions {
        active.number_of_contributions = Set(v);
    }
    if let Some(v) = body.balance_trend {
        active.balance_trend = Set(v);
    }
    if let Some(v) = body.zero_balance_flag {
        active.zero_balance_flag = Set(v);
    }
    if let Some(v) = body.withdrawal_frequency_category {
        active.withdrawal_frequency_category = Set(v);
    }
    if let Some(v) = body.emergency_withdrawals_flag {
        active.emergency_withdrawals_flag = Set(v);
    }
    if let Some(v) = body.interest_rate {
        active.interest_rate = Set(v);
    }
    if let Some(v) = body.balance {
        active.balance = Set(v);
    }
    if let Some(v) = body.submission_id {
        active.submission_id = Set(v);
    }
    active.updated_at = Set(chrono::Utc::now());
    let m = state.savings_account_repo.update(active).await?;
    if let Err(e) = state
        .audit
        .log(
            &claims,
            "UPDATE",
            "savings_account",
            Some(&m.id.to_string()),
            None,
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }
    Ok((StatusCode::OK, Json(SavingsAccountResponse::from(m))))
}

#[utoipa::path(
    delete,
    path = "/api/v1/cooperative/non-financial/savings/{id}",
    params(("id" = Uuid, Path, description = "Savings Account ID")),
    responses(
        (status = 204, description = "Savings account deleted"),
        (status = 404, description = "Not found", body = ErrorResponse),
    ),
    tag = NF_TAG,
)]
pub async fn delete_savings_account(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop_id = state.cooperative_id_from_claims(&claims).await?;
    let existing = state
        .savings_account_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Savings account not found".into()))?;
    if existing.cooperative_id != coop_id {
        return Err(AppError::NotFound("Savings account not found".into()));
    }
    state.savings_account_repo.delete(id).await?;
    if let Err(e) = state
        .audit
        .log(
            &claims,
            "DELETE",
            "savings_account",
            Some(&id.to_string()),
            None,
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/non-financial/loans",
    params(NfListQueryParams),
    responses(
        (status = 200, description = "List loans", body = PaginatedLoansResponse),
    ),
    tag = NF_TAG,
)]
pub async fn list_loans(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<NfListQueryParams>,
) -> AppResult<impl IntoResponse> {
    let coop_id = resolve_cooperative_id_for_nf(&state, &claims, params.submission_id).await?;
    let page_size = params.page_size.min(200);
    let (rows, total) = state
        .loan_repo
        .find_by_cooperative_id(coop_id, params.submission_id, params.page, page_size)
        .await?;
    let data: Vec<LoanResponse> = rows.into_iter().map(Into::into).collect();
    Ok((
        StatusCode::OK,
        Json(PaginatedLoansResponse {
            data,
            page: params.page,
            page_size,
            total,
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/non-financial/loans/{id}",
    params(("id" = Uuid, Path, description = "Loan ID")),
    responses(
        (status = 200, description = "Loan found", body = LoanResponse),
        (status = 404, description = "Not found", body = ErrorResponse),
    ),
    tag = NF_TAG,
)]
pub async fn get_loan(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop_ids = resolve_caller_cooperative_ids(&state, &claims).await?;
    let m = state
        .loan_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Loan not found".into()))?;
    if !coop_ids.contains(&m.cooperative_id) {
        return Err(AppError::NotFound("Loan not found".into()));
    }
    Ok((StatusCode::OK, Json(LoanResponse::from(m))))
}

#[utoipa::path(
    post,
    path = "/api/v1/cooperative/non-financial/loans",
    request_body = CreateLoanRequest,
    responses(
        (status = 201, description = "Loan created", body = LoanResponse),
        (status = 400, description = "Validation error", body = ErrorResponse),
    ),
    tag = NF_TAG,
)]
pub async fn create_loan(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<CreateLoanRequest>,
) -> AppResult<impl IntoResponse> {
    let coop_id = state.cooperative_id_from_claims(&claims).await?;
    let member = state
        .member_repo
        .find_by_id(body.member_id)
        .await?
        .ok_or_else(|| AppError::BadRequest("Member not found".into()))?;
    if member.cooperative_id != coop_id {
        return Err(AppError::BadRequest(
            "Member does not belong to this cooperative".into(),
        ));
    }
    let now = chrono::Utc::now();
    let active_model = loan::ActiveModel {
        id: Set(Uuid::new_v4()),
        cooperative_id: Set(coop_id),
        submission_id: Set(body.submission_id),
        member_id: Set(body.member_id),
        loan_id: Set(body.loan_id),
        loan_product_type: Set(body.loan_product_type),
        loan_start_date: Set(body.loan_start_date),
        loan_maturity_date: Set(body.loan_maturity_date),
        loan_status: Set(body.loan_status),
        borrower_type: Set(body.borrower_type),
        youth_borrower_flag: Set(body.youth_borrower_flag),
        women_borrower_flag: Set(body.women_borrower_flag),
        rural_borrower_flag: Set(body.rural_borrower_flag),
        repayment_regularity: Set(body.repayment_regularity),
        days_past_due_category: Set(body.days_past_due_category),
        missed_installments_count: Set(body.missed_installments_count),
        restructured_loan_flag: Set(body.restructured_loan_flag),
        number_of_restructurings: Set(body.number_of_restructurings),
        early_settlement_flag: Set(body.early_settlement_flag),
        multiple_loans_flag: Set(body.multiple_loans_flag),
        large_borrower_flag: Set(body.large_borrower_flag),
        interest_rate: Set(body.interest_rate),
        balance: Set(body.balance),
        loan_amount: Set(body.loan_amount),
        created_at: Set(now),
        updated_at: Set(now),
    };
    let m = state.loan_repo.create(active_model).await?;
    if let Err(e) = state
        .audit
        .log(
            &claims,
            "CREATE",
            "loan",
            Some(&m.id.to_string()),
            None,
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }
    Ok((StatusCode::CREATED, Json(LoanResponse::from(m))))
}

#[utoipa::path(
    put,
    path = "/api/v1/cooperative/non-financial/loans/{id}",
    params(("id" = Uuid, Path, description = "Loan ID")),
    request_body = UpdateLoanRequest,
    responses(
        (status = 200, description = "Loan updated", body = LoanResponse),
        (status = 404, description = "Not found", body = ErrorResponse),
    ),
    tag = NF_TAG,
)]
pub async fn update_loan(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateLoanRequest>,
) -> AppResult<impl IntoResponse> {
    let coop_id = state.cooperative_id_from_claims(&claims).await?;
    let existing = state
        .loan_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Loan not found".into()))?;
    if existing.cooperative_id != coop_id {
        return Err(AppError::NotFound("Loan not found".into()));
    }
    let mut active: loan::ActiveModel = existing.into();
    if let Some(v) = body.loan_product_type {
        active.loan_product_type = Set(v);
    }
    if let Some(v) = body.loan_start_date {
        active.loan_start_date = Set(v);
    }
    if let Some(v) = body.loan_maturity_date {
        active.loan_maturity_date = Set(v);
    }
    if let Some(v) = body.loan_status {
        active.loan_status = Set(v);
    }
    if let Some(v) = body.borrower_type {
        active.borrower_type = Set(v);
    }
    if let Some(v) = body.youth_borrower_flag {
        active.youth_borrower_flag = Set(v);
    }
    if let Some(v) = body.women_borrower_flag {
        active.women_borrower_flag = Set(v);
    }
    if let Some(v) = body.rural_borrower_flag {
        active.rural_borrower_flag = Set(v);
    }
    if let Some(v) = body.repayment_regularity {
        active.repayment_regularity = Set(v);
    }
    if let Some(v) = body.days_past_due_category {
        active.days_past_due_category = Set(v);
    }
    if let Some(v) = body.missed_installments_count {
        active.missed_installments_count = Set(v);
    }
    if let Some(v) = body.restructured_loan_flag {
        active.restructured_loan_flag = Set(v);
    }
    if let Some(v) = body.number_of_restructurings {
        active.number_of_restructurings = Set(v);
    }
    if let Some(v) = body.early_settlement_flag {
        active.early_settlement_flag = Set(v);
    }
    if let Some(v) = body.multiple_loans_flag {
        active.multiple_loans_flag = Set(v);
    }
    if let Some(v) = body.large_borrower_flag {
        active.large_borrower_flag = Set(v);
    }
    if let Some(v) = body.interest_rate {
        active.interest_rate = Set(v);
    }
    if let Some(v) = body.balance {
        active.balance = Set(v);
    }
    if let Some(v) = body.loan_amount {
        active.loan_amount = Set(v);
    }
    if let Some(v) = body.submission_id {
        active.submission_id = Set(v);
    }
    active.updated_at = Set(chrono::Utc::now());
    let m = state.loan_repo.update(active).await?;
    if let Err(e) = state
        .audit
        .log(
            &claims,
            "UPDATE",
            "loan",
            Some(&m.id.to_string()),
            None,
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }
    Ok((StatusCode::OK, Json(LoanResponse::from(m))))
}

#[utoipa::path(
    delete,
    path = "/api/v1/cooperative/non-financial/loans/{id}",
    params(("id" = Uuid, Path, description = "Loan ID")),
    responses(
        (status = 204, description = "Loan deleted"),
        (status = 404, description = "Not found", body = ErrorResponse),
    ),
    tag = NF_TAG,
)]
pub async fn delete_loan(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop_id = state.cooperative_id_from_claims(&claims).await?;
    let existing = state
        .loan_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Loan not found".into()))?;
    if existing.cooperative_id != coop_id {
        return Err(AppError::NotFound("Loan not found".into()));
    }
    state.loan_repo.delete(id).await?;
    if let Err(e) = state
        .audit
        .log(
            &claims,
            "DELETE",
            "loan",
            Some(&id.to_string()),
            None,
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/non-financial/fixed-deposits",
    params(NfListQueryParams),
    responses(
        (status = 200, description = "List fixed deposits", body = PaginatedFixedDepositsResponse),
    ),
    tag = NF_TAG,
)]
pub async fn list_fixed_deposits(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<NfListQueryParams>,
) -> AppResult<impl IntoResponse> {
    let coop_id = resolve_cooperative_id_for_nf(&state, &claims, params.submission_id).await?;
    let page_size = params.page_size.min(200);
    let (rows, total) = state
        .fixed_deposit_repo
        .find_by_cooperative_id(coop_id, params.submission_id, params.page, page_size)
        .await?;
    let data: Vec<FixedDepositResponse> = rows.into_iter().map(Into::into).collect();
    Ok((
        StatusCode::OK,
        Json(PaginatedFixedDepositsResponse {
            data,
            page: params.page,
            page_size,
            total,
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/non-financial/fixed-deposits/{id}",
    params(("id" = Uuid, Path, description = "Fixed Deposit ID")),
    responses(
        (status = 200, description = "Fixed deposit found", body = FixedDepositResponse),
        (status = 404, description = "Not found", body = ErrorResponse),
    ),
    tag = NF_TAG,
)]
pub async fn get_fixed_deposit(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop_ids = resolve_caller_cooperative_ids(&state, &claims).await?;
    let m = state
        .fixed_deposit_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Fixed deposit not found".into()))?;
    if !coop_ids.contains(&m.cooperative_id) {
        return Err(AppError::NotFound("Fixed deposit not found".into()));
    }
    Ok((StatusCode::OK, Json(FixedDepositResponse::from(m))))
}

#[utoipa::path(
    post,
    path = "/api/v1/cooperative/non-financial/fixed-deposits",
    request_body = CreateFixedDepositRequest,
    responses(
        (status = 201, description = "Fixed deposit created", body = FixedDepositResponse),
        (status = 400, description = "Validation error", body = ErrorResponse),
    ),
    tag = NF_TAG,
)]
pub async fn create_fixed_deposit(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<CreateFixedDepositRequest>,
) -> AppResult<impl IntoResponse> {
    let coop_id = state.cooperative_id_from_claims(&claims).await?;
    let member = state
        .member_repo
        .find_by_id(body.member_id)
        .await?
        .ok_or_else(|| AppError::BadRequest("Member not found".into()))?;
    if member.cooperative_id != coop_id {
        return Err(AppError::BadRequest(
            "Member does not belong to this cooperative".into(),
        ));
    }
    let now = chrono::Utc::now();
    let active_model = fixed_deposit::ActiveModel {
        id: Set(Uuid::new_v4()),
        cooperative_id: Set(coop_id),
        submission_id: Set(body.submission_id),
        member_id: Set(body.member_id),
        fixed_deposit_id: Set(body.fixed_deposit_id),
        deposit_type: Set(body.deposit_type),
        start_date: Set(body.start_date),
        maturity_date: Set(body.maturity_date),
        status: Set(body.status),
        tenure_category: Set(body.tenure_category),
        original_tenure_selected: Set(body.original_tenure_selected),
        early_withdrawal_flag: Set(body.early_withdrawal_flag),
        rollover_at_maturity_flag: Set(body.rollover_at_maturity_flag),
        number_of_renewals: Set(body.number_of_renewals),
        change_in_tenure_at_renewal: Set(body.change_in_tenure_at_renewal),
        single_depositor_dependency_flag: Set(body.single_depositor_dependency_flag),
        interest_rate: Set(body.interest_rate),
        balance: Set(body.balance),
        created_at: Set(now),
        updated_at: Set(now),
    };
    let m = state.fixed_deposit_repo.create(active_model).await?;
    if let Err(e) = state
        .audit
        .log(
            &claims,
            "CREATE",
            "fixed_deposit",
            Some(&m.id.to_string()),
            None,
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }
    Ok((StatusCode::CREATED, Json(FixedDepositResponse::from(m))))
}

#[utoipa::path(
    put,
    path = "/api/v1/cooperative/non-financial/fixed-deposits/{id}",
    params(("id" = Uuid, Path, description = "Fixed Deposit ID")),
    request_body = UpdateFixedDepositRequest,
    responses(
        (status = 200, description = "Fixed deposit updated", body = FixedDepositResponse),
        (status = 404, description = "Not found", body = ErrorResponse),
    ),
    tag = NF_TAG,
)]
pub async fn update_fixed_deposit(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateFixedDepositRequest>,
) -> AppResult<impl IntoResponse> {
    let coop_id = state.cooperative_id_from_claims(&claims).await?;
    let existing = state
        .fixed_deposit_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Fixed deposit not found".into()))?;
    if existing.cooperative_id != coop_id {
        return Err(AppError::NotFound("Fixed deposit not found".into()));
    }
    let mut active: fixed_deposit::ActiveModel = existing.into();
    if let Some(v) = body.deposit_type {
        active.deposit_type = Set(v);
    }
    if let Some(v) = body.start_date {
        active.start_date = Set(v);
    }
    if let Some(v) = body.maturity_date {
        active.maturity_date = Set(v);
    }
    if let Some(v) = body.status {
        active.status = Set(v);
    }
    if let Some(v) = body.tenure_category {
        active.tenure_category = Set(v);
    }
    if let Some(v) = body.original_tenure_selected {
        active.original_tenure_selected = Set(v);
    }
    if let Some(v) = body.early_withdrawal_flag {
        active.early_withdrawal_flag = Set(v);
    }
    if let Some(v) = body.rollover_at_maturity_flag {
        active.rollover_at_maturity_flag = Set(v);
    }
    if let Some(v) = body.number_of_renewals {
        active.number_of_renewals = Set(v);
    }
    if let Some(v) = body.change_in_tenure_at_renewal {
        active.change_in_tenure_at_renewal = Set(v);
    }
    if let Some(v) = body.single_depositor_dependency_flag {
        active.single_depositor_dependency_flag = Set(v);
    }
    if let Some(v) = body.interest_rate {
        active.interest_rate = Set(v);
    }
    if let Some(v) = body.balance {
        active.balance = Set(v);
    }
    if let Some(v) = body.submission_id {
        active.submission_id = Set(v);
    }
    active.updated_at = Set(chrono::Utc::now());
    let m = state.fixed_deposit_repo.update(active).await?;
    if let Err(e) = state
        .audit
        .log(
            &claims,
            "UPDATE",
            "fixed_deposit",
            Some(&m.id.to_string()),
            None,
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }
    Ok((StatusCode::OK, Json(FixedDepositResponse::from(m))))
}

#[utoipa::path(
    delete,
    path = "/api/v1/cooperative/non-financial/fixed-deposits/{id}",
    params(("id" = Uuid, Path, description = "Fixed Deposit ID")),
    responses(
        (status = 204, description = "Fixed deposit deleted"),
        (status = 404, description = "Not found", body = ErrorResponse),
    ),
    tag = NF_TAG,
)]
pub async fn delete_fixed_deposit(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop_id = state.cooperative_id_from_claims(&claims).await?;
    let existing = state
        .fixed_deposit_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Fixed deposit not found".into()))?;
    if existing.cooperative_id != coop_id {
        return Err(AppError::NotFound("Fixed deposit not found".into()));
    }
    state.fixed_deposit_repo.delete(id).await?;
    if let Err(e) = state
        .audit
        .log(
            &claims,
            "DELETE",
            "fixed_deposit",
            Some(&id.to_string()),
            None,
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_rows_imported() {
        let r = empty_rows_imported();
        assert_eq!(r.members, 0);
        assert_eq!(r.savings_accounts, 0);
        assert_eq!(r.loans, 0);
        assert_eq!(r.fixed_deposits, 0);
        assert_eq!(r.farm_coop, 0);
    }

    #[test]
    fn test_parse_uploaded_by_invalid_uuid() {
        let claims = Claims {
            sub: "not-a-uuid".to_string(),
            exp: 0,
            iat: 0,
            iss: String::new(),
            aud: None,
            preferred_username: None,
            email: None,
            email_verified: None,
            realm_access: None,
            resource_access: None,
            organization: None,
            cooperation: None,
            assigned_dimensions: None,
            name: None,
        };
        assert!(parse_uploaded_by(&claims).is_none());
    }

    #[test]
    fn test_parse_uploaded_by_valid_uuid() {
        let uuid = Uuid::new_v4();
        let claims = Claims {
            sub: uuid.to_string(),
            exp: 0,
            iat: 0,
            iss: String::new(),
            aud: None,
            preferred_username: None,
            email: None,
            email_verified: None,
            realm_access: None,
            resource_access: None,
            organization: None,
            cooperation: None,
            assigned_dimensions: None,
            name: None,
        };
        assert_eq!(parse_uploaded_by(&claims), Some(uuid));
    }
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/non-financial/farm-coop",
    params(NfListQueryParams),
    responses(
        (status = 200, description = "List farm coop records", body = PaginatedFarmCoopResponse),
    ),
    tag = NF_TAG,
)]
pub async fn list_farm_coop(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<NfListQueryParams>,
) -> AppResult<impl IntoResponse> {
    let coop_id = resolve_cooperative_id_for_nf(&state, &claims, params.submission_id).await?;
    let page_size = params.page_size.min(200);
    let (rows, total) = state
        .farm_coop_repo
        .find_by_cooperative_id(coop_id, params.submission_id, params.page, page_size)
        .await?;
    let data: Vec<FarmCoopResponse> = rows.into_iter().map(FarmCoopResponse::from).collect();
    Ok((
        StatusCode::OK,
        Json(PaginatedFarmCoopResponse {
            data,
            page: params.page,
            page_size,
            total,
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/non-financial/farm-coop/{id}",
    params(("id" = Uuid, Path, description = "Farm coop record ID")),
    responses(
        (status = 200, description = "Farm coop record", body = FarmCoopResponse),
        (status = 404, description = "Not found", body = ErrorResponse),
    ),
    tag = NF_TAG,
)]
pub async fn get_farm_coop(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop_ids = resolve_caller_cooperative_ids(&state, &claims).await?;
    let record = state
        .farm_coop_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Farm coop record not found".into()))?;
    if !coop_ids.contains(&record.cooperative_id) {
        return Err(AppError::NotFound("Farm coop record not found".into()));
    }
    Ok((StatusCode::OK, Json(FarmCoopResponse::from(record))))
}

#[utoipa::path(
    post,
    path = "/api/v1/cooperative/non-financial/farm-coop",
    request_body = CreateFarmCoopRequest,
    responses(
        (status = 201, description = "Farm coop record created", body = FarmCoopResponse),
    ),
    tag = NF_TAG,
)]
pub async fn create_farm_coop(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<CreateFarmCoopRequest>,
) -> AppResult<impl IntoResponse> {
    let coop_id = state.cooperative_id_from_claims(&claims).await?;
    let now = chrono::Utc::now();
    let active = farm_coop::ActiveModel {
        id: Set(Uuid::new_v4()),
        cooperative_id: Set(coop_id),
        submission_id: Set(body.submission_id),
        cooperative_type: Set(body.cooperative_type),
        primary_activities: Set(body.primary_activities),
        year_of_establishment: Set(body.year_of_establishment),
        operational_status: Set(body.operational_status),
        active_producer_flag: Set(body.active_producer_flag),
        production_type: Set(body.production_type),
        participation_frequency: Set(body.participation_frequency),
        delivery_compliance: Set(body.delivery_compliance),
        production_cycle_type: Set(body.production_cycle_type),
        use_of_production_planning: Set(body.use_of_production_planning),
        use_of_shared_inputs: Set(body.use_of_shared_inputs),
        quality_compliance_flag: Set(body.quality_compliance_flag),
        market_channel_type: Set(body.market_channel_type),
        formal_offtake_agreement: Set(body.formal_offtake_agreement),
        buyer_concentration_flag: Set(body.buyer_concentration_flag),
        price_predictability_category: Set(body.price_predictability_category),
        access_to_storage: Set(body.access_to_storage),
        access_to_processing_facilities: Set(body.access_to_processing_facilities),
        transport_coordination: Set(body.transport_coordination),
        climate_exposure_type: Set(body.climate_exposure_type),
        irrigation_access: Set(body.irrigation_access),
        climate_mitigation_practices: Set(body.climate_mitigation_practices),
        created_at: Set(now),
        updated_at: Set(now),
    };
    let m = state.farm_coop_repo.create(active).await?;
    if let Err(e) = state
        .audit
        .log(
            &claims,
            "CREATE",
            "farm_coop",
            Some(&m.id.to_string()),
            Some(serde_json::json!({"cooperative_id": &coop_id})),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }
    tracing::info!(cooperative_id = %coop_id, "Farm coop record created");
    Ok((StatusCode::CREATED, Json(FarmCoopResponse::from(m))))
}

#[utoipa::path(
    put,
    path = "/api/v1/cooperative/non-financial/farm-coop/{id}",
    params(("id" = Uuid, Path, description = "Farm coop record ID")),
    request_body = UpdateFarmCoopRequest,
    responses(
        (status = 200, description = "Farm coop record updated", body = FarmCoopResponse),
        (status = 404, description = "Not found", body = ErrorResponse),
    ),
    tag = NF_TAG,
)]
pub async fn update_farm_coop(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateFarmCoopRequest>,
) -> AppResult<impl IntoResponse> {
    let coop_id = state.cooperative_id_from_claims(&claims).await?;
    let existing = state
        .farm_coop_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Farm coop record not found".into()))?;
    if existing.cooperative_id != coop_id {
        return Err(AppError::NotFound("Farm coop record not found".into()));
    }
    let mut active: farm_coop::ActiveModel = existing.into();
    if let Some(v) = body.cooperative_type {
        active.cooperative_type = Set(v);
    }
    if let Some(v) = body.primary_activities {
        active.primary_activities = Set(v);
    }
    if let Some(v) = body.year_of_establishment {
        active.year_of_establishment = Set(Some(v));
    }
    if let Some(v) = body.operational_status {
        active.operational_status = Set(v);
    }
    if let Some(v) = body.active_producer_flag {
        active.active_producer_flag = Set(v);
    }
    if let Some(v) = body.production_type {
        active.production_type = Set(v);
    }
    if let Some(v) = body.participation_frequency {
        active.participation_frequency = Set(v);
    }
    if let Some(v) = body.delivery_compliance {
        active.delivery_compliance = Set(v);
    }
    if let Some(v) = body.production_cycle_type {
        active.production_cycle_type = Set(v);
    }
    if let Some(v) = body.use_of_production_planning {
        active.use_of_production_planning = Set(v);
    }
    if let Some(v) = body.use_of_shared_inputs {
        active.use_of_shared_inputs = Set(v);
    }
    if let Some(v) = body.quality_compliance_flag {
        active.quality_compliance_flag = Set(v);
    }
    if let Some(v) = body.market_channel_type {
        active.market_channel_type = Set(v);
    }
    if let Some(v) = body.formal_offtake_agreement {
        active.formal_offtake_agreement = Set(v);
    }
    if let Some(v) = body.buyer_concentration_flag {
        active.buyer_concentration_flag = Set(v);
    }
    if let Some(v) = body.price_predictability_category {
        active.price_predictability_category = Set(v);
    }
    if let Some(v) = body.access_to_storage {
        active.access_to_storage = Set(v);
    }
    if let Some(v) = body.access_to_processing_facilities {
        active.access_to_processing_facilities = Set(v);
    }
    if let Some(v) = body.transport_coordination {
        active.transport_coordination = Set(v);
    }
    if let Some(v) = body.climate_exposure_type {
        active.climate_exposure_type = Set(v);
    }
    if let Some(v) = body.irrigation_access {
        active.irrigation_access = Set(v);
    }
    if let Some(v) = body.climate_mitigation_practices {
        active.climate_mitigation_practices = Set(v);
    }
    if let Some(v) = body.submission_id {
        active.submission_id = Set(v);
    }
    active.updated_at = Set(chrono::Utc::now());
    let m = state.farm_coop_repo.update(active).await?;
    tracing::info!(cooperative_id = %coop_id, id = %id, "Farm coop record updated");
    Ok((StatusCode::OK, Json(FarmCoopResponse::from(m))))
}

#[utoipa::path(
    delete,
    path = "/api/v1/cooperative/non-financial/farm-coop/{id}",
    params(("id" = Uuid, Path, description = "Farm coop record ID")),
    responses(
        (status = 204, description = "Farm coop record deleted"),
        (status = 404, description = "Not found", body = ErrorResponse),
    ),
    tag = NF_TAG,
)]
pub async fn delete_farm_coop(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop_id = state.cooperative_id_from_claims(&claims).await?;
    let existing = state
        .farm_coop_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Farm coop record not found".into()))?;
    if existing.cooperative_id != coop_id {
        return Err(AppError::NotFound("Farm coop record not found".into()));
    }
    state.farm_coop_repo.delete(id).await?;
    tracing::info!(cooperative_id = %coop_id, id = %id, "Farm coop record deleted");
    Ok(StatusCode::NO_CONTENT)
}
