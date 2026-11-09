//! Deleting a federation, apex or cooperative removes everything below it,
//! database first and Keycloak after, and leaves Keycloak untouched when the
//! database cannot be cleaned.

mod common;

use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::{Arc, Mutex};

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use coop_data_backend::services::hierarchy_delete::{self, KeycloakPlan, Root};
use sea_orm::{DbErr, RuntimeErr, Value};
use serde_json::json;
use uuid::Uuid;

use common::mock::TestApp;
use common::mock_db::{federation_row, RecordingMock};

// ── Fake Keycloak ────────────────────────────────────────────────────────────

#[derive(Default)]
struct Fake {
    /// Members of a group or organization, by id.
    members: HashMap<String, Vec<String>>,
    /// Child groups of a group, by id.
    children: HashMap<String, Vec<String>>,
    /// Top-level groups as (id, organization_id).
    top_groups: Vec<(String, String)>,
    /// Ids whose delete answers 500.
    failing: HashSet<String>,
    /// Ids whose delete answers 404 (already gone).
    gone: HashSet<String>,
    /// Ids Keycloak no longer has: reading their members or children answers 404.
    missing: HashSet<String>,
    /// Every read and delete, in order, as "METHOD kind id".
    calls: Vec<String>,
    reads_fail: bool,
}

type Shared = Arc<Mutex<Fake>>;

struct FakeKeycloak {
    shared: Shared,
    addr: std::net::SocketAddr,
}

impl FakeKeycloak {
    async fn start(fake: Fake) -> Self {
        let shared: Shared = Arc::new(Mutex::new(fake));
        let base = "/admin/realms/test-realm";
        let app = Router::new()
            .route(
                "/realms/test-realm/protocol/openid-connect/token",
                post(|| async {
                    Json(json!({"access_token": "t", "expires_in": 3600, "token_type": "Bearer"}))
                }),
            )
            .route(&format!("{base}/groups"), get(list_groups))
            .route(&format!("{base}/groups/{{id}}/members"), get(group_members))
            .route(
                &format!("{base}/groups/{{id}}/children"),
                get(group_children),
            )
            .route(
                &format!("{base}/organizations/{{id}}/members"),
                get(group_members),
            )
            .route(&format!("{base}/users/{{id}}"), delete(delete_user))
            .route(&format!("{base}/groups/{{id}}"), delete(delete_group))
            .route(&format!("{base}/organizations/{{id}}"), delete(delete_org))
            .with_state(shared.clone());
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        Self { shared, addr }
    }

    fn url(&self) -> String {
        format!("http://{}", self.addr)
    }

    fn calls(&self) -> Vec<String> {
        self.shared.lock().unwrap().calls.clone()
    }

    fn deletes(&self) -> Vec<String> {
        self.calls()
            .into_iter()
            .filter(|c| c.starts_with("DELETE"))
            .collect()
    }
}

fn member_json(id: &str) -> serde_json::Value {
    json!({"id": id, "username": id, "email": null, "firstName": null, "lastName": null})
}

async fn list_groups(State(s): State<Shared>) -> (StatusCode, Json<serde_json::Value>) {
    let mut s = s.lock().unwrap();
    s.calls.push("GET groups".into());
    if s.reads_fail {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "down"})),
        );
    }
    let groups: Vec<_> = s
        .top_groups
        .iter()
        .map(|(id, org)| {
            json!({"id": id, "name": id, "attributes": {"organization_id": [org]}, "subGroups": []})
        })
        .collect();
    (StatusCode::OK, Json(json!(groups)))
}

async fn group_members(
    State(s): State<Shared>,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let mut s = s.lock().unwrap();
    s.calls.push(format!("GET members {id}"));
    if s.missing.contains(&id) {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Could not find group by id"})),
        );
    }
    if s.reads_fail {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "down"})),
        );
    }
    let members: Vec<_> = s
        .members
        .get(&id)
        .map(|ids| ids.iter().map(|m| member_json(m)).collect())
        .unwrap_or_default();
    (StatusCode::OK, Json(json!(members)))
}

async fn group_children(
    State(s): State<Shared>,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    let mut s = s.lock().unwrap();
    s.calls.push(format!("GET children {id}"));
    if s.missing.contains(&id) {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Could not find group by id"})),
        );
    }
    let children: Vec<_> = s
        .children
        .get(&id)
        .map(|ids| ids.iter().map(|c| json!({"id": c, "name": c})).collect())
        .unwrap_or_default();
    (StatusCode::OK, Json(json!(children)))
}

fn remove(s: &mut Fake, kind: &str, id: String) -> (StatusCode, Json<serde_json::Value>) {
    s.calls.push(format!("DELETE {kind} {id}"));
    if s.failing.contains(&id) {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"errorMessage": "boom"})),
        )
    } else if s.gone.contains(&id) {
        (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "Could not find it"})),
        )
    } else {
        (StatusCode::NO_CONTENT, Json(json!(null)))
    }
}

async fn delete_user(
    State(s): State<Shared>,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    remove(&mut s.lock().unwrap(), "user", id)
}

async fn delete_group(
    State(s): State<Shared>,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    remove(&mut s.lock().unwrap(), "group", id)
}

async fn delete_org(
    State(s): State<Shared>,
    Path(id): Path<String>,
) -> (StatusCode, Json<serde_json::Value>) {
    remove(&mut s.lock().unwrap(), "org", id)
}

/// One federation (org-1) with a member, two apex groups of which one belongs
/// to another federation, and two cooperatives under the apex.
fn federation_tree() -> Fake {
    let mut f = Fake::default();
    f.members.insert("org-1".into(), vec!["fed-user".into()]);
    f.top_groups = vec![
        ("apex-1".into(), "org-1".into()),
        ("apex-other".into(), "org-2".into()),
    ];
    f.members.insert("apex-1".into(), vec!["apex-user".into()]);
    f.children
        .insert("apex-1".into(), vec!["coop-1".into(), "coop-2".into()]);
    f.members
        .insert("coop-1".into(), vec!["coop-user-1".into()]);
    f.members.insert(
        "coop-2".into(),
        vec!["coop-user-2".into(), "apex-user".into()],
    );
    f
}

// ── Database rows ────────────────────────────────────────────────────────────

fn id_row(id: Uuid) -> BTreeMap<&'static str, Value> {
    BTreeMap::from([("id", Value::from(id))])
}

fn key_row(key: &str) -> BTreeMap<&'static str, Value> {
    BTreeMap::from([("storage_key", Value::from(key.to_string()))])
}

struct Tree {
    federation: Uuid,
    apex: Uuid,
    coops: [Uuid; 2],
    submissions: [Uuid; 3],
}

fn tree() -> Tree {
    Tree {
        federation: Uuid::new_v4(),
        apex: Uuid::new_v4(),
        coops: [Uuid::new_v4(), Uuid::new_v4()],
        submissions: [Uuid::new_v4(), Uuid::new_v4(), Uuid::new_v4()],
    }
}

/// The answers a federation delete reads, in the order it asks.
fn federation_reads(t: &Tree) -> common::mock_db::RecordingMockBuilder {
    RecordingMock::postgres()
        .query_rows(vec![federation_row(t.federation, "org-1")])
        .query_rows(vec![id_row(t.apex)])
        .query_rows(t.coops.iter().map(|c| id_row(*c)).collect::<Vec<_>>())
        .query_rows(t.submissions.iter().map(|s| id_row(*s)).collect::<Vec<_>>())
        .query_rows(vec![key_row("uploads/a.xlsx"), key_row("uploads/b.pdf")])
        // report_exports: submission reports, then the apex and federation ones
        .query_rows(vec![key_row("exports/v5/individual/x_en.pdf")])
        .exec(2)
        .query_rows(vec![key_row("exports/v5/apex/y_2024_en.pdf")])
        .exec(1)
        .query_empty()
        .exec(0)
}

fn position(sql: &[String], needle: &str) -> usize {
    sql.iter()
        .position(|s| s.contains(needle))
        .unwrap_or_else(|| panic!("no statement contains `{needle}` in {sql:#?}"))
}

fn all_ids(plan: &KeycloakPlan) -> Vec<&str> {
    plan.user_ids
        .iter()
        .chain(&plan.group_ids)
        .map(String::as_str)
        .collect()
}

// ── Planning what Keycloak holds ─────────────────────────────────────────────

#[tokio::test]
async fn plan_for_a_federation_lists_every_user_and_group_below_it_once() {
    let kc = FakeKeycloak::start(federation_tree()).await;
    let app =
        TestApp::with_db_and_keycloak_url(sea_orm::DatabaseConnection::default(), kc.url()).await;

    let plan = hierarchy_delete::plan_federation(&app.state.keycloak, "org-1")
        .await
        .unwrap();

    assert_eq!(plan.organization_id.as_deref(), Some("org-1"));
    assert_eq!(
        plan.user_ids,
        vec!["fed-user", "apex-user", "coop-user-1", "coop-user-2"],
        "a user in two groups is listed once"
    );
    assert_eq!(
        plan.group_ids,
        vec!["coop-1", "coop-2", "apex-1"],
        "children come before the apex that holds them, and another federation's apex is left out"
    );
}

#[tokio::test]
async fn plan_for_an_apex_stops_at_its_own_cooperatives() {
    let kc = FakeKeycloak::start(federation_tree()).await;
    let app =
        TestApp::with_db_and_keycloak_url(sea_orm::DatabaseConnection::default(), kc.url()).await;

    let plan = hierarchy_delete::plan_apex(&app.state.keycloak, "apex-1")
        .await
        .unwrap();

    assert_eq!(plan.organization_id, None);
    assert_eq!(plan.group_ids, vec!["coop-1", "coop-2", "apex-1"]);
    assert_eq!(
        all_ids(&plan).len(),
        6,
        "three users (apex-user once) and three groups"
    );
}

#[tokio::test]
async fn plan_for_a_cooperative_is_its_members_and_its_group() {
    let kc = FakeKeycloak::start(federation_tree()).await;
    let app =
        TestApp::with_db_and_keycloak_url(sea_orm::DatabaseConnection::default(), kc.url()).await;

    let plan = hierarchy_delete::plan_cooperative(&app.state.keycloak, "coop-1")
        .await
        .unwrap();

    assert_eq!(plan.user_ids, vec!["coop-user-1"]);
    assert_eq!(plan.group_ids, vec!["coop-1"]);
}

#[tokio::test]
async fn an_unreadable_keycloak_stops_the_plan_before_anything_is_deleted() {
    let mut fake = federation_tree();
    fake.reads_fail = true;
    let kc = FakeKeycloak::start(fake).await;
    let app =
        TestApp::with_db_and_keycloak_url(sea_orm::DatabaseConnection::default(), kc.url()).await;

    let result = hierarchy_delete::plan_federation(&app.state.keycloak, "org-1").await;

    assert!(result.is_err());
    assert!(kc.deletes().is_empty());
}

// ── Deleting the database rows ───────────────────────────────────────────────

#[tokio::test]
async fn a_federation_delete_removes_reports_users_then_the_federation_in_one_transaction() {
    let t = tree();
    let rm = federation_reads(&t)
        .exec(3) // users
        .exec(1) // federation
        .exec(1) // apex
        .exec(1) // cooperative 1
        .exec(1) // cooperative 2
        .build();

    let (removal, keys) =
        hierarchy_delete::delete_rows(&rm.db, Root::Federation("org-1"), &["fed-user".into()])
            .await
            .unwrap();

    let sql = rm.sql();
    assert!(position(&sql, "from \"federations\"") < position(&sql, "from \"apexes\""));
    assert!(position(&sql, "from \"apexes\"") < position(&sql, "from \"cooperatives\""));
    assert!(position(&sql, "from \"cooperatives\"") < position(&sql, "from \"submissions\""));
    assert!(position(&sql, "from \"submissions\"") < position(&sql, "from \"uploaded_files\""));
    assert!(
        position(&sql, "delete from \"report_exports\"") < position(&sql, "delete from \"users\""),
        "report records go before the users"
    );
    assert!(
        position(&sql, "delete from \"users\"") < position(&sql, "delete from \"federations\""),
        "users go before the federation row"
    );
    assert!(sql.iter().any(|s| s.contains("delete from \"apexes\"")));
    assert_eq!(
        sql.iter()
            .filter(|s| s.contains("delete from \"cooperatives\""))
            .count(),
        2,
        "each cooperative of the apex is deleted"
    );
    assert_eq!(removal.cooperatives, 2);
    assert_eq!(removal.submissions, 3);
    assert_eq!(removal.stored_files, 4, "two uploads and two report PDFs");
    assert!(keys.contains(&"uploads/a.xlsx".to_string()));
    assert!(keys.contains(&"exports/v5/apex/y_2024_en.pdf".to_string()));
}

#[tokio::test]
async fn a_cooperative_delete_clears_the_users_that_point_at_it_not_only_those_keycloak_knows() {
    let t = tree();
    let rm = RecordingMock::postgres()
        .query_rows(vec![id_row(t.coops[0])]) // the cooperative
        .query_rows(vec![id_row(t.submissions[0])])
        .query_empty() // uploaded files
        .query_empty() // submission report records
        .exec(0)
        .exec(2) // users
        .exec(1) // cooperative
        .build();

    let (removal, _) =
        hierarchy_delete::delete_rows(&rm.db, Root::Cooperative("coop-1"), &["coop-user-1".into()])
            .await
            .unwrap();

    let users = rm
        .statements()
        .into_iter()
        .find(|s| s.sql.to_lowercase().contains("delete from \"users\""))
        .expect("users are deleted");
    let sql = users.sql.to_lowercase();
    assert!(
        sql.contains("\"keycloak_id\" in"),
        "users Keycloak knows: {sql}"
    );
    assert!(
        sql.contains("\"cooperative_id\" in"),
        "users linked to the cooperative: {sql}"
    );
    assert_eq!(removal.submissions, 1);
}

#[tokio::test]
async fn deleting_something_the_database_never_had_changes_nothing() {
    let rm = RecordingMock::postgres().query_empty().exec(0).build();

    let (removal, keys) = hierarchy_delete::delete_rows(&rm.db, Root::Apex("ghost"), &[])
        .await
        .unwrap();

    assert_eq!(removal, hierarchy_delete::Removal::default());
    assert!(keys.is_empty());
    assert!(
        !rm.sql()
            .iter()
            .any(|s| s.contains("delete from \"apexes\"")),
        "no apex row to delete"
    );
}

#[tokio::test]
async fn a_failing_database_delete_stops_before_the_federation_row_is_touched() {
    let t = tree();
    let rm = federation_reads(&t)
        .fail_exec(DbErr::Exec(RuntimeErr::Internal("boom".into())))
        .build();

    let result =
        hierarchy_delete::delete_rows(&rm.db, Root::Federation("org-1"), &["fed-user".into()])
            .await;

    assert!(result.is_err());
    assert!(
        !rm.sql()
            .iter()
            .any(|s| s.contains("delete from \"federations\"")),
        "the transaction is abandoned before the parent rows"
    );
}

// ── The whole delete, database and Keycloak together ─────────────────────────

#[tokio::test]
async fn deleting_a_federation_removes_users_then_groups_then_the_organization() {
    let t = tree();
    let rm = federation_reads(&t)
        .exec(3)
        .exec(1)
        .exec(1)
        .exec(1)
        .exec(1)
        .build();
    let kc = FakeKeycloak::start(federation_tree()).await;
    let app = TestApp::build_with(rm.db.clone(), Some(kc.url())).await;

    let removal = hierarchy_delete::delete_federation(&app.state, "org-1")
        .await
        .unwrap();

    assert_eq!(removal.submissions, 3);
    assert_eq!(
        kc.deletes(),
        vec![
            "DELETE user fed-user",
            "DELETE user apex-user",
            "DELETE user coop-user-1",
            "DELETE user coop-user-2",
            "DELETE group coop-1",
            "DELETE group coop-2",
            "DELETE group apex-1",
            "DELETE org org-1",
        ]
    );
}

#[tokio::test]
async fn nothing_is_removed_from_keycloak_when_the_database_cannot_be_cleaned() {
    let t = tree();
    let rm = federation_reads(&t)
        .fail_exec(DbErr::Exec(RuntimeErr::Internal(
            "foreign key violation".into(),
        )))
        .build();
    let kc = FakeKeycloak::start(federation_tree()).await;
    let app = TestApp::build_with(rm.db.clone(), Some(kc.url())).await;

    let result = hierarchy_delete::delete_federation(&app.state, "org-1").await;

    assert!(result.is_err(), "the caller is told the delete failed");
    assert!(
        kc.deletes().is_empty(),
        "logins and groups are untouched: {:?}",
        kc.deletes()
    );
}

#[tokio::test]
async fn a_keycloak_failure_after_the_database_is_clean_says_to_run_it_again() {
    let t = tree();
    let rm = federation_reads(&t)
        .exec(3)
        .exec(1)
        .exec(1)
        .exec(1)
        .exec(1)
        .build();
    let mut fake = federation_tree();
    fake.failing.insert("coop-2".into());
    let kc = FakeKeycloak::start(fake).await;
    let app = TestApp::build_with(rm.db.clone(), Some(kc.url())).await;

    let err = hierarchy_delete::delete_federation(&app.state, "org-1")
        .await
        .expect_err("a group could not be removed");

    assert!(
        err.to_string()
            .to_lowercase()
            .contains("run the delete again"),
        "{err}"
    );
    assert!(
        rm.sql()
            .iter()
            .any(|s| s.contains("delete from \"federations\"")),
        "the database was already cleaned"
    );
    assert!(
        kc.deletes().contains(&"DELETE org org-1".to_string()),
        "the rest of Keycloak is still removed after one item fails"
    );
}

#[tokio::test]
async fn an_item_keycloak_no_longer_has_counts_as_removed() {
    let t = tree();
    let rm = RecordingMock::postgres()
        .query_rows(vec![id_row(t.coops[0])])
        .query_empty() // no submissions
        .exec(0)
        .exec(1)
        .build();
    let mut fake = federation_tree();
    fake.gone.insert("coop-1".into());
    fake.gone.insert("coop-user-1".into());
    let kc = FakeKeycloak::start(fake).await;
    let app = TestApp::build_with(rm.db.clone(), Some(kc.url())).await;

    let result = hierarchy_delete::delete_cooperative(&app.state, "coop-1").await;

    assert!(result.is_ok(), "{result:?}");
}

// ── Finishing a delete that was only half done ───────────────────────────────

/// Keycloak lost the federation, its apexes and its cooperatives (an earlier
/// delete removed them), but the database still holds them.
fn federation_gone_from_keycloak() -> Fake {
    let mut fake = Fake::default();
    fake.missing.insert("org-1".into());
    fake.gone.insert("org-1".into());
    fake
}

#[tokio::test]
async fn a_federation_keycloak_already_lost_can_still_be_planned() {
    let kc = FakeKeycloak::start(federation_gone_from_keycloak()).await;
    let app =
        TestApp::with_db_and_keycloak_url(sea_orm::DatabaseConnection::default(), kc.url()).await;

    let plan = hierarchy_delete::plan_federation(&app.state.keycloak, "org-1")
        .await
        .expect("a missing organization is not an error");

    assert!(plan.user_ids.is_empty());
    assert!(plan.group_ids.is_empty());
    assert_eq!(plan.organization_id.as_deref(), Some("org-1"));
}

#[tokio::test]
async fn a_half_deleted_federation_is_finished_from_the_database_side() {
    let t = tree();
    let rm = federation_reads(&t)
        .exec(0) // users: Keycloak knew none
        .exec(1)
        .exec(1)
        .exec(1)
        .exec(1)
        .build();
    let kc = FakeKeycloak::start(federation_gone_from_keycloak()).await;
    let app = TestApp::build_with(rm.db.clone(), Some(kc.url())).await;

    let removal = hierarchy_delete::delete_federation(&app.state, "org-1")
        .await
        .expect("the leftovers are removed");

    assert_eq!(removal.cooperatives, 2);
    assert_eq!(removal.submissions, 3);
    assert!(
        rm.sql()
            .iter()
            .any(|s| s.contains("delete from \"federations\"")),
        "the federation row that Keycloak had lost is deleted"
    );
}

#[tokio::test]
async fn a_user_that_cannot_be_removed_keeps_its_group_so_a_repeat_can_find_it() {
    let t = tree();
    let rm = federation_reads(&t)
        .exec(3)
        .exec(1)
        .exec(1)
        .exec(1)
        .exec(1)
        .build();
    let mut fake = federation_tree();
    fake.failing.insert("coop-user-1".into());
    let kc = FakeKeycloak::start(fake).await;
    let app = TestApp::build_with(rm.db.clone(), Some(kc.url())).await;

    let err = hierarchy_delete::delete_federation(&app.state, "org-1")
        .await
        .expect_err("a user could not be removed");

    assert!(
        err.to_string()
            .to_lowercase()
            .contains("run the delete again"),
        "{err}"
    );
    let deletes = kc.deletes();
    assert!(
        deletes.contains(&"DELETE user coop-user-1".to_string()),
        "the user was attempted: {deletes:?}"
    );
    assert!(
        !deletes
            .iter()
            .any(|d| d.starts_with("DELETE group") || d.starts_with("DELETE org")),
        "no group or organization is removed while a user is left: {deletes:?}"
    );
}
