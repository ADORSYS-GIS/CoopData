//! Checks before the apex submits (and so approves) a return that came from Mambu.
//! Nobody else looks at it, so the apex must say it has read the warnings, and the
//! return cannot go while ledger accounts have no mapping.

use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::AppState;

pub const ACK_REQUIRED: &str = "MAMBU_WARNINGS_NOT_ACKNOWLEDGED";

/// The rule on its own: `unmapped` ledger accounts, `warnings` of warning level.
pub fn evaluate(unmapped: i32, warnings: usize, acknowledged: bool) -> Result<(), String> {
    if unmapped > 0 {
        return Err(format!(
            "{unmapped} ledger account(s) from Mambu have no mapping. Map them under Mambu Sync (ledger mapping), sync again, then submit."
        ));
    }
    if warnings > 0 && !acknowledged {
        return Err(format!(
            "{ACK_REQUIRED}: Confirm that you checked the {warnings} warning(s) of this import before submitting."
        ));
    }
    Ok(())
}

pub async fn check_before_submit(
    state: &AppState,
    submission_id: Uuid,
    acknowledged: bool,
) -> AppResult<()> {
    let Some(item) = state
        .mambu_repo
        .find_item_for_submission(submission_id)
        .await?
    else {
        return Ok(());
    };
    let warnings = item
        .warnings
        .as_array()
        .map(|list| {
            list.iter()
                .filter(|w| w.get("severity").and_then(|s| s.as_str()) == Some("warning"))
                .count()
        })
        .unwrap_or(0);
    evaluate(item.unmapped_ledger_accounts, warnings, acknowledged).map_err(AppError::BadRequest)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_clean_import_can_be_submitted() {
        assert!(evaluate(0, 0, false).is_ok());
    }

    #[test]
    fn warnings_need_a_tick_before_the_submit() {
        let err = evaluate(0, 3, false).unwrap_err();
        assert!(err.starts_with(ACK_REQUIRED), "{err}");
        assert!(evaluate(0, 3, true).is_ok());
    }

    #[test]
    fn unmapped_accounts_block_the_submit_even_with_the_tick() {
        let err = evaluate(2, 0, true).unwrap_err();
        assert!(err.contains("2 ledger account"), "{err}");
    }
}
