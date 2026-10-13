//! On-demand report PDFs.
//!
//! A report is prepared in the background, one job per report and language, and
//! its progress is recorded in `report_exports` so every user sees the same state
//! (preparing, ready, failed). Approval prepares only the English cooperative
//! report and forgets the consolidated reports it changes; every other language,
//! and every consolidated report, is prepared when a user asks for it.
//!
//! Failure details are logged and kept in `report_exports.error` for operators;
//! users only ever see that a report failed and can be retried.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::entities::report_export::{self, STATUS_PREPARING, STATUS_READY};
use crate::entities::submission;
use crate::error::{AppError, AppResult};
use crate::repositories::NarrativeSlot;
use crate::services::export_generator::{ExportGenerator, EXPORT_LOCALES, EXPORT_PREFIX};
use crate::services::narrative_translation;
use crate::AppState;

const ENGLISH: &str = "en";
const QUESTIONNAIRE_LOCALES: [&str; 1] = [ENGLISH];

/// One report that can be exported as PDF.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReportTarget {
    Submission {
        id: Uuid,
        questionnaire: bool,
    },
    Apex {
        id: Uuid,
        year: i32,
        questionnaire: bool,
    },
    Federation {
        id: Uuid,
        year: i32,
        questionnaire: bool,
    },
    Ministry {
        year: i32,
        questionnaire: bool,
    },
}

impl ReportTarget {
    fn questionnaire(&self) -> bool {
        match *self {
            Self::Submission { questionnaire, .. }
            | Self::Apex { questionnaire, .. }
            | Self::Federation { questionnaire, .. }
            | Self::Ministry { questionnaire, .. } => questionnaire,
        }
    }

    fn is_consolidated(&self) -> bool {
        !matches!(self, Self::Submission { .. })
    }

    fn variant(&self) -> &'static str {
        if self.questionnaire() {
            "questionnaire"
        } else {
            "statement"
        }
    }

    fn tag(&self) -> &'static str {
        if self.questionnaire() {
            "_questionnaire"
        } else {
            ""
        }
    }

    /// Identifies the report in `report_exports`.
    pub fn key(&self) -> String {
        match *self {
            Self::Submission { id, .. } => format!("submission:{id}"),
            Self::Apex { id, year, .. } => format!("apex:{id}:{year}:{}", self.variant()),
            Self::Federation { id, year, .. } => {
                format!("federation:{id}:{year}:{}", self.variant())
            }
            Self::Ministry { year, .. } => format!("ministry:{year}:{}", self.variant()),
        }
    }

    /// Storage key of the PDF of one language.
    pub fn pdf_key(&self, lang: &str) -> String {
        let tag = self.tag();
        match *self {
            Self::Submission { id, .. } => ExportGenerator::submission_pdf_key(id, lang),
            Self::Apex { id, year, .. } => ExportGenerator::apex_pdf_key(id, year, tag, lang),
            Self::Federation { id, year, .. } => {
                ExportGenerator::federation_pdf_key(id, year, tag, lang)
            }
            Self::Ministry { year, .. } => ExportGenerator::ministry_pdf_key(year, tag, lang),
        }
    }

    /// Storage key of the English PDF exported before reports were multilingual.
    fn legacy_pdf_key(&self) -> String {
        let tag = self.tag();
        match *self {
            Self::Submission { id, .. } => {
                format!("{EXPORT_PREFIX}/individual/{id}/submission_{id}.pdf")
            }
            Self::Apex { id, year, .. } => {
                format!("{EXPORT_PREFIX}/apex/{id}/apex_{id}_{year}{tag}.pdf")
            }
            Self::Federation { id, year, .. } => {
                format!("{EXPORT_PREFIX}/federation/{id}/federation_{id}_{year}{tag}.pdf")
            }
            Self::Ministry { year, .. } => {
                format!("{EXPORT_PREFIX}/ministry/ministry_{year}{tag}.pdf")
            }
        }
    }

    /// Download file name of one language.
    pub fn filename(&self, lang: &str) -> String {
        self.pdf_key(lang)
            .rsplit('/')
            .next()
            .unwrap_or("report.pdf")
            .to_string()
    }

    /// Languages this report can be produced in. Questionnaire reports are English-only.
    pub fn languages(&self) -> &'static [&'static str] {
        if self.questionnaire() {
            &QUESTIONNAIRE_LOCALES
        } else {
            &EXPORT_LOCALES
        }
    }

    /// Where the translatable AI narratives live. Questionnaire reports have none
    /// (a questionnaire submission keeps its English-only narratives separately).
    fn narrative_slot(&self) -> Option<NarrativeSlot> {
        if self.questionnaire() {
            return None;
        }
        Some(match *self {
            Self::Submission { id, .. } => NarrativeSlot::Submission(id),
            Self::Apex { id, year, .. } => NarrativeSlot::Apex { id, year },
            Self::Federation { id, year, .. } => NarrativeSlot::Federation { id, year },
            Self::Ministry { year, .. } => NarrativeSlot::Ministry(year),
        })
    }
}

/// Status of one language of a report as shown to users.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ReportState {
    Preparing,
    Ready,
    Failed,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LanguageStatus {
    pub lang: String,
    pub state: ReportState,
    pub updated_at: DateTime<Utc>,
    storage_key: Option<String>,
}

/// The state users see: a job still "preparing" after the timeout was lost (the
/// process stopped while it ran) and is shown as failed, so it can be retried.
fn effective_state(
    status: &str,
    started_at: DateTime<Utc>,
    now: DateTime<Utc>,
    timeout_secs: u64,
) -> ReportState {
    match status {
        STATUS_READY => ReportState::Ready,
        STATUS_PREPARING
            if now.signed_duration_since(started_at).num_seconds() < timeout_secs as i64 =>
        {
            ReportState::Preparing
        }
        _ => ReportState::Failed,
    }
}

fn to_status(row: report_export::Model, timeout_secs: u64) -> LanguageStatus {
    LanguageStatus {
        state: effective_state(&row.status, row.started_at, Utc::now(), timeout_secs),
        lang: row.lang,
        updated_at: row.updated_at,
        storage_key: row.storage_key,
    }
}

/// Status of every language of a report that was ever prepared. Reports exported
/// before status tracking existed are recognised from their stored PDFs.
pub async fn statuses(state: &AppState, target: ReportTarget) -> AppResult<Vec<LanguageStatus>> {
    let key = target.key();
    let mut rows = state.report_export_repo.list(&key).await?;
    if rows.is_empty() && adopt_existing_pdfs(state, target).await {
        rows = state.report_export_repo.list(&key).await?;
    }
    let timeout = state.config.report_job_timeout_secs;
    let mut statuses: Vec<LanguageStatus> =
        rows.into_iter().map(|r| to_status(r, timeout)).collect();
    statuses.sort_by_key(|s| target.languages().iter().position(|l| *l == s.lang));
    Ok(statuses)
}

/// Records PDFs already in storage as ready. Returns whether any was found.
async fn adopt_existing_pdfs(state: &AppState, target: ReportTarget) -> bool {
    let key = target.key();
    let mut found = false;
    for lang in target.languages() {
        let mut candidates = vec![target.pdf_key(lang)];
        if *lang == ENGLISH {
            candidates.push(target.legacy_pdf_key());
        }
        for storage_key in candidates {
            if state.storage.get_object(&storage_key).await.is_ok() {
                match state
                    .report_export_repo
                    .insert_ready(&key, lang, &storage_key)
                    .await
                {
                    Ok(()) => found = true,
                    Err(e) => {
                        tracing::warn!(report = %key, lang, error = %e, "[report] Could not record existing PDF")
                    }
                }
                break;
            }
        }
    }
    found
}

/// The PDF of a ready language, or `None` while it is not ready.
pub async fn ready_pdf(
    state: &AppState,
    target: ReportTarget,
    lang: &str,
) -> AppResult<Option<Vec<u8>>> {
    let ready = statuses(state, target)
        .await?
        .into_iter()
        .find(|s| s.lang == lang && s.state == ReportState::Ready);
    let Some(storage_key) = ready.and_then(|s| s.storage_key) else {
        return Ok(None);
    };
    match state.storage.get_object(&storage_key).await {
        Ok(bytes) => Ok(Some(bytes)),
        Err(e) => {
            // The file is gone (e.g. storage cleaned up): forget it so it can be prepared again.
            tracing::warn!(report = %target.key(), lang, error = %e, "[report] Ready PDF missing from storage");
            state
                .report_export_repo
                .delete_language(&target.key(), lang)
                .await?;
            Ok(None)
        }
    }
}

/// Starts preparing one language of a report on a user's request and returns the
/// report's statuses. English is (re)generated from the report data; another
/// language is translated from the English report, which must be ready first.
pub async fn prepare(
    state: &AppState,
    target: ReportTarget,
    lang: &str,
    regenerate: bool,
) -> AppResult<Vec<LanguageStatus>> {
    if !target.languages().contains(&lang) {
        return Err(AppError::BadRequest(
            "This report is not available in the requested language".into(),
        ));
    }
    if lang != ENGLISH {
        let english_ready = statuses(state, target)
            .await?
            .iter()
            .any(|s| s.lang == ENGLISH && s.state == ReportState::Ready);
        if !english_ready {
            return Err(AppError::Conflict(
                "The English report must be ready before other languages".into(),
            ));
        }
    }
    start(state, target, lang, regenerate && lang == ENGLISH).await?;
    statuses(state, target).await
}

/// Claims and spawns the job of one language. Returns `false` when a job for it
/// is already running.
pub async fn start(
    state: &AppState,
    target: ReportTarget,
    lang: &str,
    regenerate: bool,
) -> AppResult<bool> {
    let key = target.key();
    let Some(job_id) = state
        .report_export_repo
        .claim(&key, lang, state.config.report_job_timeout_secs)
        .await?
    else {
        tracing::info!(report = %key, lang, "[report] Already being prepared");
        return Ok(false);
    };

    let state = state.clone();
    let lang = lang.to_string();
    tokio::spawn(async move {
        let started = std::time::Instant::now();
        tracing::info!(report = %key, lang = %lang, regenerate, "[report] 🚀 Preparing");
        match build(&state, target, &lang, regenerate, job_id).await {
            Ok(storage_key) => match state
                .report_export_repo
                .mark_ready(job_id, &storage_key)
                .await
            {
                Ok(true) => tracing::info!(
                    report = %key,
                    lang = %lang,
                    elapsed_ms = started.elapsed().as_millis(),
                    "[report] ✅ Ready"
                ),
                Ok(false) => {
                    // The report was invalidated while this job ran: its PDF is stale.
                    // A newer job for the same language writes the same file, so the
                    // file is only removed when no newer job exists.
                    tracing::info!(report = %key, lang = %lang, "[report] Discarding PDF of an invalidated report");
                    if !state
                        .report_export_repo
                        .exists(&key, &lang)
                        .await
                        .unwrap_or(true)
                    {
                        let _ = state.storage.delete(&storage_key).await;
                    }
                }
                Err(e) => {
                    tracing::error!(report = %key, lang = %lang, error = %e, "[report] ❌ Could not record ready PDF")
                }
            },
            Err(_) if !state.report_export_repo.owns(job_id).await.unwrap_or(true) => {
                tracing::info!(report = %key, lang = %lang, "[report] Superseded by a newer preparation");
            }
            Err(e) => {
                tracing::error!(
                    report = %key,
                    lang = %lang,
                    elapsed_ms = started.elapsed().as_millis(),
                    error = %e,
                    "[report] ❌ Preparation failed"
                );
                if let Err(db) = state
                    .report_export_repo
                    .mark_failed(job_id, &e.to_string())
                    .await
                {
                    tracing::error!(report = %key, lang = %lang, error = %db, "[report] Could not record failure");
                }
            }
        }
    });
    Ok(true)
}

/// Produces and stores the PDF of one language; returns its storage key.
async fn build(
    state: &AppState,
    target: ReportTarget,
    lang: &str,
    regenerate: bool,
    job_id: Uuid,
) -> AppResult<String> {
    if lang == ENGLISH {
        // A consolidated report always reflects the latest approvals.
        let fresh = regenerate || target.is_consolidated();
        if fresh {
            forget_translations(state, target).await?;
        }
        ensure_english_narratives(state, target, fresh).await?;
    } else {
        ensure_translation(state, target, lang).await?;
    }

    let url = print_url(state, target, lang).await?;
    let bytes = ExportGenerator::generate_pdf_via_gotenberg(state, &url).await?;
    let storage_key = target.pdf_key(lang);
    // A job overtaken by a newer one (the report was invalidated meanwhile) must
    // not overwrite the newer PDF with its stale one.
    if !state.report_export_repo.owns(job_id).await? {
        return Err(AppError::Conflict(
            "Report invalidated while it was being prepared".into(),
        ));
    }
    state
        .storage
        .store(&storage_key, &bytes, "application/pdf")
        .await?;
    Ok(storage_key)
}

async fn ensure_english_narratives(
    state: &AppState,
    target: ReportTarget,
    fresh: bool,
) -> AppResult<()> {
    if let ReportTarget::Submission {
        id,
        questionnaire: true,
    } = target
    {
        ExportGenerator::ensure_questionnaire_narratives(state, id, fresh).await;
        return Ok(());
    }
    let Some(slot) = target.narrative_slot() else {
        return Ok(());
    };
    if !fresh {
        if let Some(stored) = state.narrative_store.load(slot).await? {
            if narrative_translation::english_of(&stored).is_some() {
                return Ok(());
            }
        }
    }
    let english = generate_english(state, target).await?;
    state.narrative_store.store_english(slot, english).await
}

async fn generate_english(state: &AppState, target: ReportTarget) -> AppResult<serde_json::Value> {
    let value = match target {
        ReportTarget::Submission { id, .. } => {
            serde_json::to_value(ExportGenerator::generate_cooperative_narratives(state, id).await?)
        }
        ReportTarget::Apex { id, year, .. } => {
            serde_json::to_value(ExportGenerator::generate_apex_narratives(state, id, year).await?)
        }
        ReportTarget::Federation { id, year, .. } => serde_json::to_value(
            ExportGenerator::generate_federation_narratives(state, id, year).await?,
        ),
        ReportTarget::Ministry { year, .. } => {
            serde_json::to_value(ExportGenerator::generate_ministry_narratives(state, year).await?)
        }
    };
    value.map_err(|e| AppError::InternalServerError(format!("Could not serialise narratives: {e}")))
}

async fn ensure_translation(state: &AppState, target: ReportTarget, lang: &str) -> AppResult<()> {
    let slot = target.narrative_slot().ok_or_else(|| {
        AppError::BadRequest("This report is not available in the requested language".into())
    })?;
    let stored = match state.narrative_store.load(slot).await? {
        Some(stored) if narrative_translation::english_of(&stored).is_some() => stored,
        // A report exported before narratives were stored: generate them first.
        _ => {
            ensure_english_narratives(state, target, true).await?;
            state.narrative_store.load(slot).await?.ok_or_else(|| {
                AppError::InternalServerError("English narratives were not stored".into())
            })?
        }
    };
    if narrative_translation::has_locale(&stored, lang) {
        return Ok(());
    }
    let english = narrative_translation::english_of(&stored)
        .cloned()
        .ok_or_else(|| AppError::InternalServerError("Stored narratives have no English".into()))?;

    let translated = {
        let _permit = ExportGenerator::ai_permit(state).await?;
        narrative_translation::translate_locale(state.narrative_generator.as_ref(), &english, lang)
            .await
            .map_err(|reason| {
                AppError::ExternalServiceError(format!("{lang} translation failed: {reason}"))
            })?
    };
    state
        .narrative_store
        .store_locale(slot, lang, translated)
        .await
}

async fn print_url(state: &AppState, target: ReportTarget, lang: &str) -> AppResult<String> {
    let token = state.keycloak.get_admin_token().await?;
    let base = &state.config.gotenberg_frontend_url;
    Ok(match target {
        ReportTarget::Submission { id, questionnaire } => {
            ExportGenerator::submission_print_url(state, id, questionnaire, &token, lang)
        }
        ReportTarget::Apex {
            id,
            year,
            questionnaire,
        } => {
            let apex = state
                .apex_repo
                .find_by_id(id)
                .await?
                .ok_or_else(|| AppError::NotFound("Apex not found".into()))?;
            let name = urlencoding::encode(&apex.display_name);
            if questionnaire {
                format!("{base}/print/questionnaire-consolidated?token={token}&year={year}&scope=apex&id={id}&name={name}&lng={lang}")
            } else {
                // The apex print page and its APIs address the apex by Keycloak ID.
                format!(
                    "{base}/print/apex/{}?token={token}&year={year}&name={name}&lng={lang}",
                    apex.keycloak_id
                )
            }
        }
        ReportTarget::Federation {
            id,
            year,
            questionnaire,
        } => {
            let federation = state
                .federation_repo
                .find_by_id(id)
                .await?
                .ok_or_else(|| AppError::NotFound("Federation not found".into()))?;
            let name = urlencoding::encode(&federation.display_name);
            if questionnaire {
                format!("{base}/print/questionnaire-consolidated?token={token}&year={year}&scope=federation&id={id}&name={name}&lng={lang}")
            } else {
                format!(
                    "{base}/print/federation/{}?token={token}&year={year}&name={name}&lng={lang}",
                    federation.keycloak_id
                )
            }
        }
        ReportTarget::Ministry {
            year,
            questionnaire: true,
        } => format!(
            "{base}/print/questionnaire-consolidated?token={token}&year={year}&scope=ministry&lng={lang}"
        ),
        ReportTarget::Ministry { year, .. } => {
            format!("{base}/print/ministry?token={token}&year={year}&lng={lang}")
        }
    })
}

/// Deletes the other languages of a report whose English text is being
/// regenerated: their translations no longer match it.
async fn forget_translations(state: &AppState, target: ReportTarget) -> AppResult<()> {
    for lang in target.languages().iter().filter(|l| **l != ENGLISH) {
        let _ = state.storage.delete(&target.pdf_key(lang)).await;
    }
    state
        .report_export_repo
        .delete_languages(&target.key(), Some(ENGLISH))
        .await
}

/// Deletes every PDF and the narratives of a report; it is prepared afresh the
/// next time a user asks for it.
async fn invalidate(state: &AppState, target: ReportTarget) -> AppResult<()> {
    for lang in target.languages() {
        let _ = state.storage.delete(&target.pdf_key(lang)).await;
    }
    let _ = state.storage.delete(&target.legacy_pdf_key()).await;
    state
        .report_export_repo
        .delete_languages(&target.key(), None)
        .await?;
    if let Some(slot) = target.narrative_slot() {
        state.narrative_store.clear(slot).await?;
    }
    Ok(())
}

/// Consolidated reports that include a cooperative's figures for `year`.
fn consolidated_targets(
    apex_id: Option<Uuid>,
    federation_id: Option<Uuid>,
    year: i32,
) -> Vec<ReportTarget> {
    let mut targets = Vec::new();
    for questionnaire in [false, true] {
        if let Some(id) = apex_id {
            targets.push(ReportTarget::Apex {
                id,
                year,
                questionnaire,
            });
        }
        if let Some(id) = federation_id {
            targets.push(ReportTarget::Federation {
                id,
                year,
                questionnaire,
            });
        }
        targets.push(ReportTarget::Ministry {
            year,
            questionnaire,
        });
    }
    targets
}

/// After a submission is approved: prepares its English report, and replaces the
/// consolidated reports its figures change (apex, federation, national) with fresh
/// English ones. Their other languages are dropped and prepared again on request.
/// Approved reports of later years of the same cooperative compare against this
/// one, so they are refreshed too.
pub fn on_submission_approved(state: AppState, approved: submission::Model) {
    tokio::spawn(async move {
        if let Err(e) = handle_approval(&state, &approved).await {
            tracing::error!(submission_id = %approved.id, error = %e, "[report] ❌ Post-approval report work failed");
        }
    });
}

async fn handle_approval(state: &AppState, approved: &submission::Model) -> AppResult<()> {
    let coop = state
        .cooperative_repo
        .find_by_id(approved.cooperative_id)
        .await?;
    let apex_id = coop.as_ref().map(|c| c.apex_id);
    let federation_id = match apex_id {
        Some(id) => state
            .apex_repo
            .find_by_id(id)
            .await?
            .map(|a| a.federation_id),
        None => None,
    };

    let mut refreshed = vec![approved.clone()];
    refreshed.extend(
        state
            .submission_repo
            .find_by_cooperative(approved.cooperative_id)
            .await?
            .into_iter()
            .filter(|s| {
                s.id != approved.id
                    && s.reporting_year > approved.reporting_year
                    && s.status == crate::entities::enums::SubmissionStatus::Approved
            }),
    );

    // (year, questionnaire) of every consolidated report variant to rebuild.
    let mut changed: Vec<(i32, bool)> = Vec::new();
    for sub in &refreshed {
        let questionnaire =
            crate::services::questionnaire_report::is_questionnaire_method(&sub.submission_method);
        let target = ReportTarget::Submission {
            id: sub.id,
            questionnaire,
        };
        if let Err(e) = start(state, target, ENGLISH, true).await {
            tracing::error!(submission_id = %sub.id, error = %e, "[report] ❌ Could not start report");
        }
        if !changed.contains(&(sub.reporting_year, questionnaire)) {
            changed.push((sub.reporting_year, questionnaire));
        }
    }

    for (year, questionnaire) in changed {
        for target in consolidated_targets(apex_id, federation_id, year)
            .into_iter()
            .filter(|t| t.questionnaire() == questionnaire)
        {
            if let Err(e) = invalidate(state, target).await {
                tracing::warn!(report = %target.key(), error = %e, "[report] ⚠️ Could not invalidate consolidated report");
                continue;
            }
            if let Err(e) = start(state, target, ENGLISH, true).await {
                tracing::error!(report = %target.key(), error = %e, "[report] ❌ Could not start consolidated report");
            }
        }
    }
    Ok(())
}

/// Regenerates a submission's English narratives now (manual request) and
/// rebuilds its English PDF in the background.
pub async fn regenerate_submission_narratives(
    state: &AppState,
    submission_id: Uuid,
    questionnaire: bool,
) -> AppResult<()> {
    let target = ReportTarget::Submission {
        id: submission_id,
        questionnaire,
    };
    forget_translations(state, target).await?;
    ensure_english_narratives(state, target, true).await?;
    start(state, target, ENGLISH, false).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entities::report_export::STATUS_FAILED;

    const NOW_SECS: i64 = 1_800_000_000;

    fn at(secs_ago: i64) -> DateTime<Utc> {
        DateTime::from_timestamp(NOW_SECS - secs_ago, 0).unwrap_or_default()
    }

    #[test]
    fn a_recent_job_is_preparing_and_a_stale_one_failed() {
        let now = at(0);

        assert_eq!(
            effective_state(STATUS_PREPARING, at(30), now, 600),
            ReportState::Preparing
        );
        assert_eq!(
            effective_state(STATUS_PREPARING, at(601), now, 600),
            ReportState::Failed
        );
        assert_eq!(
            effective_state(STATUS_READY, at(10_000), now, 600),
            ReportState::Ready
        );
        assert_eq!(
            effective_state(STATUS_FAILED, at(1), now, 600),
            ReportState::Failed
        );
    }

    #[test]
    fn report_keys_separate_reports_and_variants() {
        let id = Uuid::nil();

        assert_eq!(
            ReportTarget::Submission {
                id,
                questionnaire: false
            }
            .key(),
            format!("submission:{id}")
        );
        assert_eq!(
            ReportTarget::Apex {
                id,
                year: 2025,
                questionnaire: true
            }
            .key(),
            format!("apex:{id}:2025:questionnaire")
        );
        assert_eq!(
            ReportTarget::Ministry {
                year: 2025,
                questionnaire: false
            }
            .key(),
            "ministry:2025:statement"
        );
    }

    #[test]
    fn pdf_keys_carry_language_and_variant() {
        let id = Uuid::nil();
        let federation = ReportTarget::Federation {
            id,
            year: 2024,
            questionnaire: true,
        };

        assert_eq!(
            federation.pdf_key("en"),
            format!("{EXPORT_PREFIX}/federation/{id}/federation_{id}_2024_questionnaire_en.pdf")
        );
        assert_eq!(
            federation.filename("en"),
            format!("federation_{id}_2024_questionnaire_en.pdf")
        );
    }

    #[test]
    fn questionnaire_reports_are_english_only() {
        let id = Uuid::nil();
        let questionnaire = ReportTarget::Submission {
            id,
            questionnaire: true,
        };
        let statement = ReportTarget::Submission {
            id,
            questionnaire: false,
        };

        assert_eq!(questionnaire.languages(), &["en"]);
        assert_eq!(questionnaire.narrative_slot(), None);
        assert_eq!(statement.languages(), &EXPORT_LOCALES);
        assert_eq!(
            statement.narrative_slot(),
            Some(NarrativeSlot::Submission(id))
        );
    }

    #[test]
    fn an_approval_invalidates_every_consolidated_level_and_variant() {
        let apex = Uuid::from_u128(1);
        let federation = Uuid::from_u128(2);

        let targets = consolidated_targets(Some(apex), Some(federation), 2025);

        assert_eq!(targets.len(), 6);
        assert!(targets.contains(&ReportTarget::Apex {
            id: apex,
            year: 2025,
            questionnaire: false
        }));
        assert!(targets.contains(&ReportTarget::Ministry {
            year: 2025,
            questionnaire: true
        }));
    }
}
