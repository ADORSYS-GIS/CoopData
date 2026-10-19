//! Who may change a draft submission.
//!
//! A draft has exactly one holder: the user in `edited_by`, or — while it waits to
//! be picked up after a delegation or a return — whoever works at `current_tier`.
//! Every endpoint that writes submission data goes through [`ensure_submission_editor`]
//! so a user who lost the submission (for example after an Apex reclaim) gets one
//! clear `not_editor` error instead of a generic failure.

use uuid::Uuid;

use crate::auth::claims::Claims;
use crate::entities::enums::ReviewTier;
use crate::entities::submission;
use crate::error::{AppError, AppResult};

/// Fails with [`AppError::NotEditor`] unless the caller currently holds the draft.
pub fn ensure_submission_editor(submission: &submission::Model, claims: &Claims) -> AppResult<()> {
    let caller = Uuid::parse_str(&claims.sub).ok();
    check_editor(
        submission.edited_by,
        submission.edited_by_name.as_deref(),
        &submission.current_tier,
        caller,
        caller_tier(claims),
    )
    .map_err(AppError::NotEditor)
}

/// The tier a user edits drafts at; reviewers above the apex never hold drafts.
fn caller_tier(claims: &Claims) -> Option<ReviewTier> {
    if claims.is_cooperative() {
        Some(ReviewTier::Cooperative)
    } else if claims.is_apex() {
        Some(ReviewTier::Apex)
    } else {
        None
    }
}

fn check_editor(
    editor: Option<Uuid>,
    editor_name: Option<&str>,
    tier: &ReviewTier,
    caller: Option<Uuid>,
    caller_tier: Option<ReviewTier>,
) -> Result<(), String> {
    let holds = match editor {
        Some(editor) => caller == Some(editor),
        // Unclaimed draft: it belongs to whoever works at its current tier. Reviewers
        // above the apex (no drafting tier) keep the access they had before this check.
        None => match &caller_tier {
            Some(own) => own == tier,
            None => true,
        },
    };
    if holds {
        return Ok(());
    }

    let holder = editor_name
        .map(|name| format!(" ({name})"))
        .unwrap_or_default();
    Err(match (caller_tier, tier) {
        (Some(ReviewTier::Cooperative), ReviewTier::Apex) => format!(
            "The Apex has taken this submission back{holder}. Your change was not saved."
        ),
        (Some(ReviewTier::Apex), ReviewTier::Cooperative) => format!(
            "This submission is with the cooperative{holder}. Reclaim it before making changes. Your change was not saved."
        ),
        _ => match editor_name {
            Some(name) => format!("{name} is editing this submission. Your change was not saved."),
            None => "Someone else is editing this submission. Your change was not saved.".into(),
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn id(n: u128) -> Option<Uuid> {
        Some(Uuid::from_u128(n))
    }

    #[test]
    fn assigned_editor_may_edit() {
        let result = check_editor(
            id(1),
            Some("Ann"),
            &ReviewTier::Cooperative,
            id(1),
            Some(ReviewTier::Cooperative),
        );

        assert!(result.is_ok());
    }

    #[test]
    fn cooperative_is_told_the_apex_reclaimed_it() {
        let result = check_editor(
            id(2),
            Some("Apex Officer"),
            &ReviewTier::Apex,
            id(1),
            Some(ReviewTier::Cooperative),
        );

        let message = result.unwrap_err();
        assert!(message.contains("taken this submission back"));
        assert!(message.contains("Apex Officer"));
    }

    #[test]
    fn apex_cannot_edit_an_unclaimed_delegated_draft() {
        let result = check_editor(
            None,
            None,
            &ReviewTier::Cooperative,
            id(2),
            Some(ReviewTier::Apex),
        );

        assert!(result.unwrap_err().contains("Reclaim it"));
    }

    #[test]
    fn cooperative_may_edit_an_unclaimed_delegated_draft() {
        let result = check_editor(
            None,
            None,
            &ReviewTier::Cooperative,
            id(1),
            Some(ReviewTier::Cooperative),
        );

        assert!(result.is_ok());
    }

    #[test]
    fn colleague_at_the_same_tier_sees_who_is_editing() {
        let result = check_editor(
            id(3),
            Some("Ben"),
            &ReviewTier::Cooperative,
            id(1),
            Some(ReviewTier::Cooperative),
        );

        assert_eq!(
            result.unwrap_err(),
            "Ben is editing this submission. Your change was not saved."
        );
    }
}
