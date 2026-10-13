use rust_decimal::prelude::ToPrimitive;
use sea_orm::EntityTrait;
use uuid::Uuid;

use crate::error::AppResult;
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
    /// Storage key of one locale of a single-submission report.
    pub fn submission_pdf_key(submission_id: Uuid, lng: &str) -> String {
        format!("{EXPORT_PREFIX}/individual/{submission_id}/submission_{submission_id}_{lng}.pdf")
    }

    pub(crate) fn submission_print_url(
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

    /// Questionnaire reports are English-only: their narratives are generated in
    /// English and stored as a flat object, without translation. When generation
    /// fails the report renders its factual sections without an AI summary.
    pub(crate) async fn ensure_questionnaire_narratives(
        state: &AppState,
        submission_id: Uuid,
        regenerate: bool,
    ) {
        if !regenerate {
            let stored = state
                .submission_repo
                .find_by_id(submission_id)
                .await
                .ok()
                .flatten()
                .and_then(|sub| sub.metadata.get("ai_narratives").cloned());
            if stored.is_some() {
                return;
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
            }
            Err(e) => {
                tracing::warn!(submission_id = %submission_id, error = %e, "[export] ⚠️ Questionnaire narratives failed, rendering without AI summary");
            }
        }
    }

    pub(crate) async fn generate_cooperative_narratives(
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

    pub fn apex_pdf_key(apex_id: Uuid, year: i32, tag: &str, lng: &str) -> String {
        format!("{EXPORT_PREFIX}/apex/{apex_id}/apex_{apex_id}_{year}{tag}_{lng}.pdf")
    }

    pub fn federation_pdf_key(federation_id: Uuid, year: i32, tag: &str, lng: &str) -> String {
        format!("{EXPORT_PREFIX}/federation/{federation_id}/federation_{federation_id}_{year}{tag}_{lng}.pdf")
    }

    pub fn ministry_pdf_key(year: i32, tag: &str, lng: &str) -> String {
        format!("{EXPORT_PREFIX}/ministry/ministry_{year}{tag}_{lng}.pdf")
    }

    /// Generates the English apex narratives of `year` from the current data.
    pub(crate) async fn generate_apex_narratives(
        state: &AppState,
        apex_id: Uuid,
        year: i32,
    ) -> AppResult<report_narrative::ApexNarratives> {
        let (apex, coops_data) = Self::compile_apex_data(state, apex_id, year).await?;
        tracing::info!(
            apex_id = %apex_id,
            year,
            coops = coops_data.len(),
            "[export] 📋 Loaded apex data"
        );
        let ctx = report_narrative::build_apex_context(&apex, &coops_data, year);
        let _permit = Self::ai_permit(state).await?;
        state
            .narrative_generator
            .generate_apex_narratives(&ctx)
            .await
    }

    /// Generates the English federation narratives of `year` from the current data.
    pub(crate) async fn generate_federation_narratives(
        state: &AppState,
        federation_id: Uuid,
        year: i32,
    ) -> AppResult<report_narrative::FederationNarratives> {
        let (federation, apexes_data) =
            Self::compile_federation_data(state, federation_id, year).await?;
        tracing::info!(
            federation_id = %federation_id,
            year,
            apexes = apexes_data.len(),
            "[export] 📋 Loaded federation data"
        );
        let ctx = report_narrative::build_federation_context(&federation, &apexes_data, year);
        let _permit = Self::ai_permit(state).await?;
        state
            .narrative_generator
            .generate_federation_narratives(&ctx)
            .await
    }

    /// Generates the English national narratives of `year` from the current data.
    pub(crate) async fn generate_ministry_narratives(
        state: &AppState,
        year: i32,
    ) -> AppResult<report_narrative::MinistryNarratives> {
        let national_data = Self::compile_ministry_data(state, year).await?;
        tracing::info!(
            year,
            coops = national_data.len(),
            "[export] 📋 Loaded ministry data"
        );
        let ctx = report_narrative::build_ministry_context(&national_data, year);
        let _permit = Self::ai_permit(state).await?;
        state
            .narrative_generator
            .generate_ministry_narratives(&ctx)
            .await
    }

    pub(crate) async fn ai_permit(state: &AppState) -> AppResult<tokio::sync::SemaphorePermit<'_>> {
        state
            .ai_semaphore
            .acquire()
            .await
            .map_err(|_| crate::error::AppError::InternalServerError("AI semaphore closed".into()))
    }

    pub(crate) async fn compile_apex_data(
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

    pub(crate) async fn compile_federation_data(
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

    pub(crate) async fn compile_ministry_data(
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
