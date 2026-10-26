//! Deleting a federation, an apex or a cooperative together with everything
//! below and attached to it.
//!
//! The order matters, and it is the same for all three levels:
//!
//! 1. read what Keycloak holds below the target (nothing is changed yet);
//! 2. delete the database rows in one transaction: the report records, the
//!    users and the target itself, whose foreign keys cascade to the apexes,
//!    cooperatives, submissions and everything filed under them;
//! 3. remove the stored files and report PDFs of the deleted submissions;
//! 4. remove the users, groups and organization from Keycloak.
//!
//! If step 1 or 2 fails nothing was changed. If step 4 fails the database is
//! already clean and the call reports which Keycloak items remain, so running
//! the delete again finishes the job.

use std::collections::HashSet;

use sea_orm::{
    ColumnTrait, Condition, ConnectionTrait, EntityTrait, PaginatorTrait, QueryFilter, QuerySelect,
    TransactionTrait,
};
use uuid::Uuid;

use crate::database::Database;
use crate::entities::{
    apex, cooperative, federation, report_export, submission, uploaded_file, user,
};
use crate::error::{AppError, AppResult};
use crate::models::keycloak::KeycloakGroup;
use crate::services::KeycloakService;
use crate::AppState;

const ID_CHUNK: usize = 1_000;

/// What has to be removed from Keycloak, in the order it is removed.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct KeycloakPlan {
    pub user_ids: Vec<String>,
    /// Children before the groups that contain them.
    pub group_ids: Vec<String>,
    pub organization_id: Option<String>,
}

impl KeycloakPlan {
    fn add_users(&mut self, ids: impl IntoIterator<Item = String>) {
        for id in ids {
            if !self.user_ids.contains(&id) {
                self.user_ids.push(id);
            }
        }
    }
}

/// The level a delete starts from, by its Keycloak id.
#[derive(Debug, Clone, Copy)]
pub enum Root<'a> {
    Federation(&'a str),
    Apex(&'a str),
    Cooperative(&'a str),
}

/// The database rows below (and including) the target.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Targets {
    pub federation_ids: Vec<Uuid>,
    pub apex_ids: Vec<Uuid>,
    pub cooperative_ids: Vec<Uuid>,
}

/// What a finished delete removed.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Removal {
    pub cooperatives: usize,
    pub submissions: usize,
    pub stored_files: usize,
}

/// An item Keycloak no longer has counts as removed.
fn already_gone(e: &AppError) -> bool {
    let text = e.to_string().to_lowercase();
    text.contains("could not find") || text.contains("not found") || text.contains("404")
}

/// What a Keycloak read returned, with "no longer there" turned into "nothing
/// left to remove": a delete that was only half done can then be finished.
/// Any other failure stops the delete before it changes anything.
fn read_or_empty<T: Default>(result: AppResult<T>, what: &str) -> AppResult<T> {
    match result {
        Ok(value) => Ok(value),
        Err(e) if already_gone(&e) => Ok(T::default()),
        Err(e) => {
            tracing::error!(error = %e, "Keycloak read failed before delete: {what}");
            Err(AppError::ExternalServiceError(format!(
                "Could not read {what} from Keycloak; nothing was deleted. Please try again."
            )))
        }
    }
}

async fn member_ids(kc: &KeycloakService, group_id: &str) -> AppResult<Vec<String>> {
    let members = read_or_empty(kc.get_group_members(group_id).await, "the group members")?;
    Ok(members.into_iter().map(|m| m.id).collect())
}

async fn add_apex(
    plan: &mut KeycloakPlan,
    kc: &KeycloakService,
    apex_group_id: &str,
) -> AppResult<()> {
    plan.add_users(member_ids(kc, apex_group_id).await?);
    let children = read_or_empty(
        kc.get_group_children(apex_group_id).await,
        "the cooperative groups",
    )?;
    for child in &children {
        plan.add_users(member_ids(kc, &child.id).await?);
        plan.group_ids.push(child.id.clone());
    }
    plan.group_ids.push(apex_group_id.to_string());
    Ok(())
}

pub async fn plan_cooperative(kc: &KeycloakService, group_id: &str) -> AppResult<KeycloakPlan> {
    let mut plan = KeycloakPlan::default();
    plan.add_users(member_ids(kc, group_id).await?);
    plan.group_ids.push(group_id.to_string());
    Ok(plan)
}

pub async fn plan_apex(kc: &KeycloakService, group_id: &str) -> AppResult<KeycloakPlan> {
    let mut plan = KeycloakPlan::default();
    add_apex(&mut plan, kc, group_id).await?;
    Ok(plan)
}

fn belongs_to_organization(group: &KeycloakGroup, org_id: &str) -> bool {
    group
        .attributes
        .as_ref()
        .and_then(|a| a.get("organization_id"))
        .and_then(|v| v.first())
        .is_some_and(|v| v == org_id)
}

pub async fn plan_federation(kc: &KeycloakService, org_id: &str) -> AppResult<KeycloakPlan> {
    let mut plan = KeycloakPlan::default();
    let members = read_or_empty(
        kc.get_organization_members(org_id).await,
        "the federation members",
    )?;
    plan.add_users(members.into_iter().map(|m| m.id));

    let groups = read_or_empty(kc.get_groups(None).await, "the apex groups")?;
    for apex_group in groups.iter().filter(|g| belongs_to_organization(g, org_id)) {
        add_apex(&mut plan, kc, &apex_group.id).await?;
    }
    plan.organization_id = Some(org_id.to_string());
    Ok(plan)
}

async fn resolve_targets<C: ConnectionTrait>(c: &C, root: Root<'_>) -> AppResult<Targets> {
    let mut targets = Targets::default();
    match root {
        Root::Federation(org_id) => {
            let Some(fed) = federation::Entity::find()
                .filter(federation::Column::KeycloakId.eq(org_id))
                .one(c)
                .await?
            else {
                return Ok(targets);
            };
            targets.federation_ids.push(fed.id);
            targets.apex_ids = apex::Entity::find()
                .select_only()
                .column(apex::Column::Id)
                .filter(apex::Column::FederationId.eq(fed.id))
                .into_tuple::<Uuid>()
                .all(c)
                .await?;
        }
        Root::Apex(group_id) => {
            let Some(found) = apex::Entity::find()
                .filter(apex::Column::KeycloakId.eq(group_id))
                .one(c)
                .await?
            else {
                return Ok(targets);
            };
            targets.apex_ids.push(found.id);
        }
        Root::Cooperative(group_id) => {
            targets.cooperative_ids = cooperative::Entity::find()
                .select_only()
                .column(cooperative::Column::Id)
                .filter(cooperative::Column::KeycloakId.eq(group_id))
                .into_tuple::<Uuid>()
                .all(c)
                .await?;
            return Ok(targets);
        }
    }
    for chunk in targets.apex_ids.clone().chunks(ID_CHUNK) {
        let ids = cooperative::Entity::find()
            .select_only()
            .column(cooperative::Column::Id)
            .filter(cooperative::Column::ApexId.is_in(chunk.to_vec()))
            .into_tuple::<Uuid>()
            .all(c)
            .await?;
        targets.cooperative_ids.extend(ids);
    }
    Ok(targets)
}

/// How many submissions deleting the target removes, found the same way the
/// delete finds them. The preview shows it before anything is deleted.
pub async fn count_submissions(db: &Database, root: Root<'_>) -> AppResult<u64> {
    let targets = resolve_targets(db, root).await?;
    let mut total = 0u64;
    for chunk in targets.cooperative_ids.chunks(ID_CHUNK) {
        total += submission::Entity::find()
            .filter(submission::Column::CooperativeId.is_in(chunk.to_vec()))
            .count(db)
            .await?;
    }
    Ok(total)
}

/// `report_key` values and patterns of the reports built from the targets.
fn report_conditions(
    submission_ids: &[Uuid],
    apex_ids: &[Uuid],
    federation_ids: &[Uuid],
) -> Vec<Condition> {
    let mut conditions: Vec<Condition> = submission_ids
        .chunks(ID_CHUNK)
        .map(|chunk| {
            let keys: Vec<String> = chunk.iter().map(|id| format!("submission:{id}")).collect();
            Condition::all().add(report_export::Column::ReportKey.is_in(keys))
        })
        .collect();
    let patterns = apex_ids
        .iter()
        .map(|id| format!("apex:{id}:%"))
        .chain(federation_ids.iter().map(|id| format!("federation:{id}:%")));
    for pattern in patterns {
        conditions.push(Condition::all().add(report_export::Column::ReportKey.like(pattern)));
    }
    conditions
}

/// Deletes the database rows of the target and everything below it in one
/// transaction. Returns what was removed and the keys of the stored files that
/// belonged to it. Rolls back (changing nothing) on any error.
pub async fn delete_rows(
    db: &Database,
    root: Root<'_>,
    keycloak_user_ids: &[String],
) -> AppResult<(Removal, Vec<String>)> {
    let txn = db.begin().await?;
    let targets = resolve_targets(&txn, root).await?;

    let mut submission_ids: Vec<Uuid> = Vec::new();
    for chunk in targets.cooperative_ids.chunks(ID_CHUNK) {
        submission_ids.extend(
            submission::Entity::find()
                .select_only()
                .column(submission::Column::Id)
                .filter(submission::Column::CooperativeId.is_in(chunk.to_vec()))
                .into_tuple::<Uuid>()
                .all(&txn)
                .await?,
        );
    }

    let mut storage_keys: HashSet<String> = HashSet::new();
    for chunk in submission_ids.chunks(ID_CHUNK) {
        let keys = uploaded_file::Entity::find()
            .select_only()
            .column(uploaded_file::Column::StorageKey)
            .filter(uploaded_file::Column::SubmissionId.is_in(chunk.to_vec()))
            .into_tuple::<String>()
            .all(&txn)
            .await?;
        storage_keys.extend(keys);
    }
    for condition in report_conditions(&submission_ids, &targets.apex_ids, &targets.federation_ids)
    {
        let keys = report_export::Entity::find()
            .select_only()
            .column(report_export::Column::StorageKey)
            .filter(
                condition
                    .clone()
                    .add(report_export::Column::StorageKey.is_not_null()),
            )
            .into_tuple::<String>()
            .all(&txn)
            .await?;
        storage_keys.extend(keys);
        report_export::Entity::delete_many()
            .filter(condition)
            .exec(&txn)
            .await?;
    }

    let users = Condition::any()
        .add(user::Column::KeycloakId.is_in(keycloak_user_ids.to_vec()))
        .add(user::Column::CooperativeId.is_in(targets.cooperative_ids.clone()))
        .add(user::Column::ApexId.is_in(targets.apex_ids.clone()))
        .add(user::Column::FederationId.is_in(targets.federation_ids.clone()));
    user::Entity::delete_many().filter(users).exec(&txn).await?;

    for id in &targets.federation_ids {
        federation::Entity::delete_by_id(*id).exec(&txn).await?;
    }
    for id in &targets.apex_ids {
        apex::Entity::delete_by_id(*id).exec(&txn).await?;
    }
    for id in &targets.cooperative_ids {
        cooperative::Entity::delete_by_id(*id).exec(&txn).await?;
    }
    txn.commit().await?;

    let removal = Removal {
        cooperatives: targets.cooperative_ids.len(),
        submissions: submission_ids.len(),
        stored_files: storage_keys.len(),
    };
    Ok((removal, storage_keys.into_iter().collect()))
}

/// Removes the stored files, best effort: a file that cannot be removed is
/// logged and left for an operator, and does not undo the delete.
async fn remove_stored_files(state: &AppState, keys: &[String]) {
    for key in keys {
        if let Err(e) = state.storage.delete(key).await {
            tracing::warn!(storage_key = %key, error = %e, "Failed to remove stored file of a deleted item");
        }
    }
}

/// Removes the planned users, groups and organization from Keycloak. Returns
/// a description of each item that could not be removed.
///
/// If any user cannot be removed the groups and the organization are kept: a
/// repeated delete finds the remaining users through their groups, so a group
/// removed first would leave those accounts unreachable.
pub async fn apply_keycloak_plan(kc: &KeycloakService, plan: &KeycloakPlan) -> Vec<String> {
    let mut failures = Vec::new();
    for id in &plan.user_ids {
        if let Err(e) = kc.delete_user(id).await {
            if !already_gone(&e) {
                failures.push(format!("user {id}: {e}"));
            }
        }
    }
    if !failures.is_empty() {
        return failures;
    }
    for id in &plan.group_ids {
        if let Err(e) = kc.delete_group(id).await {
            if !already_gone(&e) {
                failures.push(format!("group {id}: {e}"));
            }
        }
    }
    if let Some(id) = &plan.organization_id {
        if let Err(e) = kc.delete_organization(id).await {
            if !already_gone(&e) {
                failures.push(format!("organization {id}: {e}"));
            }
        }
    }
    failures
}

async fn run(state: &AppState, root: Root<'_>, plan: KeycloakPlan) -> AppResult<Removal> {
    let (removal, storage_keys) = delete_rows(&state.db, root, &plan.user_ids).await?;
    remove_stored_files(state, &storage_keys).await;

    let failures = apply_keycloak_plan(&state.keycloak, &plan).await;
    if !failures.is_empty() {
        tracing::error!(?failures, "Database cleaned but Keycloak items remain");
        return Err(AppError::ExternalServiceError(format!(
            "Deleted from the database, but {} Keycloak item(s) could not be removed. Run the delete again to finish.",
            failures.len()
        )));
    }
    Ok(removal)
}

pub async fn delete_cooperative(state: &AppState, group_id: &str) -> AppResult<Removal> {
    let plan = plan_cooperative(&state.keycloak, group_id).await?;
    run(state, Root::Cooperative(group_id), plan).await
}

pub async fn delete_apex(state: &AppState, group_id: &str) -> AppResult<Removal> {
    let plan = plan_apex(&state.keycloak, group_id).await?;
    run(state, Root::Apex(group_id), plan).await
}

pub async fn delete_federation(state: &AppState, org_id: &str) -> AppResult<Removal> {
    let plan = plan_federation(&state.keycloak, org_id).await?;
    run(state, Root::Federation(org_id), plan).await
}
