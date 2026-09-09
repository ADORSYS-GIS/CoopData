//! Tenant isolation enforcement helpers for the 4-level IAM hierarchy.
//!
//! All methods in this module derive the caller's tenant identity **exclusively**
//! from their authenticated JWT claims. Client-supplied tenant IDs (query params,
//! body fields, path segments that represent foreign tenants) are **never** used
//! to determine access scope — they are validated against the claim-derived scope,
//! not the other way around.
//!
//! # Access Model
//! ```text
//! Ministry  → sees all cooperatives / submissions
//! Federation → sees cooperatives in all of their apex groups
//! Apex       → sees cooperatives in their own apex group
//! Cooperative → sees only their own cooperative's data
//! ```

use uuid::Uuid;

use crate::api::handlers::cooperative::{
    resolve_caller_apex_db_id_pub, resolve_caller_cooperative, resolve_caller_cooperative_ids,
};
use crate::auth::Claims;
use crate::entities::{cooperative, submission};
use crate::error::{AppError, AppResult};
use crate::AppState;

pub struct TenantIsolation;

impl TenantIsolation {
    /// Verify that a submission belongs to the caller's scope (any tier).
    ///
    /// Returns the submission model on success.
    /// Returns `NotFound` when the submission does not exist or the caller cannot access it.
    /// This prevents cooperative-level users from enumerating foreign submission IDs.
    pub async fn verify_submission_access(
        state: &AppState,
        claims: &Claims,
        submission_id: Uuid,
    ) -> AppResult<submission::Model> {
        let coop_ids = resolve_caller_cooperative_ids(state, claims).await?;
        let submission = state
            .submission_repo
            .find_by_id_for_cooperatives(submission_id, &coop_ids)
            .await?
            .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;
        Ok(submission)
    }

    /// Verify that a submission belongs to a cooperative the caller (cooperative role) owns.
    ///
    /// Returns `(submission, cooperative)` on success.
    /// Cooperative users who try to access another tenant's submission receive `NotFound`
    /// rather than `Forbidden` to prevent cooperative ID enumeration.
    pub async fn verify_cooperative_owns_submission(
        state: &AppState,
        claims: &Claims,
        submission_id: Uuid,
    ) -> AppResult<(submission::Model, cooperative::Model)> {
        let coop = resolve_caller_cooperative(state, claims).await?;
        let submission = state
            .submission_repo
            .find_by_id_for_cooperatives(submission_id, &[coop.id])
            .await?
            .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;
        Ok((submission, coop))
    }

    /// Verify that a submission belongs to a cooperative under the caller's apex.
    ///
    /// Intended for apex-tier handlers (review, approve, return, flags, etc.).
    /// Returns `(submission, apex_db_id)` on success.
    pub async fn verify_apex_owns_submission(
        state: &AppState,
        claims: &Claims,
        submission_id: Uuid,
    ) -> AppResult<(submission::Model, Uuid)> {
        let apex_db_id = resolve_caller_apex_db_id_pub(state, claims).await?;
        let cooperatives = state.cooperative_repo.find_by_apex_id(apex_db_id).await?;
        let coop_ids: Vec<Uuid> = cooperatives.iter().map(|c| c.id).collect();

        let submission = state
            .submission_repo
            .find_by_id_for_cooperatives(submission_id, &coop_ids)
            .await?
            .ok_or_else(|| {
                AppError::Forbidden("Access denied: submission does not belong to your apex".into())
            })?;

        Ok((submission, apex_db_id))
    }

    /// Verify that a submission belongs to a cooperative under the caller's federation.
    ///
    /// Intended for federation-tier handlers.
    /// Returns `(submission, federation_id)` on success.
    pub async fn verify_federation_owns_submission(
        state: &AppState,
        claims: &Claims,
        submission_id: Uuid,
    ) -> AppResult<(submission::Model, Uuid)> {
        let org_id = claims.get_organization_id().ok_or_else(|| {
            AppError::Forbidden("Federation user has no organization associated".into())
        })?;

        let federation =
            crate::api::handlers::submission::resolve_federation_record_pub(state, &org_id).await?;

        let apexes = state.apex_repo.find_by_federation_id(federation.id).await?;

        let mut coop_ids: Vec<Uuid> = vec![];
        for apex in &apexes {
            let coops = state.cooperative_repo.find_by_apex_id(apex.id).await?;
            coop_ids.extend(coops.iter().map(|c| c.id));
        }

        let submission = state
            .submission_repo
            .find_by_id_for_cooperatives(submission_id, &coop_ids)
            .await?
            .ok_or_else(|| {
                AppError::Forbidden(
                    "Access denied: submission does not belong to your federation".into(),
                )
            })?;

        Ok((submission, federation.id))
    }
}
