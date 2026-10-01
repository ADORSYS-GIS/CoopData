use rust_decimal::prelude::ToPrimitive;
use sea_orm::EntityTrait;
use serde::{de::DeserializeOwned, Serialize};
use uuid::Uuid;

use crate::error::AppResult;
use crate::services::narrative_translation::{self, Multilingual, StoredNarratives};
use crate::services::report_narrative;
use crate::AppState;

pub struct ExportGenerator;

/// Storage prefix of generated PDFs. Raise the version whenever the report layout
/// changes: old cached PDFs are then ignored and every report is generated afresh.
pub const EXPORT_PREFIX: &str = "exports/v5";

/// Supported export locales — mirrors `localization::SUPPORTED_LOCALES`.
pub(crate) const EXPORT_LOCALES: [&str; 4] = ["en", "fr", "pt", "ss"];

/// Questionnaire reports are produced in English only.
pub(crate) const QUESTIONNAIRE_LOCALE: &str = "en";

impl ExportGenerator {
    /// Spawns a background task to generate exports when a submission is approved
    pub fn trigger_cooperative_export(state: AppState, submission_id: Uuid) {
        tokio::spawn(async move {
            tracing::info!(
                submission_id = %submission_id,
                "[export] 🚀 Starting cooperative export"
            );
            let start = std::time::Instant::now();

            if let Err(e) = Self::generate_all_formats(&state, submission_id).await {
                tracing::error!(
                    submission_id = %submission_id,
                    error = %e,
                    "[export] ❌ Failed to generate exports in the background"
                );
            } else {
                tracing::info!(
                    submission_id = %submission_id,
                    elapsed_ms = start.elapsed().as_millis(),
                    "[export] ✅ Export complete | total={}ms",
                    start.elapsed().as_millis()
                );
            }
        });
    }

    /// Generates fresh narratives (English analysis + translations) and one PDF per
    /// report locale. Locales whose translation failed are not cached, so their
    /// next download retries the translation instead of serving English.
    async fn generate_all_formats(state: &AppState, submission_id: Uuid) -> AppResult<()> {
        let questionnaire = Self::is_questionnaire_submission(state, submission_id).await?;
        let locales = Self::report_locales(
            questionnaire,
            Self::ensure_submission_narratives(state, submission_id, questionnaire, true)
                .await
                .as_ref(),
        );
        Self::store_submission_locales(state, submission_id, questionnaire, &locales).await;
        Ok(())
    }

    pub(crate) async fn is_questionnaire_submission(
        state: &AppState,
        submission_id: Uuid,
    ) -> AppResult<bool> {
        let submission = state
            .submission_repo
            .find_by_id(submission_id)
            .await?
            .ok_or_else(|| crate::error::AppError::NotFound("Submission not found".into()))?;
        Ok(
            crate::services::questionnaire_report::is_questionnaire_method(
                &submission.submission_method,
            ),
        )
    }

    /// Storage key of one locale of a single-submission report.
    pub fn submission_pdf_key(submission_id: Uuid, lng: &str) -> String {
        format!("{EXPORT_PREFIX}/individual/{submission_id}/submission_{submission_id}_{lng}.pdf")
    }

    fn submission_print_url(
        state: &AppState,
        submission_id: Uuid,
        questionnaire: bool,
        token: &str,
        lng: &str,
    ) -> String {
        let route = if questionnaire {
            "questionnaire"
        } else {
            "cooperative"
        };
        format!(
            "{}/print/{route}/{submission_id}?token={token}&lng={lng}",
            state.config.gotenberg_frontend_url
        )
    }

    /// Locales whose narratives are fully translated and may therefore be cached.
    pub(crate) fn cacheable_locales(untranslated: Option<&Vec<String>>) -> Vec<&'static str> {
        match untranslated {
            Some(untranslated) => EXPORT_LOCALES
                .into_iter()
                .filter(|lng| !untranslated.iter().any(|u| u == lng))
                .collect(),
            None => Vec::new(),
        }
    }

    /// Renders and caches the given locales of a submission report.
    pub(crate) async fn store_submission_locales(
        state: &AppState,
        submission_id: Uuid,
        questionnaire: bool,
        locales: &[&str],
    ) {
        if locales.is_empty() {
            return;
        }
        let token = match state.keycloak.get_admin_token().await {
            Ok(t) => t,
            Err(e) => {
                tracing::error!(submission_id = %submission_id, error = %e, "[export] ❌ Could not obtain print token");
                return;
            }
        };
        for lng in locales {
            let url = Self::submission_print_url(state, submission_id, questionnaire, &token, lng);
            match Self::generate_pdf_via_gotenberg(state, &url).await {
                Ok(bytes) => {
                    let key = Self::submission_pdf_key(submission_id, lng);
                    match state.storage.store(&key, &bytes, "application/pdf").await {
                        Ok(_) => tracing::info!(
                            submission_id = %submission_id,
                            lng = *lng,
                            size_bytes = bytes.len(),
                            "[export] ✅ Stored PDF for locale={}",
                            lng
                        ),
                        Err(e) => tracing::warn!(
                            submission_id = %submission_id,
                            lng = *lng,
                            error = %e,
                            "[export] ⚠️ Failed to store PDF for locale={}",
                            lng
                        ),
                    }
                }
                Err(e) => tracing::warn!(
                    submission_id = %submission_id,
                    lng = *lng,
                    error = %e,
                    "[export] ⚠️ Failed to render PDF for locale={}",
                    lng
                ),
            }
        }
    }

    /// Renders one locale of a submission report. Narratives are generated when
    /// missing (or when `regenerate` is set), upgraded from the legacy English-only
    /// shape, and failed translations are retried. Returns the PDF and the locales
    /// still untranslated (`None` when the report has no AI narratives).
    pub(crate) async fn generate_submission_pdf(
        state: &AppState,
        submission_id: Uuid,
        lng: &str,
        regenerate: bool,
    ) -> AppResult<(Vec<u8>, Option<Vec<String>>)> {
        let questionnaire = Self::is_questionnaire_submission(state, submission_id).await?;
        let untranslated =
            Self::ensure_submission_narratives(state, submission_id, questionnaire, regenerate)
                .await;

        let token = state.keycloak.get_admin_token().await?;
        let url = Self::submission_print_url(state, submission_id, questionnaire, &token, lng);
        let bytes = Self::generate_pdf_via_gotenberg(state, &url).await?;
        Ok((bytes, untranslated))
    }

    /// Makes sure the submission holds complete multilingual narratives and returns
    /// the locales still untranslated (`None` when no narratives exist).
    pub(crate) async fn ensure_submission_narratives(
        state: &AppState,
        submission_id: Uuid,
        questionnaire: bool,
        regenerate: bool,
    ) -> Option<Vec<String>> {
        if questionnaire {
            return Self::ensure_questionnaire_narratives(state, submission_id, regenerate).await;
        }
        Self::ensure_narratives_in_submission(state, submission_id, regenerate, || {
            Self::generate_cooperative_narratives(state, submission_id)
        })
        .await
        .map(|m| m.untranslated)
    }

    /// Questionnaire reports are English-only: their narratives are generated in
    /// English and stored as a flat object, without translation.
    async fn ensure_questionnaire_narratives(
        state: &AppState,
        submission_id: Uuid,
        regenerate: bool,
    ) -> Option<Vec<String>> {
        if !regenerate {
            let stored = state
                .submission_repo
                .find_by_id(submission_id)
                .await
                .ok()
                .flatten()
                .and_then(|sub| sub.metadata.get("ai_narratives").cloned());
            if stored.is_some() {
                return Some(Vec::new());
            }
        }
        match Self::generate_questionnaire_narratives(state, submission_id).await {
            Ok(narratives) => {
                if let Err(e) = state
                    .submission_repo
                    .update_metadata(
                        submission_id,
                        serde_json::json!({ "ai_narratives": narratives }),
                    )
                    .await
                {
                    tracing::warn!(submission_id = %submission_id, error = %e, "[export] ⚠️ Failed to persist questionnaire narratives");
                }
                Some(Vec::new())
            }
            Err(e) => {
                tracing::warn!(submission_id = %submission_id, error = %e, "[export] ⚠️ Questionnaire narratives failed, rendering without AI summary");
                None
            }
        }
    }

    /// Locales a submission report is rendered and cached in. Questionnaire reports
    /// are English-only and keep the factual fallback when narratives are missing.
    pub(crate) fn report_locales(
        questionnaire: bool,
        untranslated: Option<&Vec<String>>,
    ) -> Vec<&'static str> {
        if questionnaire {
            vec![QUESTIONNAIRE_LOCALE]
        } else {
            Self::cacheable_locales(untranslated)
        }
    }

    async fn ensure_narratives_in_submission<T, F, Fut>(
        state: &AppState,
        submission_id: Uuid,
        regenerate: bool,
        generate: F,
    ) -> Option<Multilingual<T>>
    where
        T: Serialize + DeserializeOwned + Clone + Send + Sync,
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = AppResult<T>>,
    {
        let stored = if regenerate {
            None
        } else {
            match state.submission_repo.find_by_id(submission_id).await {
                Ok(Some(sub)) => sub
                    .metadata
                    .get("ai_narratives")
                    .and_then(narrative_translation::parse_stored::<T>),
                _ => None,
            }
        };

        let (narratives, changed) = Self::complete_narratives(state, stored, generate).await?;
        if changed {
            if let Err(e) = state
                .submission_repo
                .update_metadata(
                    submission_id,
                    serde_json::json!({ "ai_narratives": &narratives }),
                )
                .await
            {
                tracing::warn!(submission_id = %submission_id, error = %e, "[export] ⚠️ Failed to persist narratives");
            }
        }
        Some(narratives)
    }

    /// Brings stored narratives to a complete multilingual set: generates the English
    /// analysis when nothing is stored, translates legacy English-only narratives and
    /// retries locales whose translation failed before. Returns the set and whether
    /// it changed. The English generation releases its AI permit before translation
    /// takes a new one, so a task never holds two permits at once.
    pub(crate) async fn complete_narratives<T, F, Fut>(
        state: &AppState,
        stored: Option<StoredNarratives<T>>,
        generate: F,
    ) -> Option<(Multilingual<T>, bool)>
    where
        T: Serialize + DeserializeOwned + Clone + Send + Sync,
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = AppResult<T>>,
    {
        let generator = state.narrative_generator.as_ref();
        match stored {
            Some(StoredNarratives::Multilingual(m)) if m.is_complete() => Some((m, false)),
            Some(StoredNarratives::Multilingual(mut m)) => {
                let _permit = state.ai_semaphore.acquire().await.ok();
                narrative_translation::complete_missing(generator, &mut m).await;
                Some((m, true))
            }
            Some(StoredNarratives::Legacy(english)) => {
                let _permit = state.ai_semaphore.acquire().await.ok();
                Some((
                    narrative_translation::translate_all(generator, &english).await,
                    true,
                ))
            }
            None => {
                let english = match generate().await {
                    Ok(english) => english,
                    Err(e) => {
                        tracing::warn!(error = %e, "[export] ⚠️ Narratives unavailable");
                        return None;
                    }
                };
                let _permit = state.ai_semaphore.acquire().await.ok();
                Some((
                    narrative_translation::translate_all(generator, &english).await,
                    true,
                ))
            }
        }
    }

    async fn generate_cooperative_narratives(
        state: &AppState,
        submission_id: Uuid,
    ) -> AppResult<report_narrative::CooperativeNarratives> {
        let submission = state
            .submission_repo
            .find_by_id(submission_id)
            .await?
            .ok_or_else(|| crate::error::AppError::NotFound("Submission not found".into()))?;

        let coop = state
            .cooperative_repo
            .find_by_id(submission.cooperative_id)
            .await?
            .ok_or_else(|| crate::error::AppError::NotFound("Cooperative not found".into()))?;

        let kpi_records = state
            .kpi_record_repo
            .find_by_submission(submission_id)
            .await?;

        let prior_kpi_records = if submission.reporting_year > 2020 {
            if let Some(prior_sub) = state
                .submission_repo
                .find_by_cooperative_and_year(
                    submission.cooperative_id,
                    submission.reporting_year - 1,
                )
                .await?
            {
                state
                    .kpi_record_repo
                    .find_by_submission(prior_sub.id)
                    .await?
            } else {
                Vec::new()
            }
        } else {
            Vec::new()
        };

        // Fetch line items from financial statement
        let line_items = match state
            .financial_statement_repo
            .find_by_submission(submission_id)
            .await?
        {
            Some(fs) => {
                let raw_items = state
                    .line_item_repo
                    .find_by_financial_statement(fs.id)
                    .await?;
                if raw_items.is_empty() {
                    None
                } else {
                    let prior_line_items = if submission.reporting_year > 2020 {
                        if let Some(prior_sub) = state
                            .submission_repo
                            .find_by_cooperative_and_year(
                                submission.cooperative_id,
                                submission.reporting_year - 1,
                            )
                            .await?
                        {
                            if let Some(pfs) = state
                                .financial_statement_repo
                                .find_by_submission(prior_sub.id)
                                .await?
                            {
                                state
                                    .line_item_repo
                                    .find_by_financial_statement(pfs.id)
                                    .await
                                    .unwrap_or_default()
                            } else {
                                Vec::new()
                            }
                        } else {
                            Vec::new()
                        }
                    } else {
                        Vec::new()
                    };

                    let mut items: Vec<report_narrative::BalanceSheetLineItemData> = Vec::new();
                    // Deduplicate by account_code, take latest month
                    let mut by_code: std::collections::HashMap<
                        i32,
                        &crate::entities::balance_sheet_line_item::Model,
                    > = std::collections::HashMap::new();
                    for item in &raw_items {
                        if let Some(code) = item.account_code {
                            by_code.insert(code, item);
                        }
                    }
                    let mut prior_map: std::collections::HashMap<i32, f64> =
                        std::collections::HashMap::new();
                    for item in &prior_line_items {
                        if let (Some(code), Some(val)) = (item.account_code, item.value) {
                            prior_map.insert(code, val.to_f64().unwrap_or(0.0));
                        }
                    }
                    for (code, item) in &by_code {
                        let current = item.value.map(|v| v.to_f64().unwrap_or(0.0)).unwrap_or(0.0);
                        let prior = prior_map.get(code).copied();
                        items.push(report_narrative::BalanceSheetLineItemData {
                            account_code: Some(*code),
                            account_name: item.account_name.clone(),
                            current_value: current,
                            prior_value: prior,
                        });
                    }
                    items.sort_by_key(|i| i.account_code.unwrap_or(0));
                    Some(items)
                }
            }
            None => None,
        };

        // Compute NF stats (membership, savings, loans)
        // Pass None for submission_id — NF data is cooperative-level, not submission-specific.
        // The bulk_upsert deduplicates by (cooperative_id, member_id) and overwrites submission_id
        // on conflict, so filtering by submission_id would miss records from other submissions.
        let nf_response =
            match crate::services::nf_indicator_engine::NfIndicatorEngine::compute_for_submission(
                &state.db,
                submission.cooperative_id,
                None,
            )
            .await
            {
                Ok(resp) => Some(resp),
                Err(e) => {
                    tracing::warn!(
                        submission_id = %submission_id,
                        coop_id = %submission.cooperative_id,
                        error = %e,
                        "[export] ⚠️ Failed to compute NF stats, narratives will use empty NF data"
                    );
                    None
                }
            };

        let membership_stats = nf_response
            .as_ref()
            .map(|nf| report_narrative::MembershipStats {
                total_members: nf.membership.total,
                active_members: nf.membership.active,
                dormant_members: nf.membership.dormant,
                women_members: nf.membership.female,
                youth_members: nf.membership.age_18_35 + nf.membership.under_18,
                rural_members: nf.membership.rural,
                agm_participation_pct: nf.membership.agm_participation_pct,
                leadership_count: nf.membership.leadership_count,
                voting_participation_pct: if nf.membership.total > 0 {
                    nf.membership.voting_count as f64 / nf.membership.total as f64 * 100.0
                } else {
                    0.0
                },
            });

        let savings_stats = nf_response
            .as_ref()
            .map(|nf| report_narrative::SavingsStats {
                total_savings_accounts: nf.savings.total_accounts,
                active_savers: nf.savings.active_accounts,
                savings_penetration_pct: nf.savings.savings_penetration_pct,
                avg_savings_balance: nf.savings.average_balance,
            });

        let loan_stats = nf_response.as_ref().map(|nf| report_narrative::LoanStats {
            active_borrowers: nf.loans.members_with_loans,
            women_borrowers: nf.loans.women_borrowers,
            youth_borrowers: nf.loans.youth_borrowers,
            rural_borrowers: nf.loans.rural_borrowers,
            on_time_repayment_pct: nf.loans.on_time_repayment_pct,
        });

        tracing::info!(
            submission_id = %submission_id,
            coop_name = %coop.name,
            year = submission.reporting_year,
            kpis = kpi_records.len(),
            prior_kpis = prior_kpi_records.len(),
            has_line_items = line_items.is_some(),
            has_membership = membership_stats.is_some(),
            has_savings = savings_stats.is_some(),
            has_loans = loan_stats.is_some(),
            "[export] 📋 Loaded submission data | coop={}, year={}, kpis={}, prior_kpis={}, line_items={}, nf_stats={}",
            coop.name,
            submission.reporting_year,
            kpi_records.len(),
            prior_kpi_records.len(),
            line_items.as_ref().map(|l| l.len()).unwrap_or(0),
            if membership_stats.is_some() { "yes" } else { "no" }
        );

        let ctx = report_narrative::build_cooperative_context(
            &coop,
            &submission,
            &kpi_records,
            &prior_kpi_records,
            line_items,
            membership_stats,
            savings_stats,
            loan_stats,
            None,
            None,
            None,
        );

        tracing::info!(
            submission_id = %submission_id,
            "[export] 🤖 Acquiring AI semaphore..."
        );
        let _permit = state.ai_semaphore.acquire().await.map_err(|_| {
            crate::error::AppError::InternalServerError("AI semaphore closed".into())
        })?;
        tracing::info!(
            submission_id = %submission_id,
            available = state.ai_semaphore.available_permits(),
            "[export] 🤖 AI semaphore acquired | available={}",
            state.ai_semaphore.available_permits()
        );

        tracing::info!(
            submission_id = %submission_id,
            "[export] 📡 Generating narratives (5 concurrent LLM calls)..."
        );
        let start = std::time::Instant::now();
        let res = state
            .narrative_generator
            .generate_cooperative_narratives(&ctx)
            .await;

        if res.is_ok() {
            tracing::info!(
                submission_id = %submission_id,
                elapsed_ms = start.elapsed().as_millis(),
                "[export] ✅ Narratives generated in {}ms",
                start.elapsed().as_millis()
            );
        }
        res
    }

    pub(crate) async fn generate_pdf_via_gotenberg(
        state: &AppState,
        print_url: &str,
    ) -> AppResult<Vec<u8>> {
        let clean_url = print_url.split('?').next().unwrap_or(print_url);

        let _permit = state.gotenberg_semaphore.acquire().await.map_err(|_| {
            crate::error::AppError::InternalServerError("Gotenberg semaphore closed".into())
        })?;

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .map_err(|e| {
                crate::error::AppError::InternalServerError(format!(
                    "Failed to build HTTP client: {}",
                    e
                ))
            })?;

        let max_retries = 3;
        let mut last_error = None;

        for attempt in 0..max_retries {
            tracing::info!(
                attempt = attempt + 1,
                url = %clean_url,
                "[gotenberg] 📄 Attempt {}/{} | URL={}",
                attempt + 1,
                max_retries,
                clean_url
            );

            // Margins are set to 0 here — all header/footer/page-margin layout is
            // handled entirely by CSS @page margin-box rules inside the frontend
            // print stylesheet. This gives pixel-perfect control and eliminates the
            // empty-space issues caused by mixing Gotenberg injection with CSS layout.
            let form_clone = reqwest::multipart::Form::new()
                .text("url", print_url.to_string())
                .text("waitForExpression", "window.isReady === true")
                .text("paperWidth", "8.27")
                .text("paperHeight", "11.69")
                .text("marginTop", "0")
                .text("marginBottom", "0")
                .text("marginLeft", "0")
                .text("marginRight", "0")
                .text("printBackground", "true")
                .text("emulateMediaType", "print")
                .text("preferCssPageSize", "true");

            let response = client
                .post(format!(
                    "{}/forms/chromium/convert/url",
                    state.config.gotenberg_url
                ))
                .multipart(form_clone)
                .send()
                .await;

            match response {
                Ok(resp) if resp.status().is_success() => {
                    let bytes = resp.bytes().await.map_err(|e| {
                        crate::error::AppError::InternalServerError(format!(
                            "Failed to read PDF: {}",
                            e
                        ))
                    })?;

                    if bytes.len() < 20_000 {
                        last_error = Some(format!("PDF too small ({} bytes)", bytes.len()));
                        tracing::warn!(
                            attempt = attempt + 1,
                            size_bytes = bytes.len(),
                            "[gotenberg] ⚠️ PDF too small on attempt {} | size={} < 20KB threshold",
                            attempt + 1,
                            bytes.len()
                        );
                        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                        continue;
                    }

                    tracing::info!(
                        attempt = attempt + 1,
                        size_bytes = bytes.len(),
                        "[gotenberg] ✅ PDF received on attempt {} | size={}",
                        attempt + 1,
                        bytes.len()
                    );
                    return Ok(bytes.to_vec());
                }
                Ok(resp) if resp.status().as_u16() == 503 => {
                    last_error = Some("503 Service Unavailable".into());
                    tracing::warn!(
                        attempt = attempt + 1,
                        "[gotenberg] ⚠️ Gotenberg 503 on attempt {} | retrying in 5s...",
                        attempt + 1
                    );
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    continue;
                }
                Ok(resp) => {
                    let status = resp.status();
                    let text = resp.text().await.unwrap_or_default();
                    let trimmed = text.chars().take(200).collect::<String>();
                    let err = format!("Status {}: {}", status, trimmed);
                    last_error = Some(err.clone());
                    tracing::warn!(
                        attempt = attempt + 1,
                        error = %err,
                        "[gotenberg] ⚠️ Gotenberg returned error on attempt {} | error={}",
                        attempt + 1,
                        err
                    );
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    continue;
                }
                Err(e) => {
                    last_error = Some(e.to_string());
                    tracing::warn!(
                        attempt = attempt + 1,
                        error = %e,
                        "[gotenberg] ⚠️ Gotenberg request failed on attempt {} | error={}",
                        attempt + 1,
                        e
                    );
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    continue;
                }
            }
        }

        let final_err = last_error.unwrap_or_else(|| "Unknown error".into());
        tracing::error!(
            attempts = max_retries,
            error = %final_err,
            "[gotenberg] ❌ Gotenberg failed after {} attempts | last_error={}",
            max_retries,
            final_err
        );
        Err(crate::error::AppError::InternalServerError(format!(
            "Gotenberg failed after {} retries: {}",
            max_retries, final_err
        )))
    }

    /// Spawns a background task to generate consolidated Apex exports
    pub fn trigger_apex_export(state: AppState, apex_id: Uuid, reporting_year: i32) {
        tokio::spawn(async move {
            tracing::info!(
                apex_id = %apex_id,
                reporting_year = reporting_year,
                "[export] 🚀 Starting apex export"
            );
            let start = std::time::Instant::now();

            if let Err(e) = Self::generate_apex_formats(&state, apex_id, reporting_year).await {
                tracing::error!(
                    apex_id = %apex_id,
                    error = %e,
                    "[export] ❌ Failed to generate Apex exports in the background"
                );
            } else {
                tracing::info!(
                    apex_id = %apex_id,
                    elapsed_ms = start.elapsed().as_millis(),
                    "[export] ✅ Export complete | total={}ms",
                    start.elapsed().as_millis()
                );
            }
        });
    }

    async fn generate_apex_formats(
        state: &AppState,
        apex_id: Uuid,
        reporting_year: i32,
    ) -> AppResult<()> {
        let (apex, coops_data) = Self::compile_apex_data(state, apex_id, reporting_year).await?;

        tracing::info!(
            apex_id = %apex_id,
            apex_name = %apex.display_name,
            year = reporting_year,
            coops = coops_data.len(),
            "[export] 📋 Loaded apex data | apex={}, year={}, coops={}",
            apex.display_name,
            reporting_year,
            coops_data.len()
        );

        let ctx = report_narrative::build_apex_context(&apex, &coops_data, reporting_year);
        let untranslated =
            Self::ensure_apex_narratives(state, apex_id, reporting_year, Some(ctx)).await;

        let token = state.keycloak.get_admin_token().await?;
        let name = urlencoding::encode(&apex.display_name).into_owned();
        Self::store_consolidated_locales(
            state,
            &Self::cacheable_locales(untranslated.as_ref()),
            |lng| {
                format!(
                    "{}/print/apex/{}?token={}&year={}&name={}&lng={}",
                    state.config.gotenberg_frontend_url,
                    apex.keycloak_id,
                    token,
                    reporting_year,
                    name,
                    lng
                )
            },
            |lng| Self::apex_pdf_key(apex_id, reporting_year, "", lng),
        )
        .await;

        Ok(())
    }

    pub fn apex_pdf_key(apex_id: Uuid, year: i32, tag: &str, lng: &str) -> String {
        format!("{EXPORT_PREFIX}/apex/{apex_id}/apex_{apex_id}_{year}{tag}_{lng}.pdf")
    }

    pub fn federation_pdf_key(federation_id: Uuid, year: i32, tag: &str, lng: &str) -> String {
        format!("{EXPORT_PREFIX}/federation/{federation_id}/federation_{federation_id}_{year}{tag}_{lng}.pdf")
    }

    pub fn ministry_pdf_key(year: i32, tag: &str, lng: &str) -> String {
        format!("{EXPORT_PREFIX}/ministry/ministry_{year}{tag}_{lng}.pdf")
    }

    /// Renders and caches one consolidated report per locale.
    async fn store_consolidated_locales(
        state: &AppState,
        locales: &[&str],
        url_for: impl Fn(&str) -> String,
        key_for: impl Fn(&str) -> String,
    ) {
        for lng in locales {
            let key = key_for(lng);
            match Self::generate_pdf_via_gotenberg(state, &url_for(lng)).await {
                Ok(bytes) => {
                    if let Err(e) = state.storage.store(&key, &bytes, "application/pdf").await {
                        tracing::warn!(lng = *lng, key = %key, error = %e, "[export] ⚠️ Failed to store PDF");
                    } else {
                        tracing::info!(lng = *lng, key = %key, size_bytes = bytes.len(), "[export] ✅ Stored PDF");
                    }
                }
                Err(e) => {
                    tracing::error!(lng = *lng, key = %key, error = %e, "[export] ❌ Failed to render PDF")
                }
            }
        }
    }

    /// Ensures complete multilingual apex narratives for `year`. With `fresh`, the
    /// English analysis is regenerated from that context; without it, only stored
    /// narratives are upgraded or completed. Returns the untranslated locales, or
    /// `None` when no narratives exist.
    pub(crate) async fn ensure_apex_narratives(
        state: &AppState,
        apex_id: Uuid,
        year: i32,
        fresh: Option<report_narrative::ApexNarrativeContext>,
    ) -> Option<Vec<String>> {
        let key = format!("ai_narratives_{year}");
        let stored = if fresh.is_some() {
            None
        } else {
            match state.apex_repo.find_by_id(apex_id).await {
                Ok(Some(apex)) => apex
                    .metadata
                    .as_ref()
                    .and_then(|m| m.get(&key))
                    .and_then(narrative_translation::parse_stored),
                _ => None,
            }
        };
        let generate = || async move {
            let ctx = fresh.ok_or_else(|| {
                crate::error::AppError::NotFound("No apex narratives stored".into())
            })?;
            let _permit = state.ai_semaphore.acquire().await.ok();
            state
                .narrative_generator
                .generate_apex_narratives(&ctx)
                .await
        };

        let (narratives, changed) = Self::complete_narratives(state, stored, generate).await?;
        if changed {
            if let Err(e) = state
                .apex_repo
                .update_metadata(apex_id, serde_json::json!({ &key: &narratives }))
                .await
            {
                tracing::warn!(apex_id = %apex_id, error = %e, "[export] ⚠️ Failed to persist apex narratives");
            }
        }
        Some(narratives.untranslated)
    }

    /// Federation counterpart of [`Self::ensure_apex_narratives`].
    pub(crate) async fn ensure_federation_narratives(
        state: &AppState,
        federation_id: Uuid,
        year: i32,
        fresh: Option<report_narrative::FederationNarrativeContext>,
    ) -> Option<Vec<String>> {
        let key = format!("ai_narratives_{year}");
        let stored = if fresh.is_some() {
            None
        } else {
            match state.federation_repo.find_by_id(federation_id).await {
                Ok(Some(federation)) => federation
                    .metadata
                    .as_ref()
                    .and_then(|m| m.get(&key))
                    .and_then(narrative_translation::parse_stored),
                _ => None,
            }
        };
        let generate = || async move {
            let ctx = fresh.ok_or_else(|| {
                crate::error::AppError::NotFound("No federation narratives stored".into())
            })?;
            let _permit = state.ai_semaphore.acquire().await.ok();
            state
                .narrative_generator
                .generate_federation_narratives(&ctx)
                .await
        };

        let (narratives, changed) = Self::complete_narratives(state, stored, generate).await?;
        if changed {
            if let Err(e) = state
                .federation_repo
                .update_metadata(federation_id, serde_json::json!({ &key: &narratives }))
                .await
            {
                tracing::warn!(federation_id = %federation_id, error = %e, "[export] ⚠️ Failed to persist federation narratives");
            }
        }
        Some(narratives.untranslated)
    }

    /// Ministry counterpart of [`Self::ensure_apex_narratives`].
    pub(crate) async fn ensure_ministry_narratives(
        state: &AppState,
        year: i32,
        fresh: Option<report_narrative::MinistryNarrativeContext>,
    ) -> Option<Vec<String>> {
        let stored = if fresh.is_some() {
            None
        } else {
            match state.ministry_narratives_repo.find_by_year(year).await {
                Ok(Some(cached)) => narrative_translation::parse_stored(&cached.narratives_json),
                _ => None,
            }
        };
        let generate = || async move {
            let ctx = fresh.ok_or_else(|| {
                crate::error::AppError::NotFound("No ministry narratives stored".into())
            })?;
            let _permit = state.ai_semaphore.acquire().await.ok();
            state
                .narrative_generator
                .generate_ministry_narratives(&ctx)
                .await
        };

        let (narratives, changed) = Self::complete_narratives(state, stored, generate).await?;
        if changed {
            match serde_json::to_value(&narratives) {
                Ok(value) => {
                    if let Err(e) = state
                        .ministry_narratives_repo
                        .upsert_narratives(year, value)
                        .await
                    {
                        tracing::warn!(year, error = %e, "[export] ⚠️ Failed to persist ministry narratives");
                    }
                }
                Err(e) => {
                    tracing::warn!(year, error = %e, "[export] ⚠️ Failed to serialise ministry narratives")
                }
            }
        }
        Some(narratives.untranslated)
    }

    async fn compile_apex_data(
        state: &AppState,
        apex_id: Uuid,
        reporting_year: i32,
    ) -> AppResult<(
        crate::entities::apex::Model,
        Vec<(
            crate::entities::cooperative::Model,
            Option<crate::entities::submission::Model>,
            Vec<crate::entities::kpi_record::Model>,
        )>,
    )> {
        let apex = state
            .apex_repo
            .find_by_id(apex_id)
            .await?
            .ok_or_else(|| crate::error::AppError::NotFound("Apex not found".into()))?;

        let cooperatives = state.cooperative_repo.find_by_apex_id(apex_id).await?;
        let mut coops_data = Vec::new();

        for coop in cooperatives {
            let submissions = state.submission_repo.find_by_cooperative(coop.id).await?;
            let submission = submissions
                .into_iter()
                .find(|s| s.reporting_year == reporting_year);

            let mut kpis = Vec::new();
            if let Some(ref sub) = submission {
                kpis = state.kpi_record_repo.find_by_submission(sub.id).await?;
            }
            coops_data.push((coop, submission, kpis));
        }

        Ok((apex, coops_data))
    }

    /// Spawns a background task to generate consolidated Federation exports
    pub fn trigger_federation_export(state: AppState, federation_id: Uuid, reporting_year: i32) {
        tokio::spawn(async move {
            tracing::info!(
                federation_id = %federation_id,
                reporting_year = reporting_year,
                "[export] 🚀 Starting federation export"
            );
            let start = std::time::Instant::now();

            if let Err(e) =
                Self::generate_federation_formats(&state, federation_id, reporting_year).await
            {
                tracing::error!(
                    federation_id = %federation_id,
                    error = %e,
                    "[export] ❌ Failed to generate Federation exports in the background"
                );
            } else {
                tracing::info!(
                    federation_id = %federation_id,
                    elapsed_ms = start.elapsed().as_millis(),
                    "[export] ✅ Export complete | total={}ms",
                    start.elapsed().as_millis()
                );
            }
        });
    }

    async fn generate_federation_formats(
        state: &AppState,
        federation_id: Uuid,
        reporting_year: i32,
    ) -> AppResult<()> {
        let (federation, apexes_data) =
            Self::compile_federation_data(state, federation_id, reporting_year).await?;

        tracing::info!(
            federation_id = %federation_id,
            federation_name = %federation.display_name,
            year = reporting_year,
            apexes = apexes_data.len(),
            "[export] 📋 Loaded federation data | federation={}, year={}, apexes={}",
            federation.display_name,
            reporting_year,
            apexes_data.len()
        );

        let ctx =
            report_narrative::build_federation_context(&federation, &apexes_data, reporting_year);
        let untranslated =
            Self::ensure_federation_narratives(state, federation_id, reporting_year, Some(ctx))
                .await;

        let token = state.keycloak.get_admin_token().await?;
        let name = urlencoding::encode(&federation.display_name).into_owned();
        Self::store_consolidated_locales(
            state,
            &Self::cacheable_locales(untranslated.as_ref()),
            |lng| {
                format!(
                    "{}/print/federation/{}?token={}&year={}&name={}&lng={}",
                    state.config.gotenberg_frontend_url,
                    federation.keycloak_id,
                    token,
                    reporting_year,
                    name,
                    lng
                )
            },
            |lng| Self::federation_pdf_key(federation_id, reporting_year, "", lng),
        )
        .await;

        Ok(())
    }

    async fn compile_federation_data(
        state: &AppState,
        federation_id: Uuid,
        reporting_year: i32,
    ) -> AppResult<(
        crate::entities::federation::Model,
        Vec<(
            crate::entities::apex::Model,
            Vec<(
                crate::entities::cooperative::Model,
                Option<crate::entities::submission::Model>,
                Vec<crate::entities::kpi_record::Model>,
            )>,
        )>,
    )> {
        let federation = state
            .federation_repo
            .find_by_id(federation_id)
            .await?
            .ok_or_else(|| crate::error::AppError::NotFound("Federation not found".into()))?;

        let apexes = state.apex_repo.find_by_federation_id(federation_id).await?;
        let mut apexes_data = Vec::new();

        for apex in apexes {
            let cooperatives = state.cooperative_repo.find_by_apex_id(apex.id).await?;
            let mut coops_data = Vec::new();

            for coop in cooperatives {
                let submissions = state.submission_repo.find_by_cooperative(coop.id).await?;
                let submission = submissions
                    .into_iter()
                    .find(|s| s.reporting_year == reporting_year);

                let mut kpis = Vec::new();
                if let Some(ref sub) = submission {
                    kpis = state.kpi_record_repo.find_by_submission(sub.id).await?;
                }
                coops_data.push((coop, submission, kpis));
            }
            apexes_data.push((apex, coops_data));
        }

        Ok((federation, apexes_data))
    }

    /// Spawns a background task to generate consolidated Ministry exports
    pub fn trigger_ministry_export(state: AppState, reporting_year: i32) {
        tokio::spawn(async move {
            tracing::info!(
                reporting_year = reporting_year,
                "[export] 🚀 Starting ministry export"
            );
            let start = std::time::Instant::now();

            if let Err(e) = Self::generate_ministry_formats(&state, reporting_year).await {
                tracing::error!(
                    error = %e,
                    "[export] ❌ Failed to generate Ministry exports in the background"
                );
            } else {
                tracing::info!(
                    reporting_year = reporting_year,
                    elapsed_ms = start.elapsed().as_millis(),
                    "[export] ✅ Export complete | total={}ms",
                    start.elapsed().as_millis()
                );
            }
        });
    }

    async fn generate_ministry_formats(state: &AppState, reporting_year: i32) -> AppResult<()> {
        let national_data = Self::compile_ministry_data(state, reporting_year).await?;

        tracing::info!(
            year = reporting_year,
            coops = national_data.len(),
            "[export] 📋 Loaded ministry data | year={}, coops={}",
            reporting_year,
            national_data.len()
        );

        let ctx = report_narrative::build_ministry_context(&national_data, reporting_year);
        let untranslated = Self::ensure_ministry_narratives(state, reporting_year, Some(ctx)).await;

        let token = state.keycloak.get_admin_token().await?;
        Self::store_consolidated_locales(
            state,
            &Self::cacheable_locales(untranslated.as_ref()),
            |lng| {
                format!(
                    "{}/print/ministry?token={}&year={}&lng={}",
                    state.config.gotenberg_frontend_url, token, reporting_year, lng
                )
            },
            |lng| Self::ministry_pdf_key(reporting_year, "", lng),
        )
        .await;

        Ok(())
    }

    async fn compile_ministry_data(
        state: &AppState,
        reporting_year: i32,
    ) -> AppResult<
        Vec<(
            crate::entities::cooperative::Model,
            Option<crate::entities::submission::Model>,
            Vec<crate::entities::kpi_record::Model>,
        )>,
    > {
        let cooperatives = crate::entities::cooperative::Entity::find()
            .all(&state.db)
            .await?;
        let mut national_data = Vec::new();

        for coop in cooperatives {
            let submissions = state.submission_repo.find_by_cooperative(coop.id).await?;
            let submission = submissions
                .into_iter()
                .find(|s| s.reporting_year == reporting_year);

            let mut kpis = Vec::new();
            if let Some(ref sub) = submission {
                kpis = state.kpi_record_repo.find_by_submission(sub.id).await?;
            }
            national_data.push((coop, submission, kpis));
        }

        Ok(national_data)
    }
}
