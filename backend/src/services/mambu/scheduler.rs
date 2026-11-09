//! The automatic sync. Once a month, at night, every linked SACCO that has the automatic
//! sync switched on gets its return of the year refreshed, as a draft at the apex. The
//! apex then only has to check the drafts. In January the year that has just ended is
//! synced, so its last month is complete.

use std::time::Duration;

use chrono::{DateTime, Datelike, Timelike, Utc};

use crate::config::AppConfig;
use crate::error::AppResult;
use crate::services::mambu::sync::{
    existing_submission_reason, start_run, system_claims, SyncScope, SYSTEM_ACTOR,
};
use crate::AppState;

const CHECK_EVERY: Duration = Duration::from_secs(600);

/// Whether the automatic sync may start at this moment.
pub fn is_due(config: &AppConfig, now: DateTime<Utc>) -> bool {
    window_open(
        config.mambu_auto_sync_day,
        config.mambu_auto_sync_start_hour,
        config.mambu_auto_sync_end_hour,
        now,
    )
}

fn window_open(from_day: u32, start_hour: u32, end_hour: u32, now: DateTime<Utc>) -> bool {
    now.day() >= from_day && now.hour() >= start_hour && now.hour() < end_hour
}

/// The year the automatic sync refreshes.
pub fn year_to_sync(now: DateTime<Utc>) -> i32 {
    if now.month() == 1 {
        now.year() - 1
    } else {
        now.year()
    }
}

pub async fn run(state: AppState) {
    if !state.config.mambu_auto_sync_enabled || state.mambu_client.is_none() {
        tracing::info!("Automatic Mambu sync is off");
        return;
    }
    tracing::info!("Automatic Mambu sync is on");
    let mut ticker = tokio::time::interval(CHECK_EVERY);
    loop {
        ticker.tick().await;
        match tick(&state, Utc::now()).await {
            Ok(0) => {}
            Ok(count) => tracing::info!(cooperatives = count, "Automatic Mambu sync started"),
            Err(e) => tracing::warn!(error = %e, "Automatic Mambu sync could not start"),
        }
    }
}

/// One check. Returns the number of cooperatives whose sync was started.
pub async fn tick(state: &AppState, now: DateTime<Utc>) -> AppResult<usize> {
    if !is_due(&state.config, now) {
        return Ok(0);
    }
    let month = now.format("%Y-%m").to_string();
    let ids = state.mambu_repo.claim_due_auto_syncs(&month).await?;
    if ids.is_empty() {
        return Ok(0);
    }
    // A year that already has a submission is never imported, so those SACCOs keep their
    // claim for this month and are not tried again.
    let year = year_to_sync(now);
    let mut ids_to_sync = Vec::new();
    for id in ids {
        if existing_submission_reason(state, id, year).await?.is_none() {
            ids_to_sync.push(id);
        }
    }
    let ids = ids_to_sync;
    if ids.is_empty() {
        return Ok(0);
    }
    let count = ids.len();
    let started = start_run(
        state,
        year,
        0,
        system_claims(SYSTEM_ACTOR, "Automatic sync"),
        SyncScope::Cooperatives(ids.clone()),
    )
    .await;
    match started {
        Ok(_) => Ok(count),
        Err(e) => {
            // Give the links back: the next check tries again.
            state
                .mambu_repo
                .release_auto_sync_claims(ids, &month)
                .await?;
            Err(e)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    fn at(y: i32, m: u32, d: u32, h: u32) -> DateTime<Utc> {
        Utc.with_ymd_and_hms(y, m, d, h, 0, 0).unwrap()
    }

    #[test]
    fn it_runs_at_night_from_the_second_day_of_the_month() {
        let open = |now| window_open(2, 1, 6, now);
        assert!(open(at(2026, 11, 2, 2)));
        assert!(open(at(2026, 11, 15, 5)));
        assert!(!open(at(2026, 11, 1, 2)), "too early in the month");
        assert!(!open(at(2026, 11, 2, 12)), "not at night");
        assert!(!open(at(2026, 11, 2, 0)), "before the window");
    }

    #[test]
    fn january_syncs_the_year_that_ended() {
        assert_eq!(year_to_sync(at(2027, 1, 2, 2)), 2026);
        assert_eq!(year_to_sync(at(2026, 11, 2, 2)), 2026);
    }
}
