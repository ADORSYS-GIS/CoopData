use crate::error::AppResult;
use crate::services::report_narrative;
use crate::AppState;
use rust_decimal::prelude::ToPrimitive;
use sea_orm::EntityTrait;
use uuid::Uuid;

pub struct ExportGenerator;

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

    /// Generates PDF format and stores it in the bucket
    async fn generate_all_formats(state: &AppState, submission_id: Uuid) -> AppResult<()> {
        let pdf_bytes = Self::generate_cooperative_pdf(state, submission_id).await?;
        
        tracing::info!(
            submission_id = %submission_id,
            size_bytes = pdf_bytes.len(),
            "[export] ✅ PDF received | size={} bytes",
            pdf_bytes.len()
        );
        
        let pdf_key = format!(
            "exports/individual/{}/submission_{}.pdf",
            submission_id, submission_id
        );
        
        tracing::info!(
            submission_id = %submission_id,
            pdf_key = %pdf_key,
            "[export] 📦 Storing PDF to storage..."
        );
        
        state
            .storage
            .store(&pdf_key, &pdf_bytes, "application/pdf")
            .await?;

        Ok(())
    }

    pub(crate) async fn generate_cooperative_pdf(
        state: &AppState,
        submission_id: Uuid,
    ) -> AppResult<Vec<u8>> {
        let token = state.keycloak.get_admin_token().await?;

        let narrative_params = match Self::generate_cooperative_narratives(state, submission_id).await {
            Ok(result) => {
                tracing::info!(
                    submission_id = %submission_id,
                    "[export] 💾 Persisting narratives to metadata..."
                );
                if let Err(e) = state
                    .submission_repo
                    .update_metadata(
                        submission_id,
                        serde_json::json!({ "ai_narratives": result }),
                    )
                    .await
                {
                    tracing::warn!(
                        submission_id = %submission_id,
                        error = %e,
                        "[export] ⚠️ Failed to persist cooperative narratives to metadata"
                    );
                } else {
                    tracing::info!(
                        submission_id = %submission_id,
                        "[export] ✅ Narratives persisted"
                    );
                }
                report_narrative::encode_cooperative_narrative_params(&result)
            }
            Err(e) => {
                tracing::warn!(
                    submission_id = %submission_id,
                    error = %e,
                    "[export] ⚠️ Failed to generate cooperative narratives, using fallback"
                );
                String::new()
            }
        };

        tracing::info!(
            submission_id = %submission_id,
            "[export] 🔗 Building Gotenberg URL..."
        );
        let print_url = format!(
            "{}/print/cooperative/{}?token={}{}",
            state.config.gotenberg_frontend_url, submission_id, token, narrative_params
        );
        
        tracing::info!(
            submission_id = %submission_id,
            "[export] 📤 Sending to Gotenberg..."
        );
        Self::generate_pdf_via_gotenberg(state, &print_url).await
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

        let kpi_records = state.kpi_record_repo.find_by_submission(submission_id).await?;

        let prior_kpi_records = if submission.reporting_year > 2020 {
            if let Some(prior_sub) = state
                .submission_repo
                .find_by_cooperative_and_year(submission.cooperative_id, submission.reporting_year - 1)
                .await?
            {
                state.kpi_record_repo.find_by_submission(prior_sub.id).await?
            } else {
                Vec::new()
            }
        } else {
            Vec::new()
        };

        // Fetch line items from financial statement
        let line_items = match state.financial_statement_repo.find_by_submission(submission_id).await? {
            Some(fs) => {
                let raw_items = state.line_item_repo.find_by_financial_statement(fs.id).await?;
                if raw_items.is_empty() {
                    None
                } else {
                    let prior_line_items = if submission.reporting_year > 2020 {
                        if let Some(prior_sub) = state
                            .submission_repo
                            .find_by_cooperative_and_year(submission.cooperative_id, submission.reporting_year - 1)
                            .await?
                        {
                            if let Some(pfs) = state.financial_statement_repo.find_by_submission(prior_sub.id).await? {
                                state.line_item_repo.find_by_financial_statement(pfs.id).await.unwrap_or_default()
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
                    let mut by_code: std::collections::HashMap<i32, &crate::entities::balance_sheet_line_item::Model> = std::collections::HashMap::new();
                    for item in &raw_items {
                        if let Some(code) = item.account_code {
                            by_code.insert(code, item);
                        }
                    }
                    let mut prior_map: std::collections::HashMap<i32, f64> = std::collections::HashMap::new();
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
        let nf_response = match crate::services::nf_indicator_engine::NfIndicatorEngine::compute_for_submission(
            &state.db,
            submission.cooperative_id,
            None,
        ).await {
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

        let membership_stats = nf_response.as_ref().map(|nf| {
            report_narrative::MembershipStats {
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
            }
        });

        let savings_stats = nf_response.as_ref().map(|nf| {
            report_narrative::SavingsStats {
                total_savings_accounts: nf.savings.total_accounts,
                active_savers: nf.savings.active_accounts,
                savings_penetration_pct: nf.savings.savings_penetration_pct,
                avg_savings_balance: nf.savings.average_balance,
            }
        });

        let loan_stats = nf_response.as_ref().map(|nf| {
            report_narrative::LoanStats {
                active_borrowers: nf.loans.members_with_loans,
                women_borrowers: nf.loans.women_borrowers,
                youth_borrowers: nf.loans.youth_borrowers,
                rural_borrowers: nf.loans.rural_borrowers,
                on_time_repayment_pct: nf.loans.on_time_repayment_pct,
            }
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
            "[export] 📡 Generating narratives (5 sequential LLM calls)..."
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

            let form_clone = reqwest::multipart::Form::new()
                .text("url", print_url.to_string())
                .text("waitDelay", "15s")
                .text("paperWidth", "8.27")
                .text("paperHeight", "11.69")
                .text("marginTop", "0")
                .text("marginBottom", "0")
                .text("marginLeft", "0")
                .text("marginRight", "0")
                .text("printBackground", "true")
                .text("emulateMediaType", "screen");

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
                        last_error = Some(format!(
                            "PDF too small ({} bytes)",
                            bytes.len()
                        ));
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

        let narrative_params = {
            let ctx = report_narrative::build_apex_context(&apex, &coops_data, reporting_year);
            
            tracing::info!(
                apex_id = %apex_id,
                "[export] 🤖 Acquiring AI semaphore..."
            );
            let _permit = state.ai_semaphore.acquire().await.map_err(|_| {
                crate::error::AppError::InternalServerError("AI semaphore closed".into())
            })?;
            tracing::info!(
                apex_id = %apex_id,
                available = state.ai_semaphore.available_permits(),
                "[export] 🤖 AI semaphore acquired | available={}",
                state.ai_semaphore.available_permits()
            );

            tracing::info!(
                apex_id = %apex_id,
                "[export] 📡 Generating apex narratives..."
            );
            let start = std::time::Instant::now();
            match state.narrative_generator.generate_apex_narratives(&ctx).await {
                Ok(result) => {
                    tracing::info!(
                        apex_id = %apex_id,
                        elapsed_ms = start.elapsed().as_millis(),
                        "[export] ✅ Narratives generated in {}ms",
                        start.elapsed().as_millis()
                    );
                    let params = report_narrative::encode_apex_narrative_params(&result);
                    // Persist narratives to apex metadata for frontend retrieval
                    let year_key = format!("ai_narratives_{}", reporting_year);
                    if let Err(e) = state
                        .apex_repo
                        .update_metadata(
                            apex_id,
                            serde_json::json!({ &year_key: serde_json::to_value(&result).unwrap_or_default() }),
                        )
                        .await
                    {
                        tracing::warn!(apex_id = %apex_id, error = %e, "[export] ⚠️ Failed to persist apex narratives to metadata");
                    }
                    params
                }
                Err(e) => {
                    tracing::warn!(apex_id = %apex_id, error = %e, "[export] ⚠️ Failed to generate apex narratives, using fallback");
                    String::new()
                }
            }
        };

        let token = state.keycloak.get_admin_token().await?;
        tracing::info!(apex_id = %apex_id, "[export] 🔗 Building Gotenberg URL...");
        let print_url = format!(
            "{}/print/apex/{}?token={}&year={}{}",
            state.config.gotenberg_frontend_url, apex.keycloak_id, token, reporting_year, narrative_params
        );
        
        tracing::info!(apex_id = %apex_id, "[export] 📤 Sending to Gotenberg...");
        let pdf_bytes = Self::generate_pdf_via_gotenberg(state, &print_url).await?;
        
        tracing::info!(
            apex_id = %apex_id,
            size_bytes = pdf_bytes.len(),
            "[export] ✅ PDF received | size={} bytes",
            pdf_bytes.len()
        );
        
        let pdf_key = format!(
            "exports/apex/{}/apex_{}_{}.pdf",
            apex_id, apex_id, reporting_year
        );
        
        tracing::info!(
            apex_id = %apex_id,
            pdf_key = %pdf_key,
            "[export] 📦 Storing PDF to storage..."
        );
        
        state
            .storage
            .store(&pdf_key, &pdf_bytes, "application/pdf")
            .await?;

        Ok(())
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

        let narrative_params = {
            let ctx = report_narrative::build_federation_context(&federation, &apexes_data, reporting_year);
            
            tracing::info!(
                federation_id = %federation_id,
                "[export] 🤖 Acquiring AI semaphore..."
            );
            let _permit = state.ai_semaphore.acquire().await.map_err(|_| {
                crate::error::AppError::InternalServerError("AI semaphore closed".into())
            })?;
            tracing::info!(
                federation_id = %federation_id,
                available = state.ai_semaphore.available_permits(),
                "[export] 🤖 AI semaphore acquired | available={}",
                state.ai_semaphore.available_permits()
            );

            tracing::info!(
                federation_id = %federation_id,
                "[export] 📡 Generating federation narratives..."
            );
            let start = std::time::Instant::now();
            match state.narrative_generator.generate_federation_narratives(&ctx).await {
                Ok(result) => {
                    tracing::info!(
                        federation_id = %federation_id,
                        elapsed_ms = start.elapsed().as_millis(),
                        "[export] ✅ Narratives generated in {}ms",
                        start.elapsed().as_millis()
                    );
                    let params = report_narrative::encode_federation_narrative_params(&result);
                    // Persist narratives to federation metadata for frontend retrieval
                    let year_key = format!("ai_narratives_{}", reporting_year);
                    if let Err(e) = state
                        .federation_repo
                        .update_metadata(
                            federation_id,
                            serde_json::json!({ &year_key: serde_json::to_value(&result).unwrap_or_default() }),
                        )
                        .await
                    {
                        tracing::warn!(federation_id = %federation_id, error = %e, "[export] ⚠️ Failed to persist federation narratives to metadata");
                    }
                    params
                }
                Err(e) => {
                    tracing::warn!(federation_id = %federation_id, error = %e, "[export] ⚠️ Failed to generate federation narratives, using fallback");
                    String::new()
                }
            }
        };

        let token = state.keycloak.get_admin_token().await?;
        tracing::info!(federation_id = %federation_id, "[export] 🔗 Building Gotenberg URL...");
        let print_url = format!(
            "{}/print/federation/{}?token={}&year={}{}",
            state.config.gotenberg_frontend_url, federation.keycloak_id, token, reporting_year, narrative_params
        );
        
        tracing::info!(federation_id = %federation_id, "[export] 📤 Sending to Gotenberg...");
        let pdf_bytes = Self::generate_pdf_via_gotenberg(state, &print_url).await?;
        
        tracing::info!(
            federation_id = %federation_id,
            size_bytes = pdf_bytes.len(),
            "[export] ✅ PDF received | size={} bytes",
            pdf_bytes.len()
        );
        
        let pdf_key = format!(
            "exports/federation/{}/federation_{}_{}.pdf",
            federation_id, federation_id, reporting_year
        );
        
        tracing::info!(
            federation_id = %federation_id,
            pdf_key = %pdf_key,
            "[export] 📦 Storing PDF to storage..."
        );
        
        state
            .storage
            .store(&pdf_key, &pdf_bytes, "application/pdf")
            .await?;

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

        let narrative_params = {
            let ctx = report_narrative::build_ministry_context(&national_data, reporting_year);
            
            tracing::info!("[export] 🤖 Acquiring AI semaphore...");
            let _permit = state.ai_semaphore.acquire().await.map_err(|_| {
                crate::error::AppError::InternalServerError("AI semaphore closed".into())
            })?;
            tracing::info!(
                available = state.ai_semaphore.available_permits(),
                "[export] 🤖 AI semaphore acquired | available={}",
                state.ai_semaphore.available_permits()
            );

            tracing::info!("[export] 📡 Generating ministry narratives...");
            let start = std::time::Instant::now();
            match state.narrative_generator.generate_ministry_narratives(&ctx).await {
                Ok(result) => {
                    tracing::info!(
                        reporting_year = reporting_year,
                        elapsed_ms = start.elapsed().as_millis(),
                        "[export] ✅ Narratives generated in {}ms",
                        start.elapsed().as_millis()
                    );
                    let params = report_narrative::encode_ministry_narrative_params(&result);
                    // Persist narratives to ministry cache table for frontend retrieval
                    if let Err(e) = state
                        .ministry_narratives_repo
                        .upsert_narratives(
                            reporting_year,
                            serde_json::to_value(&result).unwrap_or_default(),
                        )
                        .await
                    {
                        tracing::warn!(error = %e, "[export] ⚠️ Failed to persist ministry narratives");
                    }
                    params
                }
                Err(e) => {
                    tracing::warn!(error = %e, "[export] ⚠️ Failed to generate ministry narratives, using fallback");
                    String::new()
                }
            }
        };

        let token = state.keycloak.get_admin_token().await?;
        tracing::info!("[export] 🔗 Building Gotenberg URL...");
        let print_url = format!(
            "{}/print/ministry?token={}&year={}{}",
            state.config.gotenberg_frontend_url, token, reporting_year, narrative_params
        );
        
        tracing::info!("[export] 📤 Sending to Gotenberg...");
        let pdf_bytes = Self::generate_pdf_via_gotenberg(state, &print_url).await?;
        
        tracing::info!(
            size_bytes = pdf_bytes.len(),
            "[export] ✅ PDF received | size={} bytes",
            pdf_bytes.len()
        );
        
        let pdf_key = format!("exports/ministry/ministry_{}.pdf", reporting_year);
        
        tracing::info!(
            pdf_key = %pdf_key,
            "[export] 📦 Storing PDF to storage..."
        );
        
        state
            .storage
            .store(&pdf_key, &pdf_bytes, "application/pdf")
            .await?;

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
