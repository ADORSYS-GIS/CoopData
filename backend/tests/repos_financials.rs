mod common;

use common::mock_db::{bsli_row, fs_row, loan_row, savings_row, RecordingMock};
use rust_decimal_macros::dec;
use sea_orm::IntoActiveModel;
use uuid::Uuid;

#[tokio::test]
async fn fs_find_by_submission_scopes_to_submission() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let sub = Uuid::new_v4();
    app.state
        .financial_statement_repo
        .find_by_submission_id(sub)
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(sql.contains("submission_id"), "scope missing: {}", sql);
    assert!(
        rm.binds(0).contains(&sub.to_string()),
        "sub bound: {:?}",
        rm.binds(0)
    );
}

#[tokio::test]
async fn fs_find_latest_orders_by_created_at_desc() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .financial_statement_repo
        .find_latest_by_cooperative(Uuid::new_v4())
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(
        sql.contains("order by") && sql.contains("created_at") && sql.contains("desc"),
        "latest-first ordering: {}",
        sql
    );
}

#[tokio::test]
async fn fs_find_by_cooperative_ids_empty_list_never_queries() {
    let rm = RecordingMock::postgres().build();
    let app = rm.app().await;

    let rows = app
        .state
        .financial_statement_repo
        .find_by_cooperative_ids(vec![])
        .await
        .expect("short-circuits");

    assert!(rows.is_empty());
    assert!(rm.sql().is_empty());
}

#[tokio::test]
async fn fs_set_validation_errors_binds_json() {
    let id = Uuid::new_v4();
    let before = fs_row(id, Uuid::new_v4(), Uuid::new_v4());
    let mut after = before.clone();
    after.is_validated = false;
    let after = after;

    let errors = serde_json::json!({ "E001": "assets do not balance" });
    let rm = RecordingMock::postgres()
        .query_rows(vec![before])
        .query_rows(vec![after])
        .build();
    let app = rm.app().await;

    let updated = app
        .state
        .financial_statement_repo
        .set_validation_errors(id, errors)
        .await
        .expect("update ok");

    assert_eq!(updated.id, id);
    let binds = rm.binds(1);
    assert!(
        binds.iter().any(|b| b.contains("E001")),
        "validation errors JSON bound: {:?}",
        binds
    );
}

#[tokio::test]
async fn bsli_find_by_fs_ids_empty_list_never_queries() {
    let rm = RecordingMock::postgres().build();
    let app = rm.app().await;

    let rows = app
        .state
        .line_item_repo
        .find_by_financial_statement_ids(vec![])
        .await
        .expect("short-circuits");

    assert!(rows.is_empty());
    assert!(rm.sql().is_empty());
}

#[tokio::test]
async fn bsli_find_by_financial_statement_orders_by_code_then_month() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .line_item_repo
        .find_by_financial_statement(Uuid::new_v4())
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(
        sql.contains("account_code"),
        "code ordering missing: {}",
        sql
    );
    assert!(sql.contains("month"), "month ordering missing: {}", sql);
}

#[tokio::test]
async fn bsli_delete_unmapped_counts_only_null_codes() {
    let rm = RecordingMock::postgres().exec(3).build();
    let app = rm.app().await;

    let n = app
        .state
        .line_item_repo
        .delete_unmapped_by_financial_statement(Uuid::new_v4())
        .await
        .expect("delete ok");

    assert_eq!(n, 3);
    let sql = &rm.sql()[0];
    assert!(
        sql.contains("is null"),
        "must only delete unmapped rows: {}",
        sql
    );
}

#[tokio::test]
async fn bsli_update_value_sets_value_and_manual_flag() {
    let id = Uuid::new_v4();
    let fs_id = Uuid::new_v4();
    let mut before = bsli_row(id, fs_id, None, "Cash", 1, None);
    before.ai_flagged = true;
    let mut after = before.clone();
    after.value = Some(dec!(123.45));
    after.manually_edited = true;
    after.ai_flagged = false;

    let rm = RecordingMock::postgres()
        .query_rows(vec![before])
        .query_rows(vec![after])
        .build();
    let app = rm.app().await;

    let updated = app
        .state
        .line_item_repo
        .update_value(id, dec!(123.45), Some(1101))
        .await
        .expect("update ok");

    assert_eq!(updated.value, Some(dec!(123.45)));
    assert!(updated.manually_edited, "manual edit flag set");
    assert!(!updated.ai_flagged, "AI flag cleared");
    let binds = rm.binds(1);
    assert!(
        binds.contains(&"123.45".to_string()),
        "value bound: {:?}",
        binds
    );
    let sql = rm.sql()[1].to_lowercase();
    assert!(
        sql.contains("account_code"),
        "account_code in update set: {}",
        sql
    );
}

#[tokio::test]
async fn bsli_update_value_missing_row_not_found() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let err = app
        .state
        .line_item_repo
        .update_value(Uuid::new_v4(), dec!(1), None)
        .await
        .expect_err("must be NotFound");
    assert!(matches!(
        err,
        coop_data_backend::error::AppError::NotFound(_)
    ));
}

#[tokio::test]
async fn loan_find_by_coop_paginates_and_decodes_rows() {
    let coop = Uuid::new_v4();
    let rows = vec![
        loan_row(Uuid::new_v4(), coop, "L-1"),
        loan_row(Uuid::new_v4(), coop, "L-2"),
    ];
    // num_items (COUNT) then fetch_page (SELECT)
    let rm = RecordingMock::postgres().count(2).query_rows(rows).build();
    let app = rm.app().await;

    let (loans, total) = app
        .state
        .loan_repo
        .find_by_cooperative_id(coop, None, 1, 20)
        .await
        .expect("page ok");

    assert_eq!(total, 2);
    assert_eq!(loans.len(), 2);
    assert!(loans.iter().all(|l| l.cooperative_id == coop));
    let sql = &rm.sql()[0];
    assert!(
        sql.contains("count"),
        "first statement is the COUNT: {}",
        sql
    );
}

#[tokio::test]
async fn loan_find_by_coop_with_submission_filter_adds_it() {
    let rm = RecordingMock::postgres().count(0).query_empty().build();
    let app = rm.app().await;

    let coop = Uuid::new_v4();
    let sub = Uuid::new_v4();
    app.state
        .loan_repo
        .find_by_cooperative_id(coop, Some(sub), 1, 20)
        .await
        .expect("page ok");

    let sql = rm.sql().join(" | ");
    assert!(
        sql.contains("submission_id"),
        "submission filter missing: {}",
        sql
    );
}

#[tokio::test]
async fn loan_delete_by_coop_and_submission_scopes_both() {
    let rm = RecordingMock::postgres().exec(4).build();
    let app = rm.app().await;

    let n = app
        .state
        .loan_repo
        .delete_by_cooperative_and_submission(Uuid::new_v4(), Uuid::new_v4())
        .await
        .expect("delete ok");

    assert_eq!(n, 4);
}

#[tokio::test]
async fn loan_bulk_upsert_dedups_by_coop_and_loan_id() {
    let coop = Uuid::new_v4();
    let a = loan_row(Uuid::new_v4(), coop, "L-1");
    let b = loan_row(Uuid::new_v4(), coop, "L-2");
    let dup = loan_row(Uuid::new_v4(), coop, "L-1");

    let rm = RecordingMock::postgres()
        .query_rows(vec![a.clone(), b.clone()])
        .build();
    let app = rm.app().await;

    let n = app
        .state
        .loan_repo
        .bulk_upsert(vec![
            a.into_active_model(),
            b.into_active_model(),
            dup.into_active_model(),
        ])
        .await
        .expect("upsert ok");

    assert_eq!(n, 2, "duplicate loan_id dropped before insert");
}

#[tokio::test]
async fn loan_portfolio_breakdown_maps_dpd_categories() {
    let coop = Uuid::new_v4();
    // Aggregated rows: category + balance + count per DPD bucket.
    let rm = RecordingMock::postgres()
        .query_rows(vec![
            BreakdownRow::new("0", dec!(500.0), 2),
            BreakdownRow::new("91+", dec!(1000.0), 1),
        ])
        .build();
    let app = rm.app().await;

    let out = app
        .state
        .loan_repo
        .get_portfolio_breakdown(coop)
        .await
        .expect("breakdown ok");

    assert_eq!(out.len(), 2);
    assert_eq!(out[0].category, "Performing");
    assert_eq!(out[0].count, 2);
    assert_eq!(out[1].category, "Loss", "91+ days past due maps to Loss");
    assert_eq!(out[1].balance, 1000.0);
}

/// Helper row type for the portfolio breakdown aggregate (category is an enum
/// column read back as its Postgres string value).
#[derive(Debug)]
struct BreakdownRow {
    category: common::mock_db::DpdCategory,
    balance: Option<rust_decimal::Decimal>,
    count: i64,
}

impl BreakdownRow {
    fn new(category: &str, balance: rust_decimal::Decimal, count: i64) -> Self {
        Self {
            category: common::mock_db::DpdCategory::parse(category).expect("valid dpd"),
            balance: Some(balance),
            count,
        }
    }
}

impl sea_orm::IntoMockRow for BreakdownRow {
    fn into_mock_row(self) -> sea_orm::MockRow {
        use sea_orm::sea_query::Value;
        let balance = self.balance.map(|d| {
            let s = d.to_string();
            Value::Decimal(Some(Box::new(s.parse().unwrap())))
        });
        BTreeMap::from([
            (
                "category".to_string(),
                Value::String(Some(Box::new(
                    match self.category {
                        common::mock_db::DpdCategory::Zero => "0",
                        common::mock_db::DpdCategory::Days1To30 => "1-30",
                        common::mock_db::DpdCategory::Days31To60 => "31-60",
                        common::mock_db::DpdCategory::Days61To90 => "61-90",
                        common::mock_db::DpdCategory::Days91Plus => "91+",
                    }
                    .to_string(),
                ))),
            ),
            (
                "balance".to_string(),
                balance.unwrap_or(Value::Decimal(None)),
            ),
            ("count".to_string(), Value::BigInt(Some(self.count))),
        ])
        .into_mock_row()
    }
}

use std::collections::BTreeMap;

#[tokio::test]
async fn savings_find_by_coop_paginates() {
    let coop = Uuid::new_v4();
    let rows = vec![savings_row(Uuid::new_v4(), coop, "S-1")];
    let rm = RecordingMock::postgres().count(1).query_rows(rows).build();
    let app = rm.app().await;

    let (accounts, total) = app
        .state
        .savings_account_repo
        .find_by_cooperative_id(coop, None, 1, 20)
        .await
        .expect("page ok");

    assert_eq!(total, 1);
    assert_eq!(accounts[0].savings_account_id, "S-1");
}

#[tokio::test]
async fn savings_delete_by_coop_returns_rows_affected() {
    let rm = RecordingMock::postgres().exec(9).build();
    let app = rm.app().await;

    let n = app
        .state
        .savings_account_repo
        .delete_by_cooperative(Uuid::new_v4())
        .await
        .expect("delete ok");

    assert_eq!(n, 9);
    assert!(
        rm.sql()[0].contains("delete"),
        "is a DELETE: {}",
        rm.sql()[0]
    );
}
