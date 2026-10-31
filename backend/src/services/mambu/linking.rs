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
    let branch = client
        .branches()
        .await?
        .into_iter()
        .find(|b| b.id.eq_ignore_ascii_case(&id))
        .ok_or_else(|| AppError::NotFound("No Mambu branch has this ID".into()))?;
    let taken = state
        .mambu_repo
        .find_link_by_branch(&branch.id)
        .await?
        .is_some_and(|l| Some(l.cooperative_id) != for_cooperative);
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
    let mut found = Vec::new();
    for branch in client.branches().await? {
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

pub async fn link_cooperative(
    state: &AppState,
    cooperative_id: Uuid,
    raw_id: &str,
    linked_by: &str,
) -> AppResult<String> {
    let branch_id = ensure_branch_available(state, raw_id, Some(cooperative_id)).await?;
    if let Err(e) = state
        .mambu_repo
        .upsert_link(cooperative_id, &branch_id, Some(linked_by.to_string()))
        .await
    {
        let text = e.to_string().to_lowercase();
        if text.contains("duplicate") || text.contains("unique") {
            return Err(AppError::Conflict(
                "That Mambu branch is already linked to another cooperative".into(),
            ));
        }
        return Err(e);
    }
    Ok(branch_id)
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
    fn rejects_empty_long_and_odd_characters() {
        assert!(clean_branch_id("").is_err());
        assert!(clean_branch_id("   ").is_err());
        assert!(clean_branch_id(&"A".repeat(65)).is_err());
        assert!(clean_branch_id("ES 0006").is_err());
        assert!(clean_branch_id("ES0006/../x").is_err());
    }
}
