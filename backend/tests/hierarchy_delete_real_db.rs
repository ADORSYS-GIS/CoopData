//! Runs the real delete against a real PostgreSQL database and then looks for
//! rows left behind in every table.
//!
//! Opt-in, because it DELETES from the database it is pointed at: always use a
//! throwaway copy (for example a restored backup), never a live database.
//!
//! ```text
//! TEST_DATABASE_URL=postgres://user:pass@localhost:5432/coopdata_scratch \
//! HD_KIND=federation HD_ID=<keycloak id> \
//!   cargo test --test hierarchy_delete_real_db -- --ignored --nocapture
//! ```
//!
//! `HD_KIND` is `federation`, `apex` or `cooperative`; `HD_ID` is the Keycloak
//! id of the item to delete.

use coop_data_backend::services::hierarchy_delete::{self, Root};
use coop_data_backend::Database;
use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};

async fn column_u64(db: &Database, sql: &str) -> u64 {
    let row = db
        .query_one(Statement::from_string(DatabaseBackend::Postgres, sql))
        .await
        .expect("query")
        .expect("a row");
    row.try_get_by_index::<i64>(0).expect("a count") as u64
}

async fn ids(db: &Database, sql: &str) -> Vec<String> {
    db.query_all(Statement::from_string(DatabaseBackend::Postgres, sql))
        .await
        .expect("query")
        .iter()
        .map(|r| {
            r.try_get_by_index::<uuid::Uuid>(0)
                .expect("an id")
                .to_string()
        })
        .collect()
}

fn in_list(ids: &[String]) -> String {
    if ids.is_empty() {
        "('00000000-0000-0000-0000-000000000000')".to_string()
    } else {
        format!(
            "({})",
            ids.iter()
                .map(|i| format!("'{i}'"))
                .collect::<Vec<_>>()
                .join(",")
        )
    }
}

/// Every base table that has a column of the given name.
async fn tables_with(db: &Database, column: &str) -> Vec<String> {
    let sql = format!(
        "SELECT c.table_name FROM information_schema.columns c \
         JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema \
         WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE' AND c.column_name = '{column}' \
         ORDER BY 1"
    );
    db.query_all(Statement::from_string(DatabaseBackend::Postgres, sql))
        .await
        .expect("columns")
        .iter()
        .map(|r| r.try_get_by_index::<String>(0).expect("a table"))
        .collect()
}

#[tokio::test]
#[ignore = "deletes from the database in TEST_DATABASE_URL: use a copy"]
async fn deleting_leaves_no_row_behind_in_any_table() {
    let url = std::env::var("TEST_DATABASE_URL").expect("TEST_DATABASE_URL");
    let kind = std::env::var("HD_KIND").expect("HD_KIND");
    let target = std::env::var("HD_ID").expect("HD_ID");
    let db = Database::new(sea_orm::Database::connect(&url).await.expect("connect"));

    let (fed_ids, apex_ids, coop_ids) = match kind.as_str() {
        "federation" => {
            let f = ids(
                &db,
                &format!("SELECT id FROM federations WHERE keycloak_id = '{target}'"),
            )
            .await;
            let a = ids(
                &db,
                &format!(
                    "SELECT id FROM apexes WHERE federation_id IN {}",
                    in_list(&f)
                ),
            )
            .await;
            let c = ids(
                &db,
                &format!(
                    "SELECT id FROM cooperatives WHERE apex_id IN {}",
                    in_list(&a)
                ),
            )
            .await;
            (f, a, c)
        }
        "apex" => {
            let a = ids(
                &db,
                &format!("SELECT id FROM apexes WHERE keycloak_id = '{target}'"),
            )
            .await;
            let c = ids(
                &db,
                &format!(
                    "SELECT id FROM cooperatives WHERE apex_id IN {}",
                    in_list(&a)
                ),
            )
            .await;
            (vec![], a, c)
        }
        "cooperative" => {
            let c = ids(
                &db,
                &format!("SELECT id FROM cooperatives WHERE keycloak_id = '{target}'"),
            )
            .await;
            (vec![], vec![], c)
        }
        other => panic!("HD_KIND must be federation, apex or cooperative, not {other}"),
    };
    assert!(
        !(fed_ids.is_empty() && apex_ids.is_empty() && coop_ids.is_empty()),
        "{kind} {target} is not in the database"
    );
    let sub_ids = ids(
        &db,
        &format!(
            "SELECT id FROM submissions WHERE cooperative_id IN {}",
            in_list(&coop_ids)
        ),
    )
    .await;
    let coops_before = column_u64(&db, "SELECT count(*) FROM cooperatives").await;
    let subs_before = column_u64(&db, "SELECT count(*) FROM submissions").await;

    let root = match kind.as_str() {
        "federation" => Root::Federation(&target),
        "apex" => Root::Apex(&target),
        _ => Root::Cooperative(&target),
    };
    let (removal, keys) = hierarchy_delete::delete_rows(&db, root, &[])
        .await
        .expect("delete");
    println!(
        "removed: {} cooperatives, {} submissions, {} stored files ({} keys)",
        removal.cooperatives,
        removal.submissions,
        removal.stored_files,
        keys.len()
    );

    // Nothing may still point at a deleted federation, apex, cooperative or submission.
    let mut leftovers: Vec<String> = Vec::new();
    for (column, list) in [
        ("federation_id", &fed_ids),
        ("apex_id", &apex_ids),
        ("cooperative_id", &coop_ids),
        ("submission_id", &sub_ids),
    ] {
        for table in tables_with(&db, column).await {
            let n = column_u64(
                &db,
                &format!(
                    "SELECT count(*) FROM \"{table}\" WHERE \"{column}\" IN {}",
                    in_list(list)
                ),
            )
            .await;
            if n > 0 {
                leftovers.push(format!("{table}.{column}: {n} row(s)"));
            }
        }
    }
    for (table, list) in [
        ("federations", &fed_ids),
        ("apexes", &apex_ids),
        ("cooperatives", &coop_ids),
        ("submissions", &sub_ids),
    ] {
        let n = column_u64(
            &db,
            &format!("SELECT count(*) FROM {table} WHERE id IN {}", in_list(list)),
        )
        .await;
        if n > 0 {
            leftovers.push(format!("{table}.id: {n} row(s)"));
        }
    }
    assert!(leftovers.is_empty(), "rows left behind: {leftovers:#?}");

    // Everything else is untouched.
    let coops_after = column_u64(&db, "SELECT count(*) FROM cooperatives").await;
    let subs_after = column_u64(&db, "SELECT count(*) FROM submissions").await;
    assert_eq!(coops_before - coops_after, coop_ids.len() as u64);
    assert_eq!(subs_before - subs_after, sub_ids.len() as u64);
    assert_eq!(removal.cooperatives, coop_ids.len());
    assert_eq!(removal.submissions, sub_ids.len());
}
