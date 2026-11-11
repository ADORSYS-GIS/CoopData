//! Keeps the general ledger cache of every linked SACCO up to date in the background, so
//! that a sync never has to read the whole history: the first read of a large SACCO takes
//! a long time, and closed months never change.

use std::collections::HashSet;
use std::time::Duration;

use uuid::Uuid;

use crate::error::AppResult;
use crate::services::mambu::ledger_source::{cache_is_current, warm_cache};
use crate::AppState;

/// After a start-up the sync of a SACCO that was running is resumed first.
const FIRST_RUN_AFTER: Duration = Duration::from_secs(120);
const RUN_EVERY: Duration = Duration::from_secs(6 * 3600);

pub async fn run(state: AppState) {
    tokio::time::sleep(FIRST_RUN_AFTER).await;
    let mut ticker = tokio::time::interval(RUN_EVERY);
    loop {
        ticker.tick().await;
        match warm_all(&state).await {
            Ok(0) => {}
            Ok(n) => tracing::info!(branches = n, "Mambu ledger cache brought up to date"),
            Err(e) => tracing::warn!(error = %e, "Mambu ledger cache warm-up failed"),
        }
    }
}

/// Brings the ledger cache of every linked branch up to date, one branch at a time. A
/// branch that is being synced is left to its sync. Returns how many were read.
pub async fn warm_all(state: &AppState) -> AppResult<usize> {
    let Some(client) = state.mambu_client.clone() else {
        return Ok(0);
    };
    let running: Vec<Uuid> = state
        .mambu_repo
        .list_running_runs()
        .await?
        .into_iter()
        .map(|r| r.id)
        .collect();
    let busy: HashSet<Uuid> = state.mambu_repo.pending_cooperative_ids(running).await?;
    let mut warmed = 0;
    for link in state.mambu_repo.list_links().await? {
        if busy.contains(&link.cooperative_id)
            || cache_is_current(&state.mambu_repo, &link.mambu_branch_id).await
        {
            continue;
        }
        match warm_cache(&client, &state.mambu_repo, &link.mambu_branch_id).await {
            Ok(()) => warmed += 1,
            Err(e) => tracing::warn!(
                branch = %link.mambu_branch_id,
                error = %e,
                "Mambu ledger cache could not be warmed"
            ),
        }
    }
    Ok(warmed)
}
