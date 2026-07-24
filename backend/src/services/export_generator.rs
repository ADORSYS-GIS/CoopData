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

    /// Generates XLSX, CSV, DOCX, and PDF formats and stores them in the bucket
    async fn generate_all_formats(state: &AppState, submission_id: Uuid) -> AppResult<()> {
        let (submission, cooperative, line_items, kpis) =
            Self::compile_export_data(state, submission_id).await?;

        // 1. Generate XLSX
        let xlsx_bytes = Self::generate_excel_fallback(&submission, &cooperative, &line_items, &kpis)?;
        let xlsx_filename = format!("submission_{}.xlsx", submission_id);
        let xlsx_key = format!("exports/individual/{}/{}", submission_id, xlsx_filename);
        state
            .storage
            .store(
                &xlsx_key,
                &xlsx_bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            .await?;

        // TODO: Generate other formats (CSV, DOCX, PDF) in Phase D.

        Ok(())
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

        // 1. Try fetching from kpi_records table first
        let db_kpis = state.kpi_record_repo.find_by_submission(sub_id).await?;

        let kpis = if db_kpis.is_empty() {
            // 2. Fallback to computing on the fly
            tracing::warn!(
                submission_id = %sub_id,
                "KPI records missing from DB during export, falling back to KpiEngine"
            );
            crate::services::kpi_engine::KpiEngine::compute(&line_items)
        } else {
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
}
