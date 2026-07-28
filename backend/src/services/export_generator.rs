use crate::AppState;
use crate::error::AppResult;
use sea_orm::EntityTrait;
use uuid::Uuid;

pub struct ExportGenerator;

impl ExportGenerator {
    /// Spawns a background task to generate exports when a submission is approved
    pub fn trigger_cooperative_export(state: AppState, submission_id: Uuid) {
        tokio::spawn(async move {
            tracing::info!(
                submission_id = %submission_id,
                "Starting background export generation"
            );

            if let Err(e) = Self::generate_all_formats(&state, submission_id).await {
                tracing::error!(
                    submission_id = %submission_id,
                    error = %e,
                    "Failed to generate exports in the background"
                );
            } else {
                tracing::info!(
                    submission_id = %submission_id,
                    "Successfully pre-baked all export formats"
                );
            }
        });
    }

    /// Generates PDF format and stores it in the bucket
    async fn generate_all_formats(state: &AppState, submission_id: Uuid) -> AppResult<()> {
        let pdf_bytes = Self::generate_cooperative_pdf(state, submission_id).await?;
        let pdf_key = format!("exports/individual/{}/submission_{}.pdf", submission_id, submission_id);
        state.storage.store(&pdf_key, &pdf_bytes, "application/pdf").await?;

        Ok(())
    }



    pub(crate) async fn generate_cooperative_pdf(
        state: &AppState,
        submission_id: Uuid,
    ) -> AppResult<Vec<u8>> {
        let token = state.keycloak.get_admin_token().await?;
        let print_url = format!(
            "{}/print/cooperative/{}?token={}",
            state.config.gotenberg_frontend_url, submission_id, token
        );
        Self::generate_pdf_via_gotenberg(state, &print_url).await
    }

    pub(crate) async fn generate_pdf_via_gotenberg(
        state: &AppState,
        print_url: &str,
    ) -> AppResult<Vec<u8>> {
        tracing::info!("Generating PDF via Gotenberg with URL: {}", print_url);

        let _permit = state.gotenberg_semaphore.acquire().await
            .map_err(|_| crate::error::AppError::InternalServerError("Gotenberg semaphore closed".into()))?;

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(35))
            .build()
            .map_err(|e| crate::error::AppError::InternalServerError(format!("Failed to build HTTP client: {}", e)))?;

        let max_retries = 2;
        let mut last_error = None;

        for attempt in 0..max_retries {
            let form_clone = reqwest::multipart::Form::new()
                .text("url", print_url.to_string())
                .text("waitDelay", "25s")
                .text("paperWidth", "8.27")
                .text("paperHeight", "11.69")
                .text("marginTop", "0")
                .text("marginBottom", "0")
                .text("marginLeft", "0")
                .text("marginRight", "0")
                .text("printBackground", "true")
                .text("emulateMediaType", "screen");

            let response = client
                .post("http://gotenberg:3000/forms/chromium/convert/url")
                .multipart(form_clone)
                .send()
                .await;

            match response {
                Ok(resp) if resp.status().is_success() => {
                    let bytes = resp.bytes().await
                        .map_err(|e| crate::error::AppError::InternalServerError(format!("Failed to read PDF: {}", e)))?;
                    
                    if bytes.len() < 20_000 {
                        last_error = Some(format!("PDF too small ({} bytes) on attempt {}", bytes.len(), attempt + 1));
                        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                        continue;
                    }
                    
                    return Ok(bytes.to_vec());
                }
                Ok(resp) if resp.status().as_u16() == 503 => {
                    last_error = Some(format!("503 on attempt {}", attempt + 1));
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    continue;
                }
                Ok(resp) => {
                    let status = resp.status();
                    let text = resp.text().await.unwrap_or_default();
                    return Err(crate::error::AppError::InternalServerError(format!(
                        "Gotenberg returned error status {}: {}", status, text
                    )));
                }
                Err(e) => {
                    last_error = Some(e.to_string());
                    tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                    continue;
                }
            }
        }

        Err(crate::error::AppError::InternalServerError(format!(
            "Gotenberg failed after {} retries: {:?}",
            max_retries, last_error
        )))
    }

    /// Spawns a background task to generate consolidated Apex exports
    pub fn trigger_apex_export(state: AppState, apex_id: Uuid, reporting_year: i32) {
        tokio::spawn(async move {
            tracing::info!(
                apex_id = %apex_id,
                reporting_year = reporting_year,
                "Starting background Apex export generation"
            );

            if let Err(e) = Self::generate_apex_formats(&state, apex_id, reporting_year).await {
                tracing::error!(
                    apex_id = %apex_id,
                    error = %e,
                    "Failed to generate Apex exports in the background"
                );
            } else {
                tracing::info!(
                    apex_id = %apex_id,
                    "Successfully pre-baked Apex export formats"
                );
            }
        });
    }

    async fn generate_apex_formats(state: &AppState, apex_id: Uuid, reporting_year: i32) -> AppResult<()> {
        let (apex, _coops) = Self::compile_apex_data(state, apex_id, reporting_year).await?;

        let token = state.keycloak.get_admin_token().await?;
        let print_url = format!(
            "{}/print/apex/{}?token={}&year={}",
            state.config.gotenberg_frontend_url, apex.keycloak_id, token, reporting_year
        );
        let pdf_bytes = Self::generate_pdf_via_gotenberg(state, &print_url).await?;
        let pdf_key = format!("exports/apex/{}/apex_{}_{}.pdf", apex_id, apex_id, reporting_year);
        state.storage.store(&pdf_key, &pdf_bytes, "application/pdf").await?;

        Ok(())
    }

    async fn compile_apex_data(
        state: &AppState,
        apex_id: Uuid,
        reporting_year: i32,
    ) -> AppResult<(
        crate::entities::apex::Model,
        Vec<(crate::entities::cooperative::Model, Option<crate::entities::submission::Model>, Vec<crate::entities::kpi_record::Model>)>
    )> {
        let apex = state.apex_repo.find_by_id(apex_id).await?
            .ok_or_else(|| crate::error::AppError::NotFound("Apex not found".into()))?;

        let cooperatives = state.cooperative_repo.find_by_apex_id(apex_id).await?;
        let mut coops_data = Vec::new();

        for coop in cooperatives {
            let submissions = state.submission_repo.find_by_cooperative(coop.id).await?;
            let submission = submissions.into_iter().find(|s| s.reporting_year == reporting_year);
            
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
                "Starting background Federation export generation"
            );

            if let Err(e) = Self::generate_federation_formats(&state, federation_id, reporting_year).await {
                tracing::error!(
                    federation_id = %federation_id,
                    error = %e,
                    "Failed to generate Federation exports in the background"
                );
            } else {
                tracing::info!(
                    federation_id = %federation_id,
                    "Successfully pre-baked Federation export formats"
                );
            }
        });
    }

    async fn generate_federation_formats(state: &AppState, federation_id: Uuid, reporting_year: i32) -> AppResult<()> {
        let (federation, _apexes_data) = Self::compile_federation_data(state, federation_id, reporting_year).await?;

        let token = state.keycloak.get_admin_token().await?;
        let print_url = format!(
            "{}/print/federation/{}?token={}&year={}",
            state.config.gotenberg_frontend_url, federation.keycloak_id, token, reporting_year
        );
        let pdf_bytes = Self::generate_pdf_via_gotenberg(state, &print_url).await?;
        let pdf_key = format!("exports/federation/{}/federation_{}_{}.pdf", federation_id, federation_id, reporting_year);
        state.storage.store(&pdf_key, &pdf_bytes, "application/pdf").await?;

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
            Vec<(crate::entities::cooperative::Model, Option<crate::entities::submission::Model>, Vec<crate::entities::kpi_record::Model>)>
        )>
    )> {
        let federation = state.federation_repo.find_by_id(federation_id).await?
            .ok_or_else(|| crate::error::AppError::NotFound("Federation not found".into()))?;

        let apexes = state.apex_repo.find_by_federation_id(federation_id).await?;
        let mut apexes_data = Vec::new();

        for apex in apexes {
            let cooperatives = state.cooperative_repo.find_by_apex_id(apex.id).await?;
            let mut coops_data = Vec::new();

            for coop in cooperatives {
                let submissions = state.submission_repo.find_by_cooperative(coop.id).await?;
                let submission = submissions.into_iter().find(|s| s.reporting_year == reporting_year);
                
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
                "Starting background Ministry export generation"
            );

            if let Err(e) = Self::generate_ministry_formats(&state, reporting_year).await {
                tracing::error!(
                    error = %e,
                    "Failed to generate Ministry exports in the background"
                );
            } else {
                tracing::info!(
                    reporting_year = reporting_year,
                    "Successfully pre-baked Ministry export formats"
                );
            }
        });
    }

    async fn generate_ministry_formats(state: &AppState, reporting_year: i32) -> AppResult<()> {
        let _national_data = Self::compile_ministry_data(state, reporting_year).await?;

        let token = state.keycloak.get_admin_token().await?;
        let print_url = format!(
            "{}/print/ministry?token={}&year={}",
            state.config.gotenberg_frontend_url, token, reporting_year
        );
        let pdf_bytes = Self::generate_pdf_via_gotenberg(state, &print_url).await?;
        let pdf_key = format!("exports/ministry/ministry_{}.pdf", reporting_year);
        state.storage.store(&pdf_key, &pdf_bytes, "application/pdf").await?;

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
        )>
    > {
        let cooperatives = crate::entities::cooperative::Entity::find()
            .all(&state.db)
            .await?;
        let mut national_data = Vec::new();

        for coop in cooperatives {
            let submissions = state.submission_repo.find_by_cooperative(coop.id).await?;
            let submission = submissions.into_iter().find(|s| s.reporting_year == reporting_year);
            
            let mut kpis = Vec::new();
            if let Some(ref sub) = submission {
                kpis = state.kpi_record_repo.find_by_submission(sub.id).await?;
            }
            national_data.push((coop, submission, kpis));
        }

        Ok(national_data)
    }
}
