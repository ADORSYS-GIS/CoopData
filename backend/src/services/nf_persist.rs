use std::collections::HashMap;

use sea_orm::Set;
use uuid::Uuid;

use crate::api::dto::non_financial::RowsImported;
use crate::entities::enums::{AgeGroup, Gender, UrbanRural};
use crate::entities::{farm_coop, fixed_deposit, loan, member, savings_account};
use crate::error::{AppError, AppResult};
use crate::services::nf_excel_parser::{NfParseResult, NfSection};
use crate::AppState;

pub async fn persist_nf_parse_result(
    state: &AppState,
    coop_id: Uuid,
    submission_id: Uuid,
    section: Option<NfSection>,
    parse_result: &NfParseResult,
) -> AppResult<RowsImported> {
    let now = chrono::Utc::now();

    // Clear only the section(s) being imported. For a combined upload (None),
    // clear everything; order matters (child tables before members, FK constraints).
    match section {
        Some(NfSection::Members) => {
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
                .member_repo
                .delete_by_cooperative_and_submission(coop_id, submission_id)
                .await?;
        }
        Some(NfSection::Savings) => {
            state
                .savings_account_repo
                .delete_by_cooperative_and_submission(coop_id, submission_id)
                .await?;
        }
        Some(NfSection::Loans) => {
            state
                .loan_repo
                .delete_by_cooperative_and_submission(coop_id, submission_id)
                .await?;
        }
        Some(NfSection::FixedDeposits) => {
            state
                .fixed_deposit_repo
                .delete_by_cooperative_and_submission(coop_id, submission_id)
                .await?;
        }
        Some(NfSection::FarmCoop) => {
            state
                .farm_coop_repo
                .delete_by_cooperative_and_submission(coop_id, submission_id)
                .await?;
        }
        None => {
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
        }
    }

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
            share_balance: Set(record.share_balance),
            created_at: Set(now),
            updated_at: Set(now),
        });
    }
    let members_imported = if member_active_models.is_empty() {
        0
    } else {
        state
            .member_repo
            .bulk_upsert(member_active_models.clone())
            .await?
    };

    // Build member_business_id → DB-uuid mapping directly from the just-inserted
    // member models. Re-querying the DB here is unsafe because it would return
    // members from OTHER submissions for this cooperative (same member_id string,
    // different DB UUID), leading to FK violations in the child tables.
    let mut member_map: HashMap<String, Uuid> = HashMap::new();
    // Demographic lookup used to derive loan-level women/youth/rural borrower
    // flags below — the LOANS sheet only carries a member business id, not
    // gender/age/region, so those flags must be joined from the member
    // record rather than left at their (always-false) parsed defaults.
    let mut member_demographics: HashMap<String, (Gender, AgeGroup, UrbanRural)> = HashMap::new();
    for am in &member_active_models {
        // member_id is the business key (string), id is the DB primary key (uuid)
        if let (sea_orm::ActiveValue::Set(member_id_str), sea_orm::ActiveValue::Set(db_uuid)) =
            (&am.member_id, &am.id)
        {
            member_map.insert(member_id_str.clone(), *db_uuid);
        }
        if let (
            sea_orm::ActiveValue::Set(member_id_str),
            sea_orm::ActiveValue::Set(gender),
            sea_orm::ActiveValue::Set(age_group),
            sea_orm::ActiveValue::Set(urban_rural),
        ) = (&am.member_id, &am.gender, &am.age_group, &am.urban_rural)
        {
            member_demographics.insert(
                member_id_str.clone(),
                (gender.clone(), age_group.clone(), urban_rural.clone()),
            );
        }
    }

    // For a single-section upload of a child table (savings/loans/fixed deposits),
    // members are not in this file. Resolve FKs against members already imported
    // for this submission, and require them to exist first.
    if member_map.is_empty()
        && matches!(
            section,
            Some(NfSection::Savings | NfSection::Loans | NfSection::FixedDeposits)
        )
    {
        let existing = state
            .member_repo
            .find_all_by_cooperative_and_submission(coop_id, Some(submission_id))
            .await?;
        if existing.is_empty() {
            return Err(AppError::BadRequest(
                "Members must be uploaded before savings, loans, or fixed deposits. Upload the membership file first."
                    .into(),
            ));
        }
        for m in existing {
            member_demographics.insert(
                m.member_id.clone(),
                (m.gender.clone(), m.age_group.clone(), m.urban_rural.clone()),
            );
            member_map.insert(m.member_id, m.id);
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
        // Loan sheets never carry gender/age/region columns — derive the
        // demographic borrower flags from the linked member record instead
        // of trusting the parser's raw (always-false) defaults, which is
        // why Financial Inclusion previously showed 0% across the board
        // regardless of actual membership composition.
        let demographics = member_demographics.get(&record.member_business_id);
        let women_borrower_flag = demographics
            .map(|(gender, _, _)| *gender == Gender::Female)
            .unwrap_or(record.women_borrower_flag);
        let youth_borrower_flag = demographics
            .map(|(_, age_group, _)| age_group.is_youth())
            .unwrap_or(record.youth_borrower_flag);
        let rural_borrower_flag = demographics
            .map(|(_, _, urban_rural)| *urban_rural == UrbanRural::Rural)
            .unwrap_or(record.rural_borrower_flag);
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
            youth_borrower_flag: Set(youth_borrower_flag),
            women_borrower_flag: Set(women_borrower_flag),
            rural_borrower_flag: Set(rural_borrower_flag),
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

    Ok(RowsImported {
        members: members_imported,
        savings_accounts: savings_imported,
        loans: loans_imported,
        fixed_deposits: fd_imported,
        farm_coop: farm_coop_imported,
    })
}
