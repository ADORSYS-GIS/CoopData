use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
use uuid::Uuid;

use crate::database::Database;
use crate::error::{AppError, AppResult};
use crate::repositories::db_query;

/// Where the AI narratives of one report are stored.
///
/// The stored value is `{ "en": {...}, "fr": {...}, ... }`: English is always
/// present once generated, other languages only once translated. Older rows may
/// hold a flat English-only object, or list failed languages in `untranslated`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NarrativeSlot {
    /// `submissions.metadata.ai_narratives`
    Submission(Uuid),
    /// `apexes.metadata.ai_narratives_{year}`
    Apex { id: Uuid, year: i32 },
    /// `federations.metadata.ai_narratives_{year}`
    Federation { id: Uuid, year: i32 },
    /// `ministry_report_narratives.narratives_json` of `year`
    Ministry(i32),
}

impl NarrativeSlot {
    /// Table and metadata key of the slots stored inside a `metadata` column.
    fn metadata_location(&self) -> Option<(&'static str, Uuid, String)> {
        match *self {
            Self::Submission(id) => Some(("submissions", id, "ai_narratives".into())),
            Self::Apex { id, year } => Some(("apexes", id, format!("ai_narratives_{year}"))),
            Self::Federation { id, year } => {
                Some(("federations", id, format!("ai_narratives_{year}")))
            }
            Self::Ministry(_) => None,
        }
    }
}

/// Merges one translated language into a stored narrative value `{v}`, upgrading a
/// legacy flat English object to `{ "en": ... }` and dropping the language from a
/// legacy `untranslated` list. `{lang}` and `{value}` are the bound parameters.
fn merge_locale_sql(v: &str, lang: &str, value: &str) -> String {
    format!(
        "(CASE WHEN {v} ? 'en' THEN {v} ELSE jsonb_build_object('en', {v}) END) \
         || jsonb_build_object({lang}, {value}) \
         || (CASE WHEN {v} ? 'untranslated' \
                  THEN jsonb_build_object('untranslated', ({v} -> 'untranslated') - {lang}) \
                  ELSE '{{}}'::jsonb END)"
    )
}

/// Reads and writes report narratives. Every write is a single SQL statement so
/// that two languages translated at the same time never overwrite each other.
#[derive(Clone)]
pub struct ReportNarrativeStore {
    db: Database,
}

impl ReportNarrativeStore {
    pub fn new(db: impl Into<Database>) -> Self {
        Self { db: db.into() }
    }

    pub async fn load(&self, slot: NarrativeSlot) -> AppResult<Option<serde_json::Value>> {
        db_query("report_narratives", "load", async {
            let stmt = match (slot, slot.metadata_location()) {
                (_, Some((table, id, key))) => Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    format!("SELECT metadata -> $2::text FROM {table} WHERE id = $1"),
                    vec![id.into(), key.into()],
                ),
                (NarrativeSlot::Ministry(year), None) => Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    "SELECT narratives_json FROM ministry_report_narratives WHERE reporting_year = $1",
                    vec![year.into()],
                ),
                _ => return Ok(None),
            };
            let row = self.db.query_one(stmt).await.map_err(AppError::from)?;
            let value = row
                .map(|r| r.try_get_by_index::<Option<serde_json::Value>>(0))
                .transpose()
                .map_err(AppError::from)?
                .flatten();
            Ok(value.filter(|v| v.as_object().is_some_and(|o| !o.is_empty())))
        })
        .await
    }

    /// Replaces the narratives with freshly generated English ones, dropping
    /// every translation of the previous English text.
    pub async fn store_english(
        &self,
        slot: NarrativeSlot,
        english: serde_json::Value,
    ) -> AppResult<()> {
        db_query("report_narratives", "store_english", async {
            let stmt = match (slot, slot.metadata_location()) {
                (_, Some((table, id, key))) => Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    format!(
                        "UPDATE {table} SET metadata = jsonb_set(COALESCE(metadata, '{{}}'::jsonb), \
                         ARRAY[$2::text], jsonb_build_object('en', $3::jsonb)) WHERE id = $1"
                    ),
                    vec![id.into(), key.into(), english.into()],
                ),
                (NarrativeSlot::Ministry(year), None) => Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    "INSERT INTO ministry_report_narratives (reporting_year, narratives_json, created_at, updated_at) \
                     VALUES ($1, jsonb_build_object('en', $2::jsonb), now(), now()) \
                     ON CONFLICT (reporting_year) DO UPDATE \
                       SET narratives_json = EXCLUDED.narratives_json, updated_at = now()",
                    vec![year.into(), english.into()],
                ),
                _ => return Ok(()),
            };
            self.db.execute(stmt).await.map_err(AppError::from)?;
            Ok(())
        })
        .await
    }

    /// Adds one translated language next to the stored English narratives.
    pub async fn store_locale(
        &self,
        slot: NarrativeSlot,
        lang: &str,
        translated: serde_json::Value,
    ) -> AppResult<()> {
        db_query("report_narratives", "store_locale", async {
            let stmt = match (slot, slot.metadata_location()) {
                (_, Some((table, id, key))) => Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    format!(
                        "UPDATE {table} SET metadata = jsonb_set(metadata, ARRAY[$2::text], {}) \
                         WHERE id = $1 AND jsonb_typeof(metadata -> $2::text) = 'object'",
                        merge_locale_sql("(metadata -> $2::text)", "$3::text", "$4::jsonb")
                    ),
                    vec![id.into(), key.into(), lang.into(), translated.into()],
                ),
                (NarrativeSlot::Ministry(year), None) => Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    format!(
                        "UPDATE ministry_report_narratives SET narratives_json = {}, updated_at = now() \
                         WHERE reporting_year = $1",
                        merge_locale_sql("narratives_json", "$2::text", "$3::jsonb")
                    ),
                    vec![year.into(), lang.into(), translated.into()],
                ),
                _ => return Ok(()),
            };
            let result = self.db.execute(stmt).await.map_err(AppError::from)?;
            if result.rows_affected() == 0 {
                return Err(AppError::NotFound(
                    "No English narratives to attach the translation to".into(),
                ));
            }
            Ok(())
        })
        .await
    }

    /// Removes the narratives so the next report generates them afresh.
    pub async fn clear(&self, slot: NarrativeSlot) -> AppResult<()> {
        db_query("report_narratives", "clear", async {
            let stmt = match (slot, slot.metadata_location()) {
                (_, Some((table, id, key))) => Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    format!("UPDATE {table} SET metadata = metadata - $2::text WHERE id = $1"),
                    vec![id.into(), key.into()],
                ),
                (NarrativeSlot::Ministry(year), None) => Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    "DELETE FROM ministry_report_narratives WHERE reporting_year = $1",
                    vec![year.into()],
                ),
                _ => return Ok(()),
            };
            self.db.execute(stmt).await.map_err(AppError::from)?;
            Ok(())
        })
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn metadata_slots_use_the_year_key() {
        let id = Uuid::nil();

        assert_eq!(
            NarrativeSlot::Apex { id, year: 2025 }.metadata_location(),
            Some(("apexes", id, "ai_narratives_2025".to_string()))
        );
        assert_eq!(
            NarrativeSlot::Submission(id).metadata_location(),
            Some(("submissions", id, "ai_narratives".to_string()))
        );
        assert_eq!(NarrativeSlot::Ministry(2025).metadata_location(), None);
    }
}
