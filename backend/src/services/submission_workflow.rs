use uuid::Uuid;

use crate::auth::claims::Claims;
use crate::entities::enums::{ReviewAction, ReviewTier, SubmissionStatus};
use crate::entities::submission_review::ActiveModel as ReviewModel;
use crate::error::{AppError, AppResult};
use crate::repositories::{
    AbnormalityFlagRepository, FinancialStatementRepository, SubmissionRepository,
    SubmissionReviewRepository, SubmissionSectionRepository,
};
use sea_orm::Set;

pub struct SubmissionWorkflow {
    pub submission_repo: SubmissionRepository,
    pub review_repo: SubmissionReviewRepository,
    pub flag_repo: AbnormalityFlagRepository,
    pub section_repo: SubmissionSectionRepository,
    pub fs_repo: FinancialStatementRepository,
}

impl SubmissionWorkflow {
    pub fn new(
        submission_repo: SubmissionRepository,
        review_repo: SubmissionReviewRepository,
        flag_repo: AbnormalityFlagRepository,
        section_repo: SubmissionSectionRepository,
        fs_repo: FinancialStatementRepository,
    ) -> Self {
        Self {
            submission_repo,
            review_repo,
            flag_repo,
            section_repo,
            fs_repo,
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
}
