use crate::AppState;
use crate::error::AppResult;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
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

    /// Generates XLSX, DOCX, and PDF formats and stores them in the bucket
    async fn generate_all_formats(state: &AppState, submission_id: Uuid) -> AppResult<()> {
        let (submission, cooperative, line_items, kpis) =
            Self::compile_export_data(state, submission_id).await?;

        // 1. Generate XLSX
        let xlsx_bytes = Self::generate_excel_fallback(&submission, &cooperative, &line_items, &kpis)?;
        let xlsx_key = format!("exports/individual/{}/submission_{}.xlsx", submission_id, submission_id);
        state.storage.store(&xlsx_key, &xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").await?;

        // 2. Generate DOCX (Phase F)
        let docx_bytes = Self::generate_cooperative_docx(&submission, &cooperative, &kpis)?;
        let docx_key = format!("exports/individual/{}/submission_{}.docx", submission_id, submission_id);
        state.storage.store(&docx_key, &docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document").await?;

        // 3. Generate PDF (Phase F)
        let pdf_bytes = Self::generate_cooperative_pdf(state, submission_id).await?;
        let pdf_key = format!("exports/individual/{}/submission_{}.pdf", submission_id, submission_id);
        state.storage.store(&pdf_key, &pdf_bytes, "application/pdf").await?;

        Ok(())
    }

    /// Generate an executive-summary DOCX for a single cooperative submission
    fn generate_cooperative_docx(
        submission: &crate::entities::submission::Model,
        cooperative: &crate::entities::cooperative::Model,
        kpis: &crate::services::kpi_engine::ComputedKpiSet,
    ) -> AppResult<Vec<u8>> {
        use docx_rs::{Docx, Paragraph, Run, Table, TableCell, TableRow};

        let add_kpi_row = |kpi_rows: &mut Vec<TableRow>, category: &str, name: &str, val: &str, status: &str| {
            kpi_rows.push(TableRow::new(vec![
                TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text(category))),
                TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text(name))),
                TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text(val))),
                TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text(status))),
            ]));
        };

        let mut kpi_rows = vec![TableRow::new(vec![
            TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().bold().add_text("Category"))),
            TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().bold().add_text("KPI"))),
            TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().bold().add_text("Value"))),
            TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().bold().add_text("Status"))),
        ])];

        let f = kpis;
        add_kpi_row(&mut kpi_rows, "Capital", "Capital Adequacy Ratio", &f.capital_adequacy_ratio.formatted, f.capital_adequacy_ratio.status.as_deref().unwrap_or("N/A"));
        add_kpi_row(&mut kpi_rows, "Quality", "PAR 30", &f.par30.formatted, f.par30.status.as_deref().unwrap_or("N/A"));
        add_kpi_row(&mut kpi_rows, "Quality", "PAR 90", &f.par90.formatted, f.par90.status.as_deref().unwrap_or("N/A"));
        add_kpi_row(&mut kpi_rows, "Profitability", "ROA", &f.roa.formatted, f.roa.status.as_deref().unwrap_or("N/A"));
        add_kpi_row(&mut kpi_rows, "Profitability", "ROE", &f.roe.formatted, f.roe.status.as_deref().unwrap_or("N/A"));
        add_kpi_row(&mut kpi_rows, "Liquidity", "Liquid Funds Ratio", &f.liquid_funds_ratio.formatted, f.liquid_funds_ratio.status.as_deref().unwrap_or("N/A"));
        add_kpi_row(&mut kpi_rows, "Sustainability", "Operational Self-Sufficiency", &f.operational_self_sufficiency.formatted, f.operational_self_sufficiency.status.as_deref().unwrap_or("N/A"));

        let docx = Docx::new()
            .add_paragraph(Paragraph::new().add_run(Run::new().bold().size(36).add_text("COOPERATIVE EXECUTIVE SUMMARY")))
            .add_paragraph(Paragraph::new().add_run(Run::new().size(24).add_text(format!("Cooperative: {}", cooperative.name))))
            .add_paragraph(Paragraph::new().add_run(Run::new().size(20).add_text(format!("Reporting Year: {}", submission.reporting_year))))
            .add_paragraph(Paragraph::new().add_run(Run::new().size(18).add_text(format!("Generated: {}", chrono::Utc::now().format("%Y-%m-%d")))))
            .add_paragraph(Paragraph::new())
            .add_paragraph(Paragraph::new().add_run(Run::new().bold().size(28).add_text("Key Performance Indicators")))
            .add_table(Table::new(kpi_rows));

        let mut buf = std::io::Cursor::new(Vec::new());
        docx.build()
            .pack(&mut buf)
            .map_err(|e| crate::error::AppError::InternalServerError(e.to_string()))?;
        Ok(buf.into_inner())
    }

    /// Generate an executive-summary PDF for a single cooperative submission
    pub(crate) async fn generate_cooperative_pdf(
        state: &AppState,
        submission_id: Uuid,
    ) -> AppResult<Vec<u8>> {
        let token = state.keycloak.get_admin_token().await?;

        let print_url = format!(
            "http://frontend:80/print/cooperative/{}?token={}",
            submission_id, token
        );

        let form = reqwest::multipart::Form::new()
            .text("url", print_url)
            .text("waitExpression", "window.status === 'ready'")
            .text("paperWidth", "8.27")
            .text("paperHeight", "11.69")
            .text("marginTop", "0")
            .text("marginBottom", "0")
            .text("marginLeft", "0")
            .text("marginRight", "0");

        let response = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .map_err(|e| crate::error::AppError::InternalServerError(format!("Failed to build HTTP client: {}", e)))?
            .post("http://gotenberg:3000/forms/chromium/convert/url")
            .multipart(form)
            .send()
            .await
            .map_err(|e| crate::error::AppError::InternalServerError(format!("Failed to connect to Gotenberg: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(crate::error::AppError::InternalServerError(format!(
                "Gotenberg returned error status {}: {}",
                status, text
            )));
        }

        let pdf_bytes = response
            .bytes()
            .await
            .map_err(|e| crate::error::AppError::InternalServerError(format!("Failed to read Gotenberg PDF response: {}", e)))?;

        Ok(pdf_bytes.to_vec())
    }



    pub fn generate_excel_fallback(
        submission: &crate::entities::submission::Model,
        cooperative: &crate::entities::cooperative::Model,
        line_items: &[crate::entities::balance_sheet_line_item::Model],
        kpis: &crate::services::kpi_engine::ComputedKpiSet,
    ) -> AppResult<Vec<u8>> {
        use rust_xlsxwriter::{Color, Format, Workbook};
        use rust_decimal::prelude::ToPrimitive;

        let mut workbook = Workbook::new();

        let header_format = Format::new()
            .set_bold()
            .set_background_color(Color::RGB(0x1F4E78))
            .set_font_color(Color::White);

        let green_format = Format::new()
            .set_background_color(Color::RGB(0xC6EFCE))
            .set_font_color(Color::RGB(0x006100));

        let amber_format = Format::new()
            .set_background_color(Color::RGB(0xFFEB9C))
            .set_font_color(Color::RGB(0x9C6500));

        let red_format = Format::new()
            .set_background_color(Color::RGB(0xFFC7CE))
            .set_font_color(Color::RGB(0x9C0006));

        // SHEET 1: Executive Summary (Phase A)
        let sheet1 = workbook.add_worksheet().set_name("Executive Summary")?;
        sheet1.write(0, 0, "Cooperative Name:")?;
        sheet1.write(0, 1, &cooperative.name)?;
        sheet1.write(1, 0, "Reporting Year:")?;
        sheet1.write(1, 1, submission.reporting_year)?;
        sheet1.write(2, 0, "Status:")?;
        sheet1.write(2, 1, format!("{:?}", submission.status))?;

        let headers1 = [
            "Account Code",
            "Account Name",
            "Category",
            "Value (SZL)",
            "AI Confidence",
        ];
        for (c, h) in headers1.iter().enumerate() {
            sheet1.write_with_format(4, c as u16, *h, &header_format)?;
        }

        for (r, item) in (5..).zip(line_items.iter()) {
            if let Some(code) = item.account_code {
                sheet1.write(r, 0, code)?;
            }
            sheet1.write(r, 1, &item.account_name)?;
            sheet1.write(r, 2, format!("{:?}", item.account_category))?;
            sheet1.write(
                r,
                3,
                item.value.map(|v| v.to_f64().unwrap_or(0.0)).unwrap_or(0.0),
            )?;
            sheet1.write(
                r,
                4,
                item.ai_confidence
                    .map(|v| v.to_f64().unwrap_or(0.0) / 100.0)
                    .unwrap_or(1.0),
            )?;
        }

        // SHEET 2: KPIs
        let sheet2 = workbook.add_worksheet().set_name("KPIs")?;
        let headers2 = [
            "Category",
            "KPI Name",
            "Description",
            "Value",
            "Benchmark",
            "Status",
        ];
        for (c, h) in headers2.iter().enumerate() {
            sheet2.write_with_format(0, c as u16, *h, &header_format)?;
        }

        let mut row = 1;
        let mut write_row = |cat: &str,
                             name: &str,
                             kpi: &crate::services::kpi_engine::KpiValue|
         -> Result<(), rust_xlsxwriter::XlsxError> {
            sheet2.write(row, 0, cat)?;
            sheet2.write(row, 1, name)?;
            sheet2.write(row, 2, &kpi.description)?;
            sheet2.write(row, 3, &kpi.formatted)?;
            if let Some(bench) = kpi.benchmark {
                sheet2.write(row, 4, bench)?;
            }
            if let Some(ref status) = kpi.status {
                let fmt = match status.as_str() {
                    "green" => &green_format,
                    "amber" => &amber_format,
                    "red" => &red_format,
                    _ => &Format::new(),
                };
                sheet2.write_with_format(row, 5, status.as_str(), fmt)?;
            }
            row += 1;
            Ok(())
        };

        // Write financial KPIs
        let f = kpis;
        write_row("Financial Size", "Total Assets", &f.total_assets)?;
        write_row(
            "Financial Size",
            "Gross Loan Portfolio",
            &f.gross_loan_portfolio,
        )?;
        write_row(
            "Financial Size",
            "Net Loan Portfolio",
            &f.net_loan_portfolio,
        )?;
        write_row(
            "Financial Size",
            "Total Member Deposits",
            &f.total_member_deposits,
        )?;
        write_row("Financial Size", "Total Equity", &f.total_equity)?;
        write_row("Financial Size", "Net Surplus", &f.net_surplus)?;
        write_row("Portfolio Quality", "PAR 30", &f.par30)?;
        write_row("Portfolio Quality", "PAR 90", &f.par90)?;
        write_row("Portfolio Quality", "NPL Ratio", &f.npl_ratio)?;
        write_row(
            "Portfolio Quality",
            "Loan Loss Coverage",
            &f.loan_loss_coverage,
        )?;
        write_row("Profitability", "ROA", &f.roa)?;
        write_row("Profitability", "ROE", &f.roe)?;
        write_row(
            "Profitability",
            "Operating Expense Ratio",
            &f.operating_expense_ratio,
        )?;
        write_row(
            "Profitability",
            "Net Interest Margin",
            &f.net_interest_margin,
        )?;
        write_row(
            "Profitability",
            "Operational Self-Sufficiency",
            &f.operational_self_sufficiency,
        )?;
        write_row(
            "Liquidity & Solvency",
            "Capital Adequacy Ratio",
            &f.capital_adequacy_ratio,
        )?;
        write_row(
            "Liquidity & Solvency",
            "Liquid Funds Ratio",
            &f.liquid_funds_ratio,
        )?;
        write_row(
            "Liquidity & Solvency",
            "Deposits to Loans",
            &f.deposits_to_loans,
        )?;

        // SHEET 3: Financial Position (Phase B)
        let sheet3 = workbook.add_worksheet().set_name("Financial Position")?;
        let headers3 = ["Category", "Total (SZL)"];
        for (c, h) in headers3.iter().enumerate() {
            sheet3.write_with_format(0, c as u16, *h, &header_format)?;
        }
        sheet3.write(1, 0, "Total Assets")?;
        sheet3.write(1, 1, &kpis.total_assets.formatted)?;
        sheet3.write(2, 0, "Total Member Deposits")?;
        sheet3.write(2, 1, &kpis.total_member_deposits.formatted)?;
        sheet3.write(3, 0, "Total Equity")?;
        sheet3.write(3, 1, &kpis.total_equity.formatted)?;

        // SHEET 4: Portfolio Quality (Phase B)
        let sheet4 = workbook.add_worksheet().set_name("Portfolio Quality")?;
        let headers4 = ["Metric", "Value", "Status"];
        for (c, h) in headers4.iter().enumerate() {
            sheet4.write_with_format(0, c as u16, *h, &header_format)?;
        }
        sheet4.write(1, 0, "Gross Loan Portfolio")?;
        sheet4.write(1, 1, &kpis.gross_loan_portfolio.formatted)?;
        sheet4.write(2, 0, "PAR 30")?;
        sheet4.write(2, 1, &kpis.par30.formatted)?;
        sheet4.write(3, 0, "PAR 90")?;
        sheet4.write(3, 1, &kpis.par90.formatted)?;
        sheet4.write(4, 0, "NPL Ratio")?;
        sheet4.write(4, 1, &kpis.npl_ratio.formatted)?;

        // SHEET 5: Benchmarks (Phase B)
        let sheet5 = workbook.add_worksheet().set_name("Benchmarks")?;
        let headers5 = ["KPI Name", "Your Value", "Benchmark Target", "Status"];
        for (c, h) in headers5.iter().enumerate() {
            sheet5.write_with_format(0, c as u16, *h, &header_format)?;
        }
        let mut r5 = 1;
        let mut write_b_row = |name: &str, kpi: &crate::services::kpi_engine::KpiValue| -> Result<(), rust_xlsxwriter::XlsxError> {
            sheet5.write(r5, 0, name)?;
            sheet5.write(r5, 1, &kpi.formatted)?;
            if let Some(b) = kpi.benchmark {
                sheet5.write(r5, 2, b)?;
            } else {
                sheet5.write(r5, 2, "N/A")?;
            }
            if let Some(ref status) = kpi.status {
                let fmt = match status.as_str() {
                    "green" => &green_format,
                    "amber" => &amber_format,
                    "red" => &red_format,
                    _ => &Format::new(),
                };
                sheet5.write_with_format(r5, 3, status.as_str(), fmt)?;
            }
            r5 += 1;
            Ok(())
        };
        write_b_row("PAR 30", &kpis.par30)?;
        write_b_row("PAR 90", &kpis.par90)?;
        write_b_row("NPL Ratio", &kpis.npl_ratio)?;
        write_b_row("ROA", &kpis.roa)?;
        write_b_row("ROE", &kpis.roe)?;
        write_b_row("Capital Adequacy Ratio", &kpis.capital_adequacy_ratio)?;

        // SHEET 6: Loan Portfolio Allocation (Phase B Stub)
        let sheet6 = workbook.add_worksheet().set_name("Loan Allocation")?;
        sheet6.write_with_format(0, 0, "Loan Product Type", &header_format)?;
        sheet6.write_with_format(0, 1, "Volume (SZL)", &header_format)?;
        sheet6.write(1, 0, "All Loans (Aggregated)")?;
        sheet6.write(1, 1, &kpis.gross_loan_portfolio.formatted)?;

        // SHEET 7: Deposit Concentration (Phase B Stub)
        let sheet7 = workbook.add_worksheet().set_name("Deposit Concentration")?;
        sheet7.write_with_format(0, 0, "Account Category", &header_format)?;
        sheet7.write_with_format(0, 1, "Balance (SZL)", &header_format)?;
        sheet7.write(1, 0, "Total Member Deposits")?;
        sheet7.write(1, 1, &kpis.total_member_deposits.formatted)?;

        // SHEET 8: Governance & Engagement (Phase B Stub)
        let sheet8 = workbook.add_worksheet().set_name("Governance")?;
        sheet8.write_with_format(0, 0, "Metric", &header_format)?;
        sheet8.write_with_format(0, 1, "Status/Count", &header_format)?;
        sheet8.write(1, 0, "Data pending NF demographic mapping")?;
        sheet8.write(1, 1, "N/A")?;

        // SHEET 9: Regulatory Compliance Buffer
        let sheet9 = workbook.add_worksheet().set_name("Regulatory Buffer")?;
        let headers9 = ["Regulation Metric", "Current Value", "Buffer Status"];
        for (c, h) in headers9.iter().enumerate() {
            sheet9.write_with_format(0, c as u16, *h, &header_format)?;
        }
        sheet9.write(1, 0, "Capital Adequacy (>10%)")?;
        sheet9.write(1, 1, &kpis.capital_adequacy_ratio.formatted)?;
        sheet9.write(1, 2, if kpis.capital_adequacy_ratio.value > 10.0 { "Sufficient" } else { "Deficient" })?;

        // SHEET 10: Peer Percentile Rankings (Phase B Stub)
        let sheet10 = workbook.add_worksheet().set_name("Peer Rankings")?;
        sheet10.write_with_format(0, 0, "Metric", &header_format)?;
        sheet10.write_with_format(0, 1, "Percentile Rank", &header_format)?;
        sheet10.write(1, 0, "Data pending benchmark percentile integration")?;
        sheet10.write(1, 1, "N/A")?;

        workbook
            .save_to_buffer()
            .map_err(|e| crate::error::AppError::InternalServerError(e.to_string()))
    }

    /// Fetches KPIs directly from `kpi_records` table, falling back to `KpiEngine::compute`
    async fn compile_export_data(
        state: &AppState,
        sub_id: Uuid,
    ) -> AppResult<(
        crate::entities::submission::Model,
        crate::entities::cooperative::Model,
        Vec<crate::entities::balance_sheet_line_item::Model>,
        crate::services::kpi_engine::ComputedKpiSet, // We will refactor this to use KpiRecord models
    )> {
        let submission = state
            .submission_repo
            .find_by_id(sub_id)
            .await?
            .ok_or_else(|| crate::error::AppError::NotFound("Submission not found".into()))?;

        let cooperative = state
            .cooperative_repo
            .find_by_id(submission.cooperative_id)
            .await?
            .ok_or_else(|| crate::error::AppError::NotFound("Cooperative not found".into()))?;

        let fs = crate::entities::financial_statement::Entity::find()
            .filter(crate::entities::financial_statement::Column::SubmissionId.eq(sub_id))
            .one(&state.db)
            .await?
            .ok_or_else(|| {
                crate::error::AppError::NotFound("Financial statement not found for submission".into())
            })?;

        let line_items = crate::entities::balance_sheet_line_item::Entity::find()
            .filter(crate::entities::balance_sheet_line_item::Column::FinancialStatementId.eq(fs.id))
            .all(&state.db)
            .await?;

        let mut db_kpis = state.kpi_record_repo.find_by_submission(sub_id).await?;

        if db_kpis.is_empty() {
            tracing::warn!(
                submission_id = %sub_id,
                "KPI records missing from DB during export, auto-computing and saving on-the-fly"
            );
            let workflow = crate::services::submission_workflow::SubmissionWorkflow::new(
                state.submission_repo.clone(),
                state.review_repo.clone(),
                state.flag_repo.clone(),
                state.section_repo.clone(),
                state.financial_statement_repo.clone(),
                state.line_item_repo.clone(),
                state.kpi_record_repo.clone(),
                state.db.clone(),
            );
            if let Err(e) = workflow.compute_and_save_kpis(sub_id, submission.cooperative_id, submission.reporting_year).await {
                tracing::error!("Failed to auto-compute KPIs during export: {}", e);
            }
            db_kpis = state.kpi_record_repo.find_by_submission(sub_id).await?;
        }

        let kpis = {
            tracing::info!(
                submission_id = %sub_id,
                "Successfully read {} KPIs from database for export",
                db_kpis.len()
            );
            
            use crate::services::kpi_engine::KpiValue;
            let get_kpi = |name: &str| -> KpiValue {
                db_kpis.iter().find(|k| k.kpi_name == name).map(|k| KpiValue {
                    name: k.kpi_name.clone(),
                    value: k.value,
                    formatted: k.formatted.clone(),
                    unit: k.unit.clone(),
                    status: k.status.clone(),
                    benchmark: None,
                    description: k.description.clone(),
                }).unwrap_or_else(|| KpiValue {
                    name: name.to_string(),
                    value: 0.0,
                    formatted: "N/A".to_string(),
                    unit: "unknown".to_string(),
                    status: None,
                    benchmark: None,
                    description: "".to_string(),
                })
            };

            crate::services::kpi_engine::ComputedKpiSet {
                total_assets: get_kpi("total_assets"),
                gross_loan_portfolio: get_kpi("gross_loan_portfolio"),
                net_loan_portfolio: get_kpi("net_loan_portfolio"),
                total_member_deposits: get_kpi("total_member_deposits"),
                total_equity: get_kpi("total_equity"),
                par30: get_kpi("par30"),
                par90: get_kpi("par90"),
                npl_ratio: get_kpi("npl_ratio"),
                loan_loss_coverage: get_kpi("loan_loss_coverage"),
                roa: get_kpi("roa"),
                roe: get_kpi("roe"),
                operating_expense_ratio: get_kpi("operating_expense_ratio"),
                capital_adequacy_ratio: get_kpi("capital_adequacy_ratio"),
                liquid_funds_ratio: get_kpi("liquid_funds_ratio"),
                operational_self_sufficiency: get_kpi("operational_self_sufficiency"),
                net_interest_margin: get_kpi("net_interest_margin"),
                deposits_to_loans: get_kpi("deposits_to_loans"),
                net_surplus: get_kpi("net_surplus"),
            }
        };

        Ok((submission, cooperative, line_items, kpis))
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
        let (apex, coops) = Self::compile_apex_data(state, apex_id, reporting_year).await?;

        // 1. Generate XLSX
        let xlsx_bytes = Self::generate_apex_excel(&apex, &coops, reporting_year)?;
        let xlsx_key = format!("exports/apex/{}/apex_{}_{}.xlsx", apex_id, apex_id, reporting_year);
        state.storage.store(&xlsx_key, &xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").await?;

        // 2. Generate DOCX executive summary (Phase F)
        let docx_bytes = Self::generate_consolidated_docx(&apex.display_name, reporting_year, coops.len(), "Apex")?;
        let docx_key = format!("exports/apex/{}/apex_{}_{}.docx", apex_id, apex_id, reporting_year);
        state.storage.store(&docx_key, &docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document").await?;

        // 3. Generate PDF executive summary (Phase F)
        let pdf_bytes = Self::generate_consolidated_pdf(&apex.display_name, reporting_year, coops.len(), "Apex")?;
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

    /// Shared: generate a consolidated executive-summary DOCX for Apex/Federation/Ministry
    fn generate_consolidated_docx(
        org_name: &str,
        reporting_year: i32,
        total_coops: usize,
        tier: &str,
    ) -> AppResult<Vec<u8>> {
        use docx_rs::{Docx, Paragraph, Run};

        let docx = Docx::new()
            .add_paragraph(Paragraph::new().add_run(Run::new().bold().size(36).add_text(format!("{} EXECUTIVE SUMMARY", tier.to_uppercase()))))
            .add_paragraph(Paragraph::new().add_run(Run::new().size(24).add_text(format!("Organization: {}", org_name))))
            .add_paragraph(Paragraph::new().add_run(Run::new().size(20).add_text(format!("Reporting Year: {}", reporting_year))))
            .add_paragraph(Paragraph::new().add_run(Run::new().size(18).add_text(format!("Total Cooperatives Covered: {}", total_coops))))
            .add_paragraph(Paragraph::new().add_run(Run::new().size(18).add_text(format!("Generated: {}", chrono::Utc::now().format("%Y-%m-%d")))))
            .add_paragraph(Paragraph::new())
            .add_paragraph(Paragraph::new().add_run(Run::new().size(16).add_text(
                "This executive summary provides a high-level overview. For full details, please refer to the accompanying Excel workbook."
            )));

        let mut buf = std::io::Cursor::new(Vec::new());
        docx.build()
            .pack(&mut buf)
            .map_err(|e| crate::error::AppError::InternalServerError(e.to_string()))?;
        Ok(buf.into_inner())
    }

    /// Shared: generate a consolidated executive-summary PDF for Apex/Federation/Ministry
    fn generate_consolidated_pdf(
        org_name: &str,
        reporting_year: i32,
        total_coops: usize,
        tier: &str,
    ) -> AppResult<Vec<u8>> {
        use printpdf::{Line, Mm, PdfDocument, Point};

        let (doc, page, layer) = PdfDocument::new(&format!("{} Executive Summary", tier), Mm(210.0), Mm(297.0), "Layer 1");
        let font = doc.add_builtin_font(printpdf::BuiltinFont::Helvetica).unwrap();
        let font_bold = doc.add_builtin_font(printpdf::BuiltinFont::HelveticaBold).unwrap();
        let current_layer = doc.get_page(page).get_layer(layer);

        let mut y = 270.0f32;

        let write_text = |layer: &printpdf::PdfLayerReference, text: &str, x: f32, cy: f32, size: f32, bold: bool| {
            layer.begin_text_section();
            layer.set_font(if bold { &font_bold } else { &font }, size);
            layer.set_text_cursor(Mm(x), Mm(cy));
            layer.write_text(text, if bold { &font_bold } else { &font });
            layer.end_text_section();
        };

        write_text(&current_layer, &format!("{} EXECUTIVE SUMMARY", tier.to_uppercase()), 20.0, y, 16.0, true);
        y -= 8.0;
        write_text(&current_layer, &format!("Organization: {}", org_name), 20.0, y, 11.0, false);
        y -= 6.0;
        write_text(&current_layer, &format!("Reporting Year: {}", reporting_year), 20.0, y, 10.0, false);
        y -= 5.0;
        write_text(&current_layer, &format!("Total Cooperatives Covered: {}", total_coops), 20.0, y, 10.0, false);
        y -= 5.0;
        write_text(&current_layer, &format!("Generated: {}", chrono::Utc::now().format("%Y-%m-%d")), 20.0, y, 10.0, false);
        y -= 8.0;

        let line_pts = vec![
            (Point::new(Mm(20.0), Mm(y)), false),
            (Point::new(Mm(190.0), Mm(y)), false),
        ];
        let divider = Line { points: line_pts, is_closed: false };
        current_layer.set_outline_thickness(0.8);
        current_layer.add_line(divider);
        y -= 8.0;

        write_text(&current_layer, "This executive summary provides a high-level overview.", 20.0, y, 10.0, false);
        y -= 5.0;
        write_text(&current_layer, "For full details, refer to the accompanying Excel workbook.", 20.0, y, 10.0, false);

        let mut buf = std::io::BufWriter::new(Vec::new());
        doc.save(&mut buf).map_err(|e| crate::error::AppError::InternalServerError(e.to_string()))?;
        buf.into_inner().map_err(|e| crate::error::AppError::InternalServerError(e.to_string()))
    }

    pub fn generate_apex_excel(

        apex: &crate::entities::apex::Model,
        coops: &[(crate::entities::cooperative::Model, Option<crate::entities::submission::Model>, Vec<crate::entities::kpi_record::Model>)],
        reporting_year: i32,
    ) -> AppResult<Vec<u8>> {
        use rust_xlsxwriter::{Color, Format, Workbook};
        let mut workbook = Workbook::new();
        let header_format = Format::new()
            .set_bold()
            .set_background_color(Color::RGB(0x1F4E78))
            .set_font_color(Color::White);

        // SHEET 1: Executive Dashboard (Phase C)
        let sheet1 = workbook.add_worksheet().set_name("Executive Dashboard")?;
        sheet1.write(0, 0, "Apex Name:")?;
        sheet1.write(0, 1, &apex.display_name)?;
        sheet1.write(1, 0, "Reporting Year:")?;
        sheet1.write(1, 1, reporting_year)?;
        sheet1.write(2, 0, "Total Cooperatives:")?;
        sheet1.write(2, 1, coops.len() as u32)?;

        // SHEET 2: Cooperative Detail (Phase C)
        let sheet2 = workbook.add_worksheet().set_name("Cooperative Detail")?;
        sheet2.write_with_format(0, 0, "Cooperative Name", &header_format)?;
        sheet2.write_with_format(0, 1, "Submission Status", &header_format)?;
        sheet2.write_with_format(0, 2, "Total Assets (SZL)", &header_format)?;
        
        for (r, (coop, sub, kpis)) in (1..).zip(coops.iter()) {
            sheet2.write(r, 0, &coop.name)?;
            if let Some(s) = sub {
                sheet2.write(r, 1, format!("{:?}", s.status))?;
            } else {
                sheet2.write(r, 1, "Not Submitted")?;
            }
            let assets = kpis.iter().find(|k| k.kpi_name == "total_assets").map(|k| k.value).unwrap_or(0.0);
            sheet2.write(r, 2, assets)?;
        }

        // SHEET 3: Filing Compliance (Phase C)
        let sheet3 = workbook.add_worksheet().set_name("Filing Compliance")?;
        sheet3.write_with_format(0, 0, "Metric", &header_format)?;
        sheet3.write_with_format(0, 1, "Count", &header_format)?;
        sheet3.write(1, 0, "Total Submitted")?;
        sheet3.write(1, 1, coops.iter().filter(|(_, s, _)| s.is_some()).count() as u32)?;
        
        // SHEET 4: Risk Watch (Phase C)
        let sheet4 = workbook.add_worksheet().set_name("Risk Watch")?;
        sheet4.write(0, 0, "Data pending abnormality flags aggregation")?;

        // SHEET 5: Per-Cooperative Detail (Phase C)
        let sheet5 = workbook.add_worksheet().set_name("Per-Cooperative KPIs")?;
        sheet5.write(0, 0, "Data embedded in Sheet 2")?;
        
        // SHEET 6: Filing Efficiency (Phase C)
        let sheet6 = workbook.add_worksheet().set_name("Filing Efficiency")?;
        sheet6.write(0, 0, "Data pending submission reviews aggregation")?;

        workbook
            .save_to_buffer()
            .map_err(|e| crate::error::AppError::InternalServerError(e.to_string()))
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
        let (federation, apexes_data) = Self::compile_federation_data(state, federation_id, reporting_year).await?;
        let total_coops: usize = apexes_data.iter().map(|(_, coops)| coops.len()).sum();

        // 1. Generate XLSX
        let xlsx_bytes = Self::generate_federation_excel(&federation, &apexes_data, reporting_year)?;
        let xlsx_key = format!("exports/federation/{}/federation_{}_{}.xlsx", federation_id, federation_id, reporting_year);
        state.storage.store(&xlsx_key, &xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").await?;

        // 2. Generate DOCX executive summary (Phase F)
        let docx_bytes = Self::generate_consolidated_docx(&federation.display_name, reporting_year, total_coops, "Federation")?;
        let docx_key = format!("exports/federation/{}/federation_{}_{}.docx", federation_id, federation_id, reporting_year);
        state.storage.store(&docx_key, &docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document").await?;

        // 3. Generate PDF executive summary (Phase F)
        let pdf_bytes = Self::generate_consolidated_pdf(&federation.display_name, reporting_year, total_coops, "Federation")?;
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

    pub fn generate_federation_excel(
        federation: &crate::entities::federation::Model,
        apexes_data: &[(
            crate::entities::apex::Model,
            Vec<(crate::entities::cooperative::Model, Option<crate::entities::submission::Model>, Vec<crate::entities::kpi_record::Model>)>
        )],
        reporting_year: i32,
    ) -> AppResult<Vec<u8>> {
        use rust_xlsxwriter::{Color, Format, Workbook};
        let mut workbook = Workbook::new();
        let header_format = Format::new()
            .set_bold()
            .set_background_color(Color::RGB(0x1F4E78))
            .set_font_color(Color::White);

        let total_apexes = apexes_data.len();
        let total_coops: usize = apexes_data.iter().map(|(_, coops)| coops.len()).sum();

        // SHEET 1: Executive Dashboard (Phase D)
        let sheet1 = workbook.add_worksheet().set_name("Executive Dashboard")?;
        sheet1.write(0, 0, "Federation Name:")?;
        sheet1.write(0, 1, &federation.display_name)?;
        sheet1.write(1, 0, "Reporting Year:")?;
        sheet1.write(1, 1, reporting_year)?;
        sheet1.write(2, 0, "Total Apexes:")?;
        sheet1.write(2, 1, total_apexes as u32)?;
        sheet1.write(3, 0, "Total Cooperatives:")?;
        sheet1.write(3, 1, total_coops as u32)?;

        // SHEET 2: Apex Comparison (Phase D)
        let sheet2 = workbook.add_worksheet().set_name("Apex Comparison")?;
        sheet2.write_with_format(0, 0, "Apex Name", &header_format)?;
        sheet2.write_with_format(0, 1, "Total Coops", &header_format)?;
        sheet2.write_with_format(0, 2, "Submitted Coops", &header_format)?;
        sheet2.write_with_format(0, 3, "Total Assets (SZL)", &header_format)?;
        
        for (r, (apex, coops)) in (1..).zip(apexes_data.iter()) {
            let submitted_count = coops.iter().filter(|(_, s, _)| s.is_some()).count();
            let total_assets: f64 = coops.iter()
                .flat_map(|(_, _, kpis)| kpis.iter())
                .filter(|k| k.kpi_name == "total_assets")
                .map(|k| k.value)
                .sum();

            sheet2.write(r, 0, &apex.display_name)?;
            sheet2.write(r, 1, coops.len() as u32)?;
            sheet2.write(r, 2, submitted_count as u32)?;
            sheet2.write(r, 3, total_assets)?;
        }

        // SHEET 3: Filing Compliance (Phase D)
        let sheet3 = workbook.add_worksheet().set_name("Filing Compliance")?;
        sheet3.write(0, 0, "Data embedded in Apex Comparison")?;

        // SHEET 4: PEARLS Analysis (Phase D)
        let sheet4 = workbook.add_worksheet().set_name("PEARLS Analysis")?;
        sheet4.write(0, 0, "Data pending PEARLS mapping and aggregation")?;

        // SHEET 5: Social Impact (Phase D)
        let sheet5 = workbook.add_worksheet().set_name("Social Impact")?;
        sheet5.write(0, 0, "Data pending social metrics integration")?;

        // SHEET 6: Risk & Efficiency (Phase D)
        let sheet6 = workbook.add_worksheet().set_name("Risk & Efficiency")?;
        sheet6.write(0, 0, "Data pending abnormality flags aggregation")?;

        workbook
            .save_to_buffer()
            .map_err(|e| crate::error::AppError::InternalServerError(e.to_string()))
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
        let national_data = Self::compile_ministry_data(state, reporting_year).await?;
        let total_coops = national_data.len();

        // 1. Generate XLSX
        let xlsx_bytes = Self::generate_ministry_excel(&national_data, reporting_year)?;
        let xlsx_key = format!("exports/ministry/ministry_{}.xlsx", reporting_year);
        state.storage.store(&xlsx_key, &xlsx_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").await?;

        // 2. Generate DOCX executive summary (Phase F)
        let docx_bytes = Self::generate_consolidated_docx("National Ministry", reporting_year, total_coops, "Ministry")?;
        let docx_key = format!("exports/ministry/ministry_{}.docx", reporting_year);
        state.storage.store(&docx_key, &docx_bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document").await?;

        // 3. Generate PDF executive summary (Phase F)
        let pdf_bytes = Self::generate_consolidated_pdf("National Ministry", reporting_year, total_coops, "Ministry")?;
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

    pub fn generate_ministry_excel(
        national_data: &[(
            crate::entities::cooperative::Model,
            Option<crate::entities::submission::Model>,
            Vec<crate::entities::kpi_record::Model>,
        )],
        reporting_year: i32,
    ) -> AppResult<Vec<u8>> {
        use rust_xlsxwriter::{Color, Format, Workbook};
        let mut workbook = Workbook::new();
        let header_format = Format::new()
            .set_bold()
            .set_background_color(Color::RGB(0x1F4E78))
            .set_font_color(Color::White);

        let total_coops = national_data.len();
        let submitted_coops = national_data.iter().filter(|(_, s, _)| s.is_some()).count();
        let total_assets: f64 = national_data.iter()
            .flat_map(|(_, _, kpis)| kpis.iter())
            .filter(|k| k.kpi_name == "total_assets")
            .map(|k| k.value)
            .sum();

        // SHEET 1: National Highlights
        let sheet1 = workbook.add_worksheet().set_name("National Highlights")?;
        sheet1.write(0, 0, "Reporting Year:")?;
        sheet1.write(0, 1, reporting_year)?;
        sheet1.write(1, 0, "Total Cooperatives Nationwide:")?;
        sheet1.write(1, 1, total_coops as u32)?;
        sheet1.write(2, 0, "Total Submitted:")?;
        sheet1.write(2, 1, submitted_coops as u32)?;
        sheet1.write(3, 0, "National Total Assets (SZL):")?;
        sheet1.write(3, 1, total_assets)?;

        // SHEET 2: Sector Overview
        let sheet2 = workbook.add_worksheet().set_name("Sector Overview")?;
        sheet2.write_with_format(0, 0, "Sector (Institution Type)", &header_format)?;
        sheet2.write_with_format(0, 1, "Count", &header_format)?;
        sheet2.write_with_format(0, 2, "Total Assets", &header_format)?;
        
        let mut sector_map = std::collections::HashMap::new();
        for (coop, _, kpis) in national_data {
            let sector = coop.institution_type.clone();
            let assets: f64 = kpis.iter().filter(|k| k.kpi_name == "total_assets").map(|k| k.value).sum();
            let entry = sector_map.entry(sector).or_insert((0, 0.0));
            entry.0 += 1;
            entry.1 += assets;
        }
        for (r, (sector, (count, assets))) in (1..).zip(sector_map.into_iter()) {
            let sector_str = sector.as_ref().map(|s| s.as_str()).unwrap_or("").to_string();
            sheet2.write(r, 0, &sector_str)?;
            sheet2.write(r, 1, count)?;
            sheet2.write(r, 2, assets)?;
        }

        // SHEET 3: Regional Breakdown
        let sheet3 = workbook.add_worksheet().set_name("Regional Breakdown")?;
        sheet3.write_with_format(0, 0, "Region", &header_format)?;
        sheet3.write_with_format(0, 1, "Count", &header_format)?;
        sheet3.write_with_format(0, 2, "Total Assets", &header_format)?;
        
        let mut region_map = std::collections::HashMap::new();
        for (coop, _, kpis) in national_data {
            let region = coop.region.clone();
            let assets: f64 = kpis.iter().filter(|k| k.kpi_name == "total_assets").map(|k| k.value).sum();
            let entry = region_map.entry(region).or_insert((0, 0.0));
            entry.0 += 1;
            entry.1 += assets;
        }
        for (r, (region, (count, assets))) in (1..).zip(region_map.into_iter()) {
            let region_str = region.as_ref().map(|r| r.as_str()).unwrap_or("").to_string();
            sheet3.write(r, 0, &region_str)?;
            sheet3.write(r, 1, count)?;
            sheet3.write(r, 2, assets)?;
        }

        // SHEETS 4-13: Stubs
        workbook.add_worksheet().set_name("Risk Heatmap")?.write(0, 0, "Stub")?;
        workbook.add_worksheet().set_name("Market Concentration")?.write(0, 0, "Stub")?;
        workbook.add_worksheet().set_name("Capital Adequacy")?.write(0, 0, "Stub")?;
        workbook.add_worksheet().set_name("Portfolio Quality")?.write(0, 0, "Stub")?;
        workbook.add_worksheet().set_name("Financial Position")?.write(0, 0, "Stub")?;
        workbook.add_worksheet().set_name("Top Performers")?.write(0, 0, "Stub")?;
        workbook.add_worksheet().set_name("Audit Deficiencies")?.write(0, 0, "Stub")?;
        workbook.add_worksheet().set_name("Compliance Pivot")?.write(0, 0, "Stub")?;
        workbook.add_worksheet().set_name("Federation Summary")?.write(0, 0, "Stub")?;
        // Note: NDP Sector Mapping omitted per feasibility report

        workbook
            .save_to_buffer()
            .map_err(|e| crate::error::AppError::InternalServerError(e.to_string()))
    }
}
