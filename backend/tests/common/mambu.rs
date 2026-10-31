//! Stand-in Mambu server and helpers shared by the Mambu end-to-end tests.

use std::time::Duration;

use axum::extract::Path;
use axum::routing::{get, post};
use axum::{Json, Router};
use sea_orm::{ConnectionTrait, DbBackend, Statement};
use serde_json::{json, Value};

pub async fn serve(app: Router) -> String {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, app).await.unwrap();
    });
    format!("http://{addr}")
}

pub fn fake_mambu() -> Router {
    let branches = json!([{
        "encodedKey": "bk-es0006", "id": "ES0006", "name": "Asikhutulisane SACCO", "state": "ACTIVE",
        "addresses": [{"region": "Manzini", "city": "Manzini"}]
    }]);
    let clients = json!([
        {"encodedKey": "c1", "id": "SAP0001", "state": "ACTIVE", "firstName": "NEVER", "lastName": "STORED",
         "activationDate": "2022-09-18T07:00:29+02:00", "birthDate": "1995-05-01", "gender": "FEMALE",
         "assignedBranchKey": "bk-es0006", "_ADL": {"RG": "LUBOMBO", "mcat": "Member", "nid": "1234567890123"}},
        {"encodedKey": "c2", "id": "SAP0002", "state": "BLACKLISTED",
         "activationDate": "2020-01-10T07:00:00+02:00", "birthDate": "1980-01-01", "gender": "MALE"},
        {"encodedKey": "c3", "id": "SAP0003", "state": "ACTIVE",
         "activationDate": "2023-03-01T07:00:00+02:00", "birthDate": "1960-02-02", "gender": "MALE"}
    ]);
    let deposits = json!([
        {"encodedKey": "d1", "name": "Mandatory Shares", "accountType": "CURRENT_ACCOUNT", "accountState": "DORMANT",
         "accountHolderKey": "c1", "activationDate": "2018-01-01T00:00:00+02:00", "balances": {"totalBalance": 5000}},
        {"encodedKey": "d2", "name": "School Savings", "accountType": "REGULAR_SAVINGS", "accountState": "ACTIVE",
         "accountHolderKey": "c1", "activationDate": "2024-01-01T00:00:00+02:00", "balances": {"totalBalance": 750.5}},
        {"encodedKey": "d3", "name": "Fixed Deposit", "accountType": "SAVINGS_PLAN", "accountState": "ACTIVE",
         "accountHolderKey": "c3", "activationDate": "2026-02-06T00:00:00+02:00",
         "maturityDate": "2027-02-06T00:00:00+02:00", "balances": {"totalBalance": 20000}},
        {"encodedKey": "d4", "name": "Year End Payout Account", "accountType": "REGULAR_SAVINGS", "accountState": "ACTIVE",
         "accountHolderKey": "c1", "activationDate": "2024-01-01T00:00:00+02:00", "balances": {"totalBalance": 10}},
        {"encodedKey": "d5", "name": "School Savings", "accountType": "REGULAR_SAVINGS", "accountState": "ACTIVE",
         "accountHolderKey": "c2", "activationDate": "2024-01-01T00:00:00+02:00", "balances": {"totalBalance": 99}}
    ]);
    let loans = json!([
        {"encodedKey": "l1", "loanName": "Quick Loan", "accountState": "ACTIVE_IN_ARREARS", "accountHolderKey": "c1",
         "accountHolderType": "CLIENT", "loanAmount": 5000, "balances": {"principalBalance": 1200}, "daysInArrears": 45,
         "interestSettings": {"interestRate": 2.5, "interestChargeFrequency": "EVERY_MONTH"},
         "disbursementDetails": {"disbursementDate": "2026-01-01T00:00:00+02:00", "firstRepaymentDate": "2026-02-01T00:00:00+02:00"},
         "scheduleSettings": {"repaymentInstallments": 12, "repaymentPeriodCount": 1, "repaymentPeriodUnit": "MONTHS"}},
        {"encodedKey": "l2", "loanName": "Quick Loan", "accountState": "CLOSED", "accountSubState": "REPAID",
         "accountHolderKey": "c1", "closedDate": "2020-01-01T00:00:00+02:00",
         "disbursementDetails": {"disbursementDate": "2019-01-01T00:00:00+02:00"}}
    ]);
    let gl = |code: &str, kind: &str| json!({"glCode": code, "name": code, "type": kind, "usage": "DETAIL", "currency": {"currencyCode": "SZL"}});
    // The month report balances: assets 1005 = liabilities 400 + equity 325 + earnings 280.
    // The year-to-date report agrees on every closing and only differs in the movement.
    let ytd_report = json!({"reportKey": "rk-ytd", "status": "COMPLETE", "items": [
        {"glAccount": gl("01101", "ASSET"), "amounts": {"closingBalance": 1000.0}},
        {"glAccount": gl("9999", "ASSET"), "amounts": {"closingBalance": 5.0}},
        {"glAccount": gl("5001", "LIABILITY"), "amounts": {"closingBalance": 400.0}},
        {"glAccount": gl("6001", "EQUITY"), "amounts": {"closingBalance": 325.0}},
        {"glAccount": gl("4001", "INCOME"), "amounts": {"openingBalance": 200.0, "debits": 10.0, "credits": 90.0, "closingBalance": 280.0}}
    ]});
    let month_report = json!({"reportKey": "rk-month", "status": "COMPLETE", "items": [
        {"glAccount": gl("01101", "ASSET"), "amounts": {"closingBalance": 1000.0}},
        {"glAccount": gl("9999", "ASSET"), "amounts": {"closingBalance": 5.0}},
        {"glAccount": gl("5001", "LIABILITY"), "amounts": {"closingBalance": 400.0}},
        {"glAccount": gl("6001", "EQUITY"), "amounts": {"closingBalance": 325.0}},
        {"glAccount": gl("4001", "INCOME"), "amounts": {"debits": 10.0, "credits": 70.0, "closingBalance": 280.0}}
    ]});
    let page = |data: Value| {
        get(move || {
            let data = data.clone();
            async move { Json(data) }
        })
    };
    Router::new()
        .route("/branches", page(branches))
        .route("/clients", page(clients))
        .route("/deposits", page(deposits))
        .route("/loans", page(loans))
        .route("/depositproducts", page(json!([])))
        .route("/loanproducts", page(json!([])))
        .route(
            "/accounting/reports",
            post(|Json(body): Json<Value>| async move {
                let key = if body["startDate"].as_str() == Some("2026-01-01") {
                    "rk-ytd"
                } else {
                    "rk-month"
                };
                Json(json!({"reportKey": key, "status": "QUEUED"}))
            }),
        )
        .route(
            "/accounting/reports/{key}",
            get(move |Path(key): Path<String>| {
                let report = if key == "rk-ytd" {
                    ytd_report.clone()
                } else {
                    month_report.clone()
                };
                async move { Json(report) }
            }),
        )
}

pub async fn scalar(db: &sea_orm::DatabaseConnection, sql: &str) -> i64 {
    db.query_one(Statement::from_string(DbBackend::Postgres, sql.to_string()))
        .await
        .unwrap()
        .unwrap()
        .try_get_by_index::<i64>(0)
        .unwrap()
}

pub async fn text(db: &sea_orm::DatabaseConnection, sql: &str) -> String {
    db.query_one(Statement::from_string(DbBackend::Postgres, sql.to_string()))
        .await
        .unwrap()
        .unwrap()
        .try_get_by_index::<String>(0)
        .unwrap()
}

pub async fn wait_for_run(state: &coop_data_backend::AppState, run_id: uuid::Uuid) -> String {
    for _ in 0..120 {
        let run = state.mambu_repo.find_run(run_id).await.unwrap().unwrap();
        if run.status != "running" {
            return run.status;
        }
        tokio::time::sleep(Duration::from_millis(250)).await;
    }
    panic!("sync run did not finish");
}
