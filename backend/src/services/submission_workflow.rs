use uuid::Uuid;

use crate::auth::claims::Claims;
use crate::entities::enums::{ReviewAction, ReviewTier, SubmissionStatus};
use crate::entities::submission_review::ActiveModel as ReviewModel;
use crate::error::{AppError, AppResult};
use crate::repositories::{
    AbnormalityFlagRepository, BalanceSheetLineItemRepository, FinancialStatementRepository,
    KpiRecordRepository, SubmissionRepository, SubmissionReviewRepository,
    SubmissionSectionRepository,
};
use sea_orm::Set;

pub struct SubmissionWorkflow {
    pub submission_repo: SubmissionRepository,
    pub review_repo: SubmissionReviewRepository,
    pub flag_repo: AbnormalityFlagRepository,
    pub section_repo: SubmissionSectionRepository,
    pub fs_repo: FinancialStatementRepository,
    pub line_item_repo: BalanceSheetLineItemRepository,
    pub kpi_record_repo: KpiRecordRepository,
    pub db: sea_orm::DatabaseConnection,
}

impl SubmissionWorkflow {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        submission_repo: SubmissionRepository,
        review_repo: SubmissionReviewRepository,
        flag_repo: AbnormalityFlagRepository,
        section_repo: SubmissionSectionRepository,
        fs_repo: FinancialStatementRepository,
        line_item_repo: BalanceSheetLineItemRepository,
        kpi_record_repo: KpiRecordRepository,
        db: sea_orm::DatabaseConnection,
    ) -> Self {
        Self {
            submission_repo,
            review_repo,
            flag_repo,
            section_repo,
            fs_repo,
            line_item_repo,
            kpi_record_repo,
            db,
        }
    }

    /// Cooperative clicks "Submit" → awaiting_coop_validation → submitted
    pub async fn submit(&self, submission_id: Uuid, claims: &Claims) -> AppResult<()> {
        let sub = self
            .submission_repo
            .find_by_id(submission_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

        if sub.status != SubmissionStatus::Draft {
            return Err(AppError::BadRequest(format!(
                "Submission is in '{}' status and cannot be submitted",
                sub.status.as_str()
            )));
        }

        // Block if error-severity flags exist
        let errors = self
            .flag_repo
            .find_errors_by_submission(submission_id)
            .await?;
        if !errors.is_empty() {
            return Err(AppError::BadRequest(format!(
                "{} error-severity validation flag(s) must be resolved before submitting",
                errors.len()
            )));
        }

        // Check all sections are ready
        let sections = self.section_repo.find_by_submission(submission_id).await?;
        let not_ready: Vec<String> = sections
            .iter()
            .filter(|s| s.section != "farm_coop" && s.status != "ready")
            .map(|s| format!("{} ({})", s.section, s.status))
            .collect();
        if !not_ready.is_empty() {
            return Err(AppError::BadRequest(format!(
                "All sections must be ready before submitting. Incomplete: {}",
                not_ready.join(", ")
            )));
        }

        // Verify financial statement exists
        let fs = self.fs_repo.find_by_submission(submission_id).await?;
        if fs.is_none() {
            return Err(AppError::BadRequest(
                "A financial statement must be uploaded before submitting".into(),
            ));
        }

        self.submission_repo
            .update_status(submission_id, SubmissionStatus::Submitted, ReviewTier::Apex)
            .await?;

        // Immediately compute and save KPIs to database for cooperative analytics
        if let Err(e) = self
            .compute_and_save_kpis(submission_id, sub.cooperative_id, sub.reporting_year)
            .await
        {
            tracing::error!(
                submission_id = %submission_id,
                error = %e,
                "Failed to compute and save KPIs during submission"
            );
        }

        self.append_review(
            submission_id,
            ReviewTier::Cooperative,
            claims,
            ReviewAction::Comment,
            None,
        )
        .await?;
        Ok(())
    }

    /// Apex approves → federation_review (Submitted → InReview, tier=Federation)
    pub async fn apex_approve(
        &self,
        submission_id: Uuid,
        claims: &Claims,
        comment: Option<String>,
    ) -> AppResult<()> {
        self.transition(
            submission_id,
            SubmissionStatus::Submitted,
            ReviewAction::Approve,
            SubmissionStatus::InReview,
            ReviewTier::Federation,
            claims,
            comment,
        )
        .await
    }

    /// Apex returns → back to draft
    pub async fn apex_return(
        &self,
        submission_id: Uuid,
        claims: &Claims,
        comment: Option<String>,
    ) -> AppResult<()> {
        self.transition(
            submission_id,
            SubmissionStatus::Submitted,
            ReviewAction::Return,
            SubmissionStatus::Draft,
            ReviewTier::Cooperative,
            claims,
            comment,
        )
        .await?;
        self.section_repo
            .reset_to_in_progress(submission_id)
            .await?;
        Ok(())
    }

    /// Federation approves → ministry_review (InReview/Federation → InReview/Ministry)
    pub async fn federation_approve(
        &self,
        submission_id: Uuid,
        claims: &Claims,
        comment: Option<String>,
    ) -> AppResult<()> {
        self.transition(
            submission_id,
            SubmissionStatus::InReview,
            ReviewAction::Approve,
            SubmissionStatus::InReview,
            ReviewTier::Ministry,
            claims,
            comment,
        )
        .await
    }

    /// Federation returns → back to apex (InReview/Federation → Submitted/Apex)
    pub async fn federation_return(
        &self,
        submission_id: Uuid,
        claims: &Claims,
        comment: Option<String>,
    ) -> AppResult<()> {
        self.transition(
            submission_id,
            SubmissionStatus::InReview,
            ReviewAction::Return,
            SubmissionStatus::Submitted,
            ReviewTier::Apex,
            claims,
            comment,
        )
        .await
    }

    /// Ministry approves → approved (terminal)
    pub async fn ministry_approve(
        &self,
        submission_id: Uuid,
        claims: &Claims,
        comment: Option<String>,
    ) -> AppResult<()> {
        self.transition(
            submission_id,
            SubmissionStatus::InReview,
            ReviewAction::Approve,
            SubmissionStatus::Approved,
            ReviewTier::Ministry,
            claims,
            comment,
        )
        .await
    }

    /// Ministry rejects → rejected (terminal)
    pub async fn ministry_reject(
        &self,
        submission_id: Uuid,
        claims: &Claims,
        comment: Option<String>,
    ) -> AppResult<()> {
        self.transition(
            submission_id,
            SubmissionStatus::InReview,
            ReviewAction::Reject,
            SubmissionStatus::Rejected,
            ReviewTier::Ministry,
            claims,
            comment,
        )
        .await
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    #[allow(clippy::too_many_arguments)]
    async fn transition(
        &self,
        submission_id: Uuid,
        expected_status: SubmissionStatus,
        action: ReviewAction,
        new_status: SubmissionStatus,
        new_tier: ReviewTier,
        claims: &Claims,
        comment: Option<String>,
    ) -> AppResult<()> {
        let sub = self
            .submission_repo
            .find_by_id(submission_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

        if sub.status != expected_status {
            return Err(AppError::BadRequest(format!(
                "Expected status '{}', found '{}'",
                expected_status.as_str(),
                sub.status.as_str()
            )));
        }

        let next_tier = new_tier.clone();
        self.submission_repo
            .update_status(submission_id, new_status, new_tier)
            .await?;

        let reviewer_tier = sub.current_tier.clone();
        let target_tier = match action {
            ReviewAction::Return => Some(next_tier),
            _ => Some(reviewer_tier.clone()),
        };
        self.append_review_with_target(
            submission_id,
            reviewer_tier,
            target_tier,
            claims,
            action,
            comment,
        )
        .await?;
        Ok(())
    }

    async fn append_review(
        &self,
        submission_id: Uuid,
        tier: ReviewTier,
        claims: &Claims,
        action: ReviewAction,
        comment: Option<String>,
    ) -> AppResult<()> {
        let reviewer_id = uuid::Uuid::parse_str(&claims.sub).ok();
        let model = ReviewModel {
            id: Set(Uuid::new_v4()),
            submission_id: Set(submission_id),
            tier: Set(tier),
            reviewer_id: Set(reviewer_id),
            action: Set(action),
            comment: Set(comment),
            target_tier: Set(None),
            created_at: Set(chrono::Utc::now()),
        };
        self.review_repo.create(model).await?;
        Ok(())
    }

    async fn append_review_with_target(
        &self,
        submission_id: Uuid,
        tier: ReviewTier,
        target_tier: Option<ReviewTier>,
        claims: &Claims,
        action: ReviewAction,
        comment: Option<String>,
    ) -> AppResult<()> {
        let reviewer_id = uuid::Uuid::parse_str(&claims.sub).ok();
        let model = ReviewModel {
            id: Set(Uuid::new_v4()),
            submission_id: Set(submission_id),
            tier: Set(tier),
            reviewer_id: Set(reviewer_id),
            action: Set(action),
            comment: Set(comment),
            target_tier: Set(target_tier),
            created_at: Set(chrono::Utc::now()),
        };
        self.review_repo.create(model).await?;
        Ok(())
    }

    pub async fn compute_and_save_kpis(
        &self,
        submission_id: Uuid,
        cooperative_id: Uuid,
        reporting_year: i32,
    ) -> AppResult<()> {
        let fs = self.fs_repo.find_by_submission(submission_id).await?;
        let line_items = if let Some(fs) = fs {
            self.line_item_repo
                .find_by_financial_statement(fs.id)
                .await?
        } else {
            vec![]
        };

        let financial_kpi_set = crate::services::kpi_engine::KpiEngine::compute(&line_items);

        let nf_stats =
            crate::services::nf_indicator_engine::NfIndicatorEngine::compute_for_submission(
                &self.db,
                cooperative_id,
                Some(submission_id),
            )
            .await?;

        let mut active_models = Vec::new();
        let now = chrono::Utc::now().fixed_offset();

        for kpi in financial_kpi_set.to_vec() {
            active_models.push(crate::entities::kpi_record::ActiveModel {
                id: sea_orm::Set(Uuid::new_v4()),
                cooperative_id: sea_orm::Set(cooperative_id),
                submission_id: sea_orm::Set(submission_id),
                reporting_year: sea_orm::Set(reporting_year),
                kpi_name: sea_orm::Set(kpi.name.clone()),
                kpi_type: sea_orm::Set("financial".to_string()),
                value: sea_orm::Set(kpi.value),
                formatted: sea_orm::Set(kpi.formatted.clone()),
                unit: sea_orm::Set(kpi.unit.clone()),
                status: sea_orm::Set(kpi.status.clone()),
                description: sea_orm::Set(kpi.description.clone()),
                created_at: sea_orm::Set(now),
                updated_at: sea_orm::Set(now),
            });
        }

        let m = &nf_stats.membership;
        let s = &nf_stats.savings;
        let l = &nf_stats.loans;
        let fd = &nf_stats.fixed_deposits;
        let farm = &nf_stats.farm_coop;

        let nf_mappings = vec![
            (
                "membership_total",
                m.total as f64,
                m.total.to_string(),
                "count",
                "Total registered members",
            ),
            (
                "membership_active",
                m.active as f64,
                m.active.to_string(),
                "count",
                "Active members",
            ),
            (
                "membership_dormant",
                m.dormant as f64,
                m.dormant.to_string(),
                "count",
                "Dormant members",
            ),
            (
                "membership_exited",
                m.exited as f64,
                m.exited.to_string(),
                "count",
                "Exited members",
            ),
            (
                "membership_male",
                m.male as f64,
                m.male.to_string(),
                "count",
                "Male members",
            ),
            (
                "membership_female",
                m.female as f64,
                m.female.to_string(),
                "count",
                "Female members",
            ),
            (
                "membership_other",
                m.other as f64,
                m.other.to_string(),
                "count",
                "Other gender members",
            ),
            (
                "membership_under_18",
                m.under_18 as f64,
                m.under_18.to_string(),
                "count",
                "Members under 18 years old",
            ),
            (
                "membership_age_18_35",
                m.age_18_35 as f64,
                m.age_18_35.to_string(),
                "count",
                "Members aged 18 to 35",
            ),
            (
                "membership_age_36_50",
                m.age_36_50 as f64,
                m.age_36_50.to_string(),
                "count",
                "Members aged 36 to 50",
            ),
            (
                "membership_over_50",
                m.over_50 as f64,
                m.over_50.to_string(),
                "count",
                "Members over 50 years old",
            ),
            (
                "membership_urban",
                m.urban as f64,
                m.urban.to_string(),
                "count",
                "Members in urban locations",
            ),
            (
                "membership_rural",
                m.rural as f64,
                m.rural.to_string(),
                "count",
                "Members in rural locations",
            ),
            (
                "membership_agm_attendance",
                m.agm_attendance as f64,
                m.agm_attendance.to_string(),
                "count",
                "Members attending the Annual General Meeting",
            ),
            (
                "membership_leadership_count",
                m.leadership_count as f64,
                m.leadership_count.to_string(),
                "count",
                "Members in leadership roles",
            ),
            (
                "membership_voting_count",
                m.voting_count as f64,
                m.voting_count.to_string(),
                "count",
                "Members exercising voting rights",
            ),
            (
                "membership_active_pct",
                m.active_pct,
                format!("{:.1}%", m.active_pct),
                "percent",
                "Percentage of active members",
            ),
            (
                "membership_dormancy_pct",
                m.dormancy_pct,
                format!("{:.1}%", m.dormancy_pct),
                "percent",
                "Percentage of dormant members",
            ),
            (
                "membership_exit_pct",
                m.exit_pct,
                format!("{:.1}%", m.exit_pct),
                "percent",
                "Percentage of exited members",
            ),
            (
                "membership_male_pct",
                m.male_pct,
                format!("{:.1}%", m.male_pct),
                "percent",
                "Percentage of male members",
            ),
            (
                "membership_female_pct",
                m.female_pct,
                format!("{:.1}%", m.female_pct),
                "percent",
                "Percentage of female members",
            ),
            (
                "membership_other_pct",
                m.other_pct,
                format!("{:.1}%", m.other_pct),
                "percent",
                "Percentage of other gender members",
            ),
            (
                "membership_youth_pct",
                m.youth_pct,
                format!("{:.1}%", m.youth_pct),
                "percent",
                "Percentage of youth members (<35 years)",
            ),
            (
                "membership_adult_pct",
                m.adult_pct,
                format!("{:.1}%", m.adult_pct),
                "percent",
                "Percentage of adult members (>=35 years)",
            ),
            (
                "membership_urban_pct",
                m.urban_pct,
                format!("{:.1}%", m.urban_pct),
                "percent",
                "Percentage of urban members",
            ),
            (
                "membership_rural_pct",
                m.rural_pct,
                format!("{:.1}%", m.rural_pct),
                "percent",
                "Percentage of rural members",
            ),
            (
                "membership_agm_participation_pct",
                m.agm_participation_pct,
                format!("{:.1}%", m.agm_participation_pct),
                "percent",
                "AGM Attendance rate",
            ),
            (
                "membership_women_in_governance_pct",
                m.women_in_governance_pct,
                format!("{:.1}%", m.women_in_governance_pct),
                "percent",
                "Share of women in leadership roles",
            ),
            (
                "membership_youth_in_governance_pct",
                m.youth_in_governance_pct,
                format!("{:.1}%", m.youth_in_governance_pct),
                "percent",
                "Share of youth in leadership roles",
            ),
            (
                "savings_total_accounts",
                s.total_accounts as f64,
                s.total_accounts.to_string(),
                "count",
                "Total savings accounts",
            ),
            (
                "savings_active_accounts",
                s.active_accounts as f64,
                s.active_accounts.to_string(),
                "count",
                "Active savings accounts",
            ),
            (
                "savings_dormant_accounts",
                s.dormant_accounts as f64,
                s.dormant_accounts.to_string(),
                "count",
                "Dormant savings accounts",
            ),
            (
                "savings_zero_balance_count",
                s.zero_balance_count as f64,
                s.zero_balance_count.to_string(),
                "count",
                "Accounts with a zero balance",
            ),
            (
                "savings_increasing_trend",
                s.increasing_trend as f64,
                s.increasing_trend.to_string(),
                "count",
                "Accounts with increasing balance trend",
            ),
            (
                "savings_stable_trend",
                s.stable_trend as f64,
                s.stable_trend.to_string(),
                "count",
                "Accounts with stable balance trend",
            ),
            (
                "savings_declining_trend",
                s.declining_trend as f64,
                s.declining_trend.to_string(),
                "count",
                "Accounts with declining balance trend",
            ),
            (
                "savings_high_withdrawal_count",
                s.high_withdrawal_count as f64,
                s.high_withdrawal_count.to_string(),
                "count",
                "Accounts with high withdrawal frequency",
            ),
            (
                "savings_emergency_withdrawal_count",
                s.emergency_withdrawal_count as f64,
                s.emergency_withdrawal_count.to_string(),
                "count",
                "Accounts with emergency withdrawals",
            ),
            (
                "savings_total_balance",
                s.total_balance,
                format!("${:.0}", s.total_balance),
                "currency",
                "Total savings balance",
            ),
            (
                "savings_average_balance",
                s.average_balance,
                format!("${:.0}", s.average_balance),
                "currency",
                "Average savings account balance",
            ),
            (
                "savings_penetration_pct",
                s.savings_penetration_pct,
                format!("{:.1}%", s.savings_penetration_pct),
                "percent",
                "Share of members holding savings accounts",
            ),
            (
                "savings_active_savers_pct",
                s.active_savers_pct,
                format!("{:.1}%", s.active_savers_pct),
                "percent",
                "Active savers ratio",
            ),
            (
                "savings_dormant_savings_pct",
                s.dormant_savings_pct,
                format!("{:.1}%", s.dormant_savings_pct),
                "percent",
                "Dormant savings ratio",
            ),
            (
                "savings_zero_balance_pct",
                s.zero_balance_pct,
                format!("{:.1}%", s.zero_balance_pct),
                "percent",
                "Zero balance accounts percentage",
            ),
            (
                "savings_increasing_trend_pct",
                s.increasing_trend_pct,
                format!("{:.1}%", s.increasing_trend_pct),
                "percent",
                "Increasing balance ratio",
            ),
            (
                "savings_regular_savers_pct",
                s.regular_savers_pct,
                format!("{:.1}%", s.regular_savers_pct),
                "percent",
                "Regular savers ratio",
            ),
            (
                "loans_total_loans",
                l.total_loans as f64,
                l.total_loans.to_string(),
                "count",
                "Total loans issued",
            ),
            (
                "loans_active_loans",
                l.active_loans as f64,
                l.active_loans.to_string(),
                "count",
                "Active/outstanding loans",
            ),
            (
                "loans_performing",
                l.performing as f64,
                l.performing.to_string(),
                "count",
                "Performing loans",
            ),
            (
                "loans_arrears",
                l.arrears as f64,
                l.arrears.to_string(),
                "count",
                "Loans in arrears",
            ),
            (
                "loans_restructured",
                l.restructured as f64,
                l.restructured.to_string(),
                "count",
                "Restructured loans",
            ),
            (
                "loans_written_off",
                l.written_off as f64,
                l.written_off.to_string(),
                "count",
                "Written-off loans",
            ),
            (
                "loans_members_with_loans",
                l.members_with_loans as f64,
                l.members_with_loans.to_string(),
                "count",
                "Number of members with loans",
            ),
            (
                "loans_youth_borrowers",
                l.youth_borrowers as f64,
                l.youth_borrowers.to_string(),
                "count",
                "Youth borrowers (<35 years)",
            ),
            (
                "loans_women_borrowers",
                l.women_borrowers as f64,
                l.women_borrowers.to_string(),
                "count",
                "Female borrowers",
            ),
            (
                "loans_rural_borrowers",
                l.rural_borrowers as f64,
                l.rural_borrowers.to_string(),
                "count",
                "Rural borrowers",
            ),
            (
                "loans_multiple_loan_count",
                l.multiple_loan_count as f64,
                l.multiple_loan_count.to_string(),
                "count",
                "Members with multiple active loans",
            ),
            (
                "loans_large_borrower_count",
                l.large_borrower_count as f64,
                l.large_borrower_count.to_string(),
                "count",
                "Large exposure borrowers count",
            ),
            (
                "loans_total_balance",
                l.total_balance,
                format!("${:.0}", l.total_balance),
                "currency",
                "Total outstanding loan balance",
            ),
            (
                "loans_total_loan_amount",
                l.total_loan_amount,
                format!("${:.0}", l.total_loan_amount),
                "currency",
                "Total disbursed loan amount",
            ),
            (
                "loans_average_loan_size",
                l.average_loan_size,
                format!("${:.0}", l.average_loan_size),
                "currency",
                "Average loan size",
            ),
            (
                "loans_on_time_repayment_pct",
                l.on_time_repayment_pct,
                format!("{:.1}%", l.on_time_repayment_pct),
                "percent",
                "Repayments made on-time percentage",
            ),
            (
                "loans_arrears_rate_pct",
                l.arrears_rate_pct,
                format!("{:.1}%", l.arrears_rate_pct),
                "percent",
                "Portfolio arrears rate",
            ),
            (
                "loans_restructured_pct",
                l.restructured_pct,
                format!("{:.1}%", l.restructured_pct),
                "percent",
                "Restructured loans share",
            ),
            (
                "loans_credit_penetration_pct",
                l.credit_penetration_pct,
                format!("{:.1}%", l.credit_penetration_pct),
                "percent",
                "Share of members with active loans",
            ),
            (
                "loans_youth_borrower_pct",
                l.youth_borrower_pct,
                format!("{:.1}%", l.youth_borrower_pct),
                "percent",
                "Share of youth borrowers",
            ),
            (
                "loans_women_borrower_pct",
                l.women_borrower_pct,
                format!("{:.1}%", l.women_borrower_pct),
                "percent",
                "Share of female borrowers",
            ),
            (
                "loans_rural_borrower_pct",
                l.rural_borrower_pct,
                format!("{:.1}%", l.rural_borrower_pct),
                "percent",
                "Share of rural borrowers",
            ),
            (
                "fds_total_fds",
                fd.total_fds as f64,
                fd.total_fds.to_string(),
                "count",
                "Total fixed deposits accounts",
            ),
            (
                "fds_active_fds",
                fd.active_fds as f64,
                fd.active_fds.to_string(),
                "count",
                "Active fixed deposits",
            ),
            (
                "fds_matured_fds",
                fd.matured_fds as f64,
                fd.matured_fds.to_string(),
                "count",
                "Matured fixed deposits",
            ),
            (
                "fds_withdrawn_fds",
                fd.withdrawn_fds as f64,
                fd.withdrawn_fds.to_string(),
                "count",
                "Withdrawn fixed deposits",
            ),
            (
                "fds_rolled_over_fds",
                fd.rolled_over_fds as f64,
                fd.rolled_over_fds.to_string(),
                "count",
                "Rolled over fixed deposits",
            ),
            (
                "fds_members_with_fds",
                fd.members_with_fds as f64,
                fd.members_with_fds.to_string(),
                "count",
                "Members holding fixed deposits",
            ),
            (
                "fds_early_withdrawal_count",
                fd.early_withdrawal_count as f64,
                fd.early_withdrawal_count.to_string(),
                "count",
                "FDs withdrawn early",
            ),
            (
                "fds_single_depositor_count",
                fd.single_depositor_count as f64,
                fd.single_depositor_count.to_string(),
                "count",
                "Concentrated single depositors",
            ),
            (
                "fds_total_balance",
                fd.total_balance,
                format!("${:.0}", fd.total_balance),
                "currency",
                "Total fixed deposits balance",
            ),
            (
                "fds_average_balance",
                fd.average_balance,
                format!("${:.0}", fd.average_balance),
                "currency",
                "Average fixed deposit balance",
            ),
            (
                "fds_fd_penetration_pct",
                fd.fd_penetration_pct,
                format!("{:.1}%", fd.fd_penetration_pct),
                "percent",
                "FD member penetration rate",
            ),
            (
                "fds_early_withdrawal_pct",
                fd.early_withdrawal_pct,
                format!("{:.1}%", fd.early_withdrawal_pct),
                "percent",
                "Early withdrawal rate",
            ),
            (
                "fds_rollover_rate_pct",
                fd.rollover_rate_pct,
                format!("{:.1}%", fd.rollover_rate_pct),
                "percent",
                "Rollover loyalty rate",
            ),
            (
                "fds_concentration_risk_pct",
                fd.concentration_risk_pct,
                format!("{:.1}%", fd.concentration_risk_pct),
                "percent",
                "Single depositor dependency percentage",
            ),
            (
                "farm_total_coops",
                farm.total_coops as f64,
                farm.total_coops.to_string(),
                "count",
                "Total farm cooperatives database entries",
            ),
            (
                "farm_active_producers",
                farm.active_producers as f64,
                farm.active_producers.to_string(),
                "count",
                "Cooperatives with active producers",
            ),
            (
                "farm_using_planning",
                farm.using_planning as f64,
                farm.using_planning.to_string(),
                "count",
                "Cooperatives using production planning",
            ),
            (
                "farm_using_shared_inputs",
                farm.using_shared_inputs as f64,
                farm.using_shared_inputs.to_string(),
                "count",
                "Cooperatives using shared inputs",
            ),
            (
                "farm_with_offtake_agreement",
                farm.with_offtake_agreement as f64,
                farm.with_offtake_agreement.to_string(),
                "count",
                "Cooperatives with formal offtake agreements",
            ),
            (
                "farm_with_storage",
                farm.with_storage as f64,
                farm.with_storage.to_string(),
                "count",
                "Cooperatives with storage facilities access",
            ),
            (
                "farm_with_processing",
                farm.with_processing as f64,
                farm.with_processing.to_string(),
                "count",
                "Cooperatives with processing facilities access",
            ),
            (
                "farm_with_irrigation",
                farm.with_irrigation as f64,
                farm.with_irrigation.to_string(),
                "count",
                "Cooperatives with irrigation access",
            ),
            (
                "farm_with_climate_mitigation",
                farm.with_climate_mitigation as f64,
                farm.with_climate_mitigation.to_string(),
                "count",
                "Cooperatives practicing climate mitigation",
            ),
            (
                "farm_active_producer_pct",
                farm.active_producer_pct,
                format!("{:.1}%", farm.active_producer_pct),
                "percent",
                "Active producer percentage",
            ),
            (
                "farm_planning_adoption_pct",
                farm.planning_adoption_pct,
                format!("{:.1}%", farm.planning_adoption_pct),
                "percent",
                "Production planning adoption rate",
            ),
            (
                "farm_shared_services_pct",
                farm.shared_services_pct,
                format!("{:.1}%", farm.shared_services_pct),
                "percent",
                "Shared inputs utilization rate",
            ),
            (
                "farm_formal_offtake_pct",
                farm.formal_offtake_pct,
                format!("{:.1}%", farm.formal_offtake_pct),
                "percent",
                "Offtake agreement coverage rate",
            ),
            (
                "farm_storage_coverage_pct",
                farm.storage_coverage_pct,
                format!("{:.1}%", farm.storage_coverage_pct),
                "percent",
                "Storage facilities access rate",
            ),
            (
                "farm_processing_access_pct",
                farm.processing_access_pct,
                format!("{:.1}%", farm.processing_access_pct),
                "percent",
                "Processing facilities access rate",
            ),
            (
                "farm_irrigation_coverage_pct",
                farm.irrigation_coverage_pct,
                format!("{:.1}%", farm.irrigation_coverage_pct),
                "percent",
                "Irrigation coverage rate",
            ),
            (
                "farm_climate_mitigation_pct",
                farm.climate_mitigation_pct,
                format!("{:.1}%", farm.climate_mitigation_pct),
                "percent",
                "Climate mitigation practices rate",
            ),
        ];

        for (name, val, formatted, unit, desc) in nf_mappings {
            active_models.push(crate::entities::kpi_record::ActiveModel {
                id: sea_orm::Set(Uuid::new_v4()),
                cooperative_id: sea_orm::Set(cooperative_id),
                submission_id: sea_orm::Set(submission_id),
                reporting_year: sea_orm::Set(reporting_year),
                kpi_name: sea_orm::Set(name.to_string()),
                kpi_type: sea_orm::Set("non_financial".to_string()),
                value: sea_orm::Set(val),
                formatted: sea_orm::Set(formatted),
                unit: sea_orm::Set(unit.to_string()),
                status: sea_orm::Set(None),
                description: sea_orm::Set(desc.to_string()),
                created_at: sea_orm::Set(now),
                updated_at: sea_orm::Set(now),
            });
        }

        self.kpi_record_repo
            .delete_by_submission(submission_id)
            .await?;
        self.kpi_record_repo.create_many(active_models).await?;
        Ok(())
    }
}
