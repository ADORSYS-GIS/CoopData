//! Runs the mapper over recorded Mambu sandbox responses (kept outside the repo).
//! Ignored by default. Prints counts only, never record contents.
//!
//! Run: MAMBU_SAMPLES=$HOME/mambu-samples cargo test --test mambu_samples_check -- --ignored --nocapture

use std::collections::BTreeMap;
use std::path::PathBuf;

use chrono::NaiveDate;
use coop_data_backend::services::mambu::mapper::*;
use coop_data_backend::services::mambu::models::*;
use serde::de::DeserializeOwned;

fn samples() -> Option<PathBuf> {
    std::env::var("MAMBU_SAMPLES").ok().map(PathBuf::from)
}

fn load<T: DeserializeOwned>(dir: &std::path::Path, name: &str) -> Option<Vec<T>> {
    let text = std::fs::read_to_string(dir.join(name)).ok()?;
    let parsed: Result<Vec<T>, _> = serde_json::from_str(&text);
    match parsed {
        Ok(v) => Some(v),
        Err(e) => panic!("{name} does not match the Mambu models: {e}"),
    }
}

fn tally<K: Ord + std::fmt::Debug>(items: impl Iterator<Item = K>) -> BTreeMap<K, usize> {
    let mut m = BTreeMap::new();
    for i in items {
        *m.entry(i).or_default() += 1;
    }
    m
}

#[test]
#[ignore]
fn recorded_sandbox_responses_deserialize_and_map() {
    let Some(dir) = samples() else {
        eprintln!("MAMBU_SAMPLES not set, skipping");
        return;
    };
    let as_of = NaiveDate::from_ymd_opt(2026, 9, 30).unwrap();

    let branches: Vec<MambuBranch> = load(&dir, "branches.json").expect("branches.json");
    println!("branches: {}", branches.len());
    let es6 = branches.iter().find(|b| b.id == "ES0006").expect("ES0006");
    println!(
        "ES0006 region from address: {:?}",
        branch_region(es6).map(|r| r.as_str())
    );

    let clients: Vec<MambuClient> = load(&dir, "clients-branch.json").unwrap_or_default();
    for c in &clients {
        let r = map_member(c, branch_region(es6), as_of);
        println!(
            "raw client sample -> {:?}",
            r.as_ref()
                .map(|m| (m.status.as_str(), m.age_group.clone()))
                .map_err(|e| e.code())
        );
        assert!(!c.id.contains(' '), "client id looks like a name");
    }

    let mut deposits: Vec<MambuDeposit> = Vec::new();
    for f in [
        "deposits.json",
        "deposits-branch.json",
        "deposits-FIXED_DEPOSIT.json",
        "deposits-SAVINGS_PLAN.json",
        "deposits-state-MATURED.json",
        "deposits-state-WITHDRAWN.json",
        "deposits-state-LOCKED.json",
    ] {
        if let Some(mut v) = load::<MambuDeposit>(&dir, f) {
            println!("{f}: {} deposits", v.len());
            deposits.append(&mut v);
        }
    }
    let kinds = tally(deposits.iter().map(|d| classify_deposit(d, None)));
    println!("deposit kinds: {kinds:?}");
    let mut fd_ok = 0;
    let mut fd_defaulted = 0;
    let mut fd_status = Vec::new();
    let mut sv_ok = 0;
    let mut sv_drop = Vec::new();
    for d in &deposits {
        match classify_deposit(d, None) {
            k if k == KIND_FIXED_DEPOSIT => match map_fixed_deposit(d, "M1", as_of, None) {
                Ok((fd, defaulted)) => {
                    fd_ok += 1;
                    fd_defaulted += usize::from(defaulted);
                    fd_status.push(fd.status.as_str());
                    assert!(fd.maturity_date >= fd.start_date);
                }
                Err(e) => sv_drop.push(e.code()),
            },
            k if k == KIND_SHARE || k == KIND_IGNORE => {}
            k => match map_savings(d, "M1", k, as_of) {
                Ok(_) => sv_ok += 1,
                Err(e) => sv_drop.push(e.code()),
            },
        }
    }
    println!(
        "fixed deposits mapped {fd_ok} (default maturity {fd_defaulted}) statuses {:?}",
        tally(fd_status.into_iter())
    );
    println!(
        "savings mapped {sv_ok}; drops {:?}",
        tally(sv_drop.into_iter())
    );

    let mut loans: Vec<MambuLoan> = Vec::new();
    for f in [
        "loans.json",
        "loans-in-arrears.json",
        "loans-closed-written-off.json",
        "loans-RESCHEDULED.json",
        "loans-REFINANCED.json",
    ] {
        if let Some(mut v) = load::<MambuLoan>(&dir, f) {
            println!("{f}: {} loans", v.len());
            loans.append(&mut v);
        }
    }
    let mut status = Vec::new();
    let mut drops = Vec::new();
    let mut types = Vec::new();
    for l in &loans {
        match map_loan(l, "M1", None, as_of) {
            Ok(r) => {
                status.push(format!("{:?}", r.loan_status));
                types.push(r.loan_product_type.clone());
                assert!(r.loan_maturity_date >= r.loan_start_date);
            }
            Err(e) => drops.push(e.code()),
        }
    }
    println!(
        "loan statuses {:?}; types {:?}; drops {:?}",
        tally(status.into_iter()),
        tally(types.into_iter()),
        tally(drops.into_iter())
    );
    for l in loans
        .iter()
        .filter(|l| l.account_state.as_deref() == Some("ACTIVE_IN_ARREARS"))
    {
        assert!(
            l.days_in_arrears.is_some(),
            "arrears loans must carry daysInArrears"
        );
    }

    if let Some(path) = ["accounting-report.json"]
        .iter()
        .map(|f| dir.join(f))
        .find(|p| p.exists())
    {
        let report: MambuReport =
            serde_json::from_str(&std::fs::read_to_string(path).unwrap()).expect("report");
        println!(
            "report items: {} status {:?}",
            report.items.len(),
            report.status
        );
        let by_type = tally(
            report
                .items
                .iter()
                .map(|i| i.gl_account.account_type.clone()),
        );
        println!("report types {by_type:?}");

        // Use the default mapping of migration 65 and check the accounting equation
        // on the CoopData chart, with the computed surplus lines.
        let sql = include_str!("../migrations/65_mambu_default_account_mappings.sql");
        let mut map = std::collections::HashMap::new();
        for line in sql.lines().map(str::trim) {
            let Some(rest) = line.strip_prefix("('") else {
                continue;
            };
            let parts: Vec<&str> = rest
                .trim_end_matches([',', ')'])
                .split(&['\'', ','][..])
                .map(str::trim)
                .filter(|p| !p.is_empty())
                .collect();
            map.insert(
                parts[0].to_string(),
                (
                    parts[1].parse::<i32>().unwrap(),
                    parts[2].parse::<i16>().unwrap(),
                ),
            );
        }
        let ledger = map_ledger(&report.items, None, &map);
        let get = |c: i32| {
            ledger
                .lines
                .iter()
                .find(|l| l.account_code == c)
                .map(|l| l.value)
                .unwrap_or_default()
        };
        let sum = |codes: &[i32]| codes.iter().map(|c| get(*c)).sum::<rust_decimal::Decimal>();
        let assets = sum(&[1101, 1102, 1103, 1104, 1201, 1202, 1203, 1204, 1205])
            - sum(&[1251, 1252])
            + sum(&[1301, 1302, 1303, 1305, 1306])
            - get(1304);
        let liabilities = sum(&[2101, 2102, 2103, 2201, 2202, 2301, 2302, 2303]);
        let equity = sum(&[3101, 3102, 3201, 3202, 3203, 3301, 3302]);
        println!(
            "assets {assets} liabilities {liabilities} equity incl. surplus {equity}; gap {}; unmapped {}",
            assets - liabilities - equity,
            ledger.unmapped.len()
        );
        assert!((assets - liabilities - equity).abs() < rust_decimal::Decimal::from(5));
        assert!(ledger.unmapped.is_empty(), "{:?}", ledger.unmapped);
    }
}
