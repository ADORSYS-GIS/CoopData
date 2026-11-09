use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::AppState;

const MAX_BRANCH_ID_LEN: usize = 64;

#[derive(Debug, Clone)]
pub struct BranchPreview {
    pub id: String,
    pub name: Option<String>,
    pub available: bool,
}

pub fn clean_branch_id(raw: &str) -> AppResult<String> {
    let id = raw.trim();
    let valid = !id.is_empty()
        && id.len() <= MAX_BRANCH_ID_LEN
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if !valid {
        return Err(AppError::BadRequest(
            "The Mambu branch ID may only contain letters, digits, '-' and '_' (max 64)".into(),
        ));
    }
    Ok(id.to_string())
}

/// A Mambu branch ID always has a digit (ES0006, BUS001). Without the right to list
/// branches an ID cannot be checked, so only text that looks like one is accepted and a
/// name typed by mistake is never saved as a link.
fn looks_like_branch_id(id: &str) -> bool {
    id.len() >= 3 && id.chars().any(|c| c.is_ascii_digit())
}

const CANNOT_LIST_BRANCHES: &str = "The Mambu user may not list branches, so a SACCO cannot be found by name yet. Type its Mambu ID, for example ES0006.";

async fn is_taken(
    state: &AppState,
    branch_id: &str,
    for_cooperative: Option<Uuid>,
) -> AppResult<bool> {
    Ok(state
        .mambu_repo
        .find_link_by_branch(branch_id)
        .await?
        .is_some_and(|l| Some(l.cooperative_id) != for_cooperative))
}

/// Looks up a branch by ID. The name is only returned when the branch can be
/// linked to `for_cooperative`, so nobody can list the SACCOs of other apexes by
/// trying IDs.
pub async fn preview_branch(
    state: &AppState,
    raw_id: &str,
    for_cooperative: Option<Uuid>,
) -> AppResult<BranchPreview> {
    let id = clean_branch_id(raw_id)?;
    let client = state.mambu_client.clone().ok_or_else(|| {
        AppError::BadRequest("The Mambu integration is not configured on this server".into())
    })?;
    let list = match client.branches().await {
        Ok(list) => list,
        Err(e) => {
            // The ID cannot be confirmed in Mambu. Accept it if it looks like one; the
            // first sync tells if it is wrong.
            tracing::warn!(error = %e, "Mambu branches are not readable");
            if !looks_like_branch_id(&id) {
                return Err(AppError::BadRequest(CANNOT_LIST_BRANCHES.into()));
            }
            let taken = is_taken(state, &id, for_cooperative).await?;
            return Ok(BranchPreview {
                id,
                name: None,
                available: !taken,
            });
        }
    };
    let branch = list
        .into_iter()
        .find(|b| b.id.eq_ignore_ascii_case(&id))
        .ok_or_else(|| AppError::NotFound("No Mambu branch has this ID".into()))?;
    let taken = is_taken(state, &branch.id, for_cooperative).await?;
    Ok(BranchPreview {
        name: (!taken).then_some(branch.name),
        id: branch.id,
        available: !taken,
    })
}

/// Shortest text accepted for a search by name.
const MIN_SEARCH_LEN: usize = 3;
/// Most branches a search returns, so it cannot be used to list all of them.
const MAX_SEARCH_RESULTS: usize = 8;

/// A branch matches when its ID equals the text, or its name contains it.
fn matches_query(branch_id: &str, name: &str, query: &str) -> bool {
    let q = query.trim().to_lowercase();
    branch_id.eq_ignore_ascii_case(&q) || name.to_lowercase().contains(&q)
}

/// Searches Mambu branches by ID or by part of the name. Only branches that can
/// be linked to `for_cooperative` are returned, never those of another
/// cooperative, and at most a few, so the full list cannot be read.
pub async fn search_branches(
    state: &AppState,
    query: &str,
    for_cooperative: Option<Uuid>,
) -> AppResult<Vec<BranchPreview>> {
    let q = query.trim();
    if q.chars().count() < MIN_SEARCH_LEN && clean_branch_id(q).is_err() {
        return Err(AppError::BadRequest(format!(
            "Type at least {MIN_SEARCH_LEN} letters of the SACCO name or its Mambu ID"
        )));
    }
    let client = state.mambu_client.clone().ok_or_else(|| {
        AppError::BadRequest("The Mambu integration is not configured on this server".into())
    })?;
    let branches = match client.branches().await {
        Ok(list) => list,
        Err(e) => {
            tracing::warn!(error = %e, "Mambu branches are not readable");
            if !looks_like_branch_id(q) {
                return Err(AppError::BadRequest(CANNOT_LIST_BRANCHES.into()));
            }
            let id = clean_branch_id(q)?;
            return Ok(if is_taken(state, &id, for_cooperative).await? {
                Vec::new()
            } else {
                vec![BranchPreview {
                    id,
                    name: None,
                    available: true,
                }]
            });
        }
    };
    let mut found = Vec::new();
    for branch in branches {
        if found.len() >= MAX_SEARCH_RESULTS {
            break;
        }
        if q.chars().count() < MIN_SEARCH_LEN && !branch.id.eq_ignore_ascii_case(q) {
            continue;
        }
        if !matches_query(&branch.id, &branch.name, q) {
            continue;
        }
        let taken = state
            .mambu_repo
            .find_link_by_branch(&branch.id)
            .await?
            .is_some_and(|l| Some(l.cooperative_id) != for_cooperative);
        if !taken {
            found.push(BranchPreview {
                name: Some(branch.name),
                id: branch.id,
                available: true,
            });
        }
    }
    found.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(found)
}

/// Checks that the branch exists and is free (or already linked to `for_cooperative`)
/// and returns its canonical ID.
pub async fn ensure_branch_available(
    state: &AppState,
    raw_id: &str,
    for_cooperative: Option<Uuid>,
) -> AppResult<String> {
    let preview = preview_branch(state, raw_id, for_cooperative).await?;
    if !preview.available {
        return Err(AppError::Conflict(
            "That Mambu branch is already linked to another cooperative".into(),
        ));
    }
    Ok(preview.id)
}

/// A cooperative that has been synced once keeps its Mambu link: the imported data
/// belongs to that branch.
pub async fn ensure_link_unlocked(state: &AppState, cooperative_id: Uuid) -> AppResult<()> {
    if state.mambu_repo.has_synced(cooperative_id).await? {
        return Err(AppError::Conflict(
            "This cooperative has already been synced from Mambu, so its Mambu link can no longer be changed or removed".into(),
        ));
    }
    Ok(())
}

pub async fn link_cooperative(
    state: &AppState,
    cooperative_id: Uuid,
    raw_id: &str,
    linked_by: &str,
) -> AppResult<String> {
    let branch_id = ensure_branch_available(state, raw_id, Some(cooperative_id)).await?;
    if let Some(current) = state.mambu_repo.find_link(cooperative_id).await? {
        if !current.mambu_branch_id.eq_ignore_ascii_case(&branch_id) {
            ensure_link_unlocked(state, cooperative_id).await?;
        }
    }
    if let Err(e) = state
        .mambu_repo
        .upsert_link(cooperative_id, &branch_id, Some(linked_by.to_string()))
        .await
    {
        let unique = matches!(
            &e,
            AppError::DatabaseError(db) if matches!(db.sql_err(), Some(sea_orm::SqlErr::UniqueConstraintViolation(_)))
        );
        if unique {
            return Err(AppError::Conflict(
                "That Mambu branch is already linked to another cooperative".into(),
            ));
        }
        return Err(e);
    }
    warm_ledger_cache(state, &branch_id);
    Ok(branch_id)
}

/// Reads the history of a newly linked branch in the background, so that its first
/// sync is quick. A failure is only logged: the sync reads what is missing itself.
fn warm_ledger_cache(state: &AppState, branch_id: &str) {
    let Some(client) = state.mambu_client.clone() else {
        return;
    };
    let repo = state.mambu_repo.clone();
    let branch = branch_id.to_string();
    tokio::spawn(async move {
        if let Err(e) =
            crate::services::mambu::ledger_source::warm_cache(&client, &repo, &branch).await
        {
            tracing::warn!(branch = %branch, error = %e, "Mambu ledger cache could not be warmed");
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_plain_branch_ids() {
        assert_eq!(clean_branch_id(" ES0006 ").unwrap(), "ES0006");
        assert_eq!(clean_branch_id("sacco_1-a").unwrap(), "sacco_1-a");
    }

    #[test]
    fn query_matches_id_exactly_or_name_in_part() {
        assert!(matches_query("ES0006", "Asikhutulisane SACCO", "es0006"));
        assert!(matches_query("ES0006", "Asikhutulisane SACCO", "khutuli"));
        assert!(!matches_query("ES0006", "Asikhutulisane SACCO", "ES000"));
        assert!(!matches_query("ES0006", "Asikhutulisane SACCO", "sambu"));
    }

    #[test]
    fn only_text_with_a_digit_counts_as_an_unverifiable_branch_id() {
        assert!(looks_like_branch_id("ES0006"));
        assert!(looks_like_branch_id("BUS001"));
        assert!(!looks_like_branch_id("khutu"));
        assert!(!looks_like_branch_id("Asikhutulisane"));
        assert!(!looks_like_branch_id("E6"));
    }

    #[test]
    fn rejects_empty_long_and_odd_characters() {
        assert!(clean_branch_id("").is_err());
        assert!(clean_branch_id("   ").is_err());
        assert!(clean_branch_id(&"A".repeat(65)).is_err());
        assert!(clean_branch_id("ES 0006").is_err());
        assert!(clean_branch_id("ES0006/../x").is_err());
    }
}
