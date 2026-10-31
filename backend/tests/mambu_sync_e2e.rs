//! End-to-end test of the Mambu sync against a real Postgres database and a
//! stand-in Mambu server. Ignored by default.
//!
//! Run: TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/coopdata_test \
//!      cargo test --test mambu_sync_e2e -- --ignored --nocapture

mod common;

use common::mambu::{fake_mambu, scalar, serve, text, wait_for_run};
use coop_data_backend::auth::claims::Claims;
use coop_data_backend::services::mambu::client::MambuApiClient;
use coop_data_backend::services::mambu::sync::{start_run, SyncLevel, SyncScope};
use sea_orm::ConnectionTrait;
use serde_json::json;
use std::sync::Arc;

#[tokio::test]
#[ignore]
async fn mambu_sync_creates_a_ministry_review_submission_from_mambu_data() {
    let Ok(url) = std::env::var("TEST_DATABASE_URL") else {
        eprintln!("TEST_DATABASE_URL not set, skipping");
        return;
    };
    let conn = sea_orm::Database::connect(&url).await.unwrap();
    let setup = [
        "INSERT INTO federations (id, keycloak_id, display_name) VALUES ('00000000-0000-0000-0000-0000000000f1', 'kc-fed-e2e', 'Fed')",
        "INSERT INTO apexes (id, keycloak_id, federation_id, organization_keycloak_id, display_name) VALUES ('00000000-0000-0000-0000-0000000000a1', 'kc-apex-e2e', '00000000-0000-0000-0000-0000000000f1', 'kc-org', 'Apex')",
        "INSERT INTO cooperatives (id, keycloak_id, apex_id, display_name, name, institution_type) VALUES ('00000000-0000-0000-0000-0000000000c1', 'kc-coop-e2e', '00000000-0000-0000-0000-0000000000a1', 'Asikhutulisane SACCO', 'asikhutulisane', 'sacco')",
    ];
    for sql in setup {
        conn.execute_unprepared(sql).await.unwrap();
    }
    let income = scalar(&conn, "SELECT account_code::bigint FROM chart_of_accounts WHERE account_category='income' AND NOT is_total AND NOT is_section_header ORDER BY display_order LIMIT 1").await;
    let liability = scalar(&conn, "SELECT account_code::bigint FROM chart_of_accounts WHERE account_category='liabilities' AND NOT is_total AND NOT is_section_header ORDER BY display_order LIMIT 1").await;

    let base = serve(fake_mambu()).await;
    let app_conn = sea_orm::Database::connect(&url).await.unwrap();
    let app = common::mock::TestApp::with_db(app_conn).await;
    let mut state = app.state;
    state.mambu_client = Some(Arc::new(MambuApiClient::with_api_key(&base, "test", 200)));

    state
        .mambu_repo
        .upsert_link(
            uuid::Uuid::parse_str("00000000-0000-0000-0000-0000000000c1").unwrap(),
            "ES0006",
            None,
        )
        .await
        .unwrap();
    state
        .mambu_repo
        .upsert_account_mapping("01101", 1101, 1)
        .await
        .unwrap();
    state
        .mambu_repo
        .upsert_account_mapping("5001", liability as i32, 1)
        .await
        .unwrap();
    state
        .mambu_repo
        .upsert_account_mapping("4001", income as i32, 1)
        .await
        .unwrap();
    state
        .mambu_repo
        .upsert_account_mapping("6001", 3101, 1)
        .await
        .unwrap();

    let claims: Claims = serde_json::from_value(json!({
        "sub": "00000000-0000-0000-0000-0000000000b1", "exp": 4102444800u64, "iat": 0, "iss": "test",
        "name": "Test Ministry"
    }))
    .unwrap();

    let run = start_run(
        &state,
        2026,
        9,
        Arc::new(claims.clone()),
        SyncLevel::Ministry,
        SyncScope::All,
    )
    .await
    .unwrap();
    assert_eq!(wait_for_run(&state, run.id).await, "completed");

    let items = state.mambu_repo.list_items(run.id).await.unwrap();
    assert_eq!(items.len(), 1);
    let item = &items[0];
    assert!(item.error.is_none(), "{:?}", item.error);
    assert!(
        item.status == "flagged" || item.status == "synced",
        "status {}",
        item.status
    );
    assert_eq!(item.members, 2, "blacklisted member must be excluded");
    assert_eq!(
        item.savings_accounts, 1,
        "only the voluntary savings account"
    );
    assert_eq!(item.fixed_deposits, 1);
    assert_eq!(item.loans, 1, "closed old loan excluded");
    assert_eq!(
        item.ledger_lines, 7,
        "assets, liabilities, equity, income, the unmapped asset in its default account and the two surplus lines"
    );
    assert_eq!(item.unmapped_ledger_accounts, 1);
    assert!(item.warnings.to_string().contains("LEDGER_UNMAPPED"));

    let sub_id = item.submission_id.expect("submission created");
    let sid = sub_id.to_string();
    assert_eq!(
        text(
            &conn,
            &format!("SELECT submission_method FROM submissions WHERE id='{sid}'")
        )
        .await,
        "mambu"
    );
    assert_eq!(
        text(
            &conn,
            &format!("SELECT status::text FROM submissions WHERE id='{sid}'")
        )
        .await,
        "in_review"
    );
    assert_eq!(
        text(
            &conn,
            &format!("SELECT current_tier::text FROM submissions WHERE id='{sid}'")
        )
        .await,
        "ministry"
    );
    assert_eq!(
        scalar(
            &conn,
            &format!("SELECT count(*) FROM members WHERE submission_id='{sid}'")
        )
        .await,
        2
    );
    assert_eq!(scalar(&conn, &format!("SELECT share_balance::float8::bigint FROM members WHERE submission_id='{sid}' AND member_id='SAP0001'")).await, 5000);
    assert_eq!(text(&conn, &format!("SELECT region::text FROM members WHERE submission_id='{sid}' AND member_id='SAP0001'")).await, "Lubombo");
    assert_eq!(text(&conn, &format!("SELECT region::text FROM members WHERE submission_id='{sid}' AND member_id='SAP0003'")).await, "Manzini");
    assert_eq!(text(&conn, &format!("SELECT urban_rural::text FROM members WHERE submission_id='{sid}' AND member_id='SAP0001'")).await, "Unknown");
    assert_eq!(
        text(
            &conn,
            &format!("SELECT loan_status::text FROM loans WHERE submission_id='{sid}'")
        )
        .await,
        "Arrears"
    );
    assert_eq!(
        text(
            &conn,
            &format!("SELECT days_past_due_category::text FROM loans WHERE submission_id='{sid}'")
        )
        .await,
        "31-60"
    );
    assert_eq!(
        text(
            &conn,
            &format!("SELECT status::text FROM fixed_deposits WHERE submission_id='{sid}'")
        )
        .await,
        "Active"
    );
    assert_eq!(
        scalar(&conn, &format!("SELECT count(*) FROM balance_sheet_line_items i JOIN financial_statements f ON f.id=i.financial_statement_id WHERE f.submission_id='{sid}'")).await,
        7
    );
    assert_eq!(
        scalar(&conn, &format!("SELECT (value*100)::bigint FROM balance_sheet_line_items i JOIN financial_statements f ON f.id=i.financial_statement_id WHERE f.submission_id='{sid}' AND account_code={income}")).await,
        6000
    );
    assert_eq!(
        scalar(
            &conn,
            "SELECT count(*) FROM members WHERE member_id='SAP0002'"
        )
        .await,
        0
    );

    assert_eq!(
        scalar(&conn, &format!("SELECT count(*) FROM financial_statements WHERE submission_id='{sid}' AND validation_errors IS NOT NULL")).await,
        1,
        "the abnormality detector ran on the synced statement"
    );
    assert!(
        scalar(
            &conn,
            &format!("SELECT count(*) FROM kpi_records WHERE submission_id='{sid}'")
        )
        .await
            > 0,
        "KPIs were computed for the synced submission"
    );

    // Running the same month again replaces the data instead of duplicating it.
    let run2 = start_run(
        &state,
        2026,
        9,
        Arc::new(claims.clone()),
        SyncLevel::Ministry,
        SyncScope::All,
    )
    .await
    .unwrap();
    assert_eq!(wait_for_run(&state, run2.id).await, "completed");
    assert_eq!(
        scalar(
            &conn,
            &format!("SELECT count(*) FROM members WHERE submission_id='{sid}'")
        )
        .await,
        2
    );
    assert_eq!(
        scalar(
            &conn,
            "SELECT count(*) FROM submissions WHERE submission_method='mambu'"
        )
        .await,
        1
    );

    // An approved submission is never overwritten.
    conn.execute_unprepared(&format!(
        "UPDATE submissions SET status='approved' WHERE id='{sid}'"
    ))
    .await
    .unwrap();
    let run3 = start_run(
        &state,
        2026,
        9,
        Arc::new(claims),
        SyncLevel::Ministry,
        SyncScope::All,
    )
    .await
    .unwrap();
    assert_eq!(wait_for_run(&state, run3.id).await, "completed");
    let items3 = state.mambu_repo.list_items(run3.id).await.unwrap();
    assert_eq!(items3[0].status, "skipped");
}
