//! Reads one month of a real Mambu journal and prints how long it took. Ignored by default;
//! it needs the real credentials in the environment and reads only.
//!
//! Run: MAMBU_BASE_URL=... MAMBU_USERNAME=... MAMBU_PASSWORD=... MAMBU_BENCH_BRANCH=ES0005 \
//!      cargo test --release --test mambu_journal_real_bench -- --ignored --nocapture

mod common;

use std::time::Instant;

use chrono::NaiveDate;
use coop_data_backend::services::mambu::client::MambuApiClient;
use coop_data_backend::services::mambu::journal::{self, JournalTotals};

#[tokio::test]
#[ignore]
async fn one_real_month_of_the_journal() {
    let (Ok(base), Ok(user), Ok(password)) = (
        std::env::var("MAMBU_BASE_URL"),
        std::env::var("MAMBU_USERNAME"),
        std::env::var("MAMBU_PASSWORD"),
    ) else {
        eprintln!("Mambu credentials not set, skipping");
        return;
    };
    let branch = std::env::var("MAMBU_BENCH_BRANCH").unwrap_or_else(|_| "ES0005".into());
    let mut config = common::test_config();
    config.mambu_base_url = base;
    config.mambu_username = user;
    config.mambu_password = password;
    let client = MambuApiClient::from_config(&config).expect("client");
    let key = client.branch_key(&branch).await.expect("branch key");

    for (from, to) in [("2023-03-01", "2023-03-31"), ("2022-06-01", "2022-06-30")] {
        let (from, to) = (
            NaiveDate::parse_from_str(from, "%Y-%m-%d").unwrap(),
            NaiveDate::parse_from_str(to, "%Y-%m-%d").unwrap(),
        );
        let started = Instant::now();
        let lines = client.journal_count(&key, from, to).await.unwrap_or(0);
        let counted = started.elapsed();
        let mut totals = JournalTotals::default();
        let read_started = Instant::now();
        journal::read_range(&client, &key, from, to, &mut totals)
            .await
            .expect("read the month");
        let seconds = read_started.elapsed().as_secs_f64();
        println!(
            "BENCH {branch} {from}..{to}: {lines} lines (count {:.1}s), read {:.1}s = {:.0} lines/s",
            counted.as_secs_f64(),
            seconds,
            lines as f64 / seconds
        );
    }
}
