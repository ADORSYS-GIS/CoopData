use axum::body::Body;
use axum::response::Response;
use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Extension,
};
use chrono::Utc;
use docx_rs::{Docx, Paragraph, Run, Table, TableCell, TableRow};
use printpdf::{Line, Mm, PdfDocument, Point};
use rust_decimal::prelude::ToPrimitive;
use rust_xlsxwriter::{Color, Format, Workbook};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
use std::sync::Arc;
use uuid::Uuid;

use crate::auth::claims::Claims;
use crate::entities::{balance_sheet_line_item, cooperative, financial_statement, submission};
use crate::error::{AppError, AppResult};
use crate::services::kpi_engine::{KpiEngine, KpiValue as KpiResult};
use crate::AppState;

#[derive(Debug, serde::Deserialize)]
pub struct ExportQuery {
    pub format: String,
    pub federation_id: Option<Uuid>,
    pub apex_id: Option<Uuid>,
    pub reporting_year: Option<i32>,
}

// Low-level helper to write a line with built-in Helvetica font in printpdf
struct PdfWriter {
    doc: printpdf::PdfDocumentReference,
    current_page: printpdf::PdfPageIndex,
    current_layer: printpdf::PdfLayerIndex,
    current_y: f32, // in mm
    font: printpdf::IndirectFontRef,
    font_bold: printpdf::IndirectFontRef,
}

impl PdfWriter {
    fn new(title: &str) -> Self {
        let (doc, page, layer) = PdfDocument::new(title, Mm(210.0), Mm(297.0), "Layer 1");
        let font = doc
            .add_builtin_font(printpdf::BuiltinFont::Helvetica)
            .unwrap();
        let font_bold = doc
            .add_builtin_font(printpdf::BuiltinFont::HelveticaBold)
            .unwrap();
        Self {
            doc,
            current_page: page,
            current_layer: layer,
            current_y: 270.0,
            font,
            font_bold,
        }
    }

    fn check_page_break(&mut self, needed: f32) {
        if self.current_y - needed < 20.0 {
            let (page, layer) = self.doc.add_page(Mm(210.0), Mm(297.0), "Layer 1");
            self.current_page = page;
            self.current_layer = layer;
            self.current_y = 270.0;
        }
    }

    fn write_text(&mut self, text: &str, x: f32, size: f32, is_bold: bool) {
        let layer = self
            .doc
            .get_page(self.current_page)
            .get_layer(self.current_layer);
        layer.begin_text_section();
        layer.set_font(if is_bold { &self.font_bold } else { &self.font }, size);
        layer.set_text_cursor(Mm(x), Mm(self.current_y));
        layer.write_text(text, if is_bold { &self.font_bold } else { &self.font });
        layer.end_text_section();
    }

    fn write_line(&mut self, text: &str, size: f32, is_bold: bool) {
        let needed = size * 0.4 + 4.0;
        self.check_page_break(needed);
        self.write_text(text, 20.0, size, is_bold);
        self.current_y -= needed;
    }

    fn draw_divider(&mut self) {
        self.check_page_break(5.0);
        let layer = self
            .doc
            .get_page(self.current_page)
            .get_layer(self.current_layer);
        let line_points = vec![
            (Point::new(Mm(20.0), Mm(self.current_y)), false),
            (Point::new(Mm(190.0), Mm(self.current_y)), false),
        ];
        let line = Line {
            points: line_points,
            is_closed: false,
        };
        layer.set_outline_thickness(1.0);
        layer.add_line(line);
        self.current_y -= 5.0;
    }
}

// Shared helper to compile data for a single cooperative submission.
// Returns the submission, cooperative, line items, and a ComputedKpiSet.
async fn compile_export_data(
    state: &AppState,
    sub_id: Uuid,
) -> AppResult<(
    submission::Model,
    cooperative::Model,
    Vec<balance_sheet_line_item::Model>,
    crate::services::kpi_engine::ComputedKpiSet,
)> {
    let submission = state
        .submission_repo
        .find_by_id(sub_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    let cooperative = state
        .cooperative_repo
        .find_by_id(submission.cooperative_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Cooperative not found".into()))?;

    let fs = financial_statement::Entity::find()
        .filter(financial_statement::Column::SubmissionId.eq(sub_id))
        .one(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Financial statement not found for submission".into()))?;

    let line_items = balance_sheet_line_item::Entity::find()
        .filter(balance_sheet_line_item::Column::FinancialStatementId.eq(fs.id))
        .all(&state.db)
        .await?;

    let kpis = KpiEngine::compute(&line_items);
    Ok((submission, cooperative, line_items, kpis))
}

// Formatting helpers
fn format_currency(val: f64) -> String {
    if val >= 1e9 {
        format!("${:.2}B", val / 1e9)
    } else if val >= 1e6 {
        format!("${:.1}M", val / 1e6)
    } else if val >= 1e3 {
        format!("${:.0}K", val / 1e3)
    } else {
        format!("${:.0}", val)
    }
}

/// GET /api/v1/cooperative/submissions/{id}/export
/// GET /api/v1/apex/submissions/{id}/export
/// Exports a single cooperative submission in XLSX, CSV, DOCX, or PDF.
#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions/{id}/export",
    params(
        ("id" = Uuid, Path, description = "Submission ID"),
        ("format" = String, Query, description = "Export format (xlsx, csv, docx, pdf)")
    ),
    responses(
        (status = 200, description = "Export file stream"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Export"
)]
pub async fn export_single_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Query(query): Query<ExportQuery>,
) -> AppResult<impl IntoResponse> {
    let allowed_coops =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if !allowed_coops.contains(&submission.cooperative_id) {
        return Err(AppError::Forbidden(
            "Access denied to this cooperative's submission".into(),
        ));
    }

    match query.format.to_lowercase().as_str() {
        "xlsx" => {
            let filename = format!("submission_{}.xlsx", id);
            let storage_key = format!("exports/individual/{}/{}", id, filename);

            let bytes = match state.storage.get_object(&storage_key).await {
                Ok(b) => b,
                Err(_) => {
                    // Fallback to on-the-fly generation if the pre-baked file doesn't exist yet
                    let (submission, cooperative, line_items, kpis) = compile_export_data(&state, id).await?;
                    crate::services::export_generator::ExportGenerator::generate_excel_fallback(&submission, &cooperative, &line_items, &kpis)?
                }
            };

            let res = Response::builder()
                .header(
                    "Content-Type",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
                .header(
                    "Content-Disposition",
                    format!("attachment; filename=\"{}\"", filename),
                )
                .body(Body::from(bytes))
                .unwrap();
            Ok(res)
        }
        "csv" => {
            let filename = format!("submission_{}.csv", id);
            let storage_key = format!("exports/individual/{}/{}", id, filename);

            let bytes = match state.storage.get_object(&storage_key).await {
                Ok(b) => b,
                Err(_) => {
                    let (_submission, _cooperative, line_items, kpis) = compile_export_data(&state, id).await?;
                    let generated_bytes = {
                        let mut writer = csv::Writer::from_writer(vec![]);
                writer
                    .write_record([
                        "Record Type",
                        "Code / Name",
                        "Category",
                        "Value",
                        "Status / Confidence",
                    ])
                    .unwrap();

                // Write Balance Sheet
                for item in &line_items {
                    let code_str = item.account_code.map(|c| c.to_string()).unwrap_or_default();
                    let val_str = item
                        .value
                        .map(|v| v.to_string())
                        .unwrap_or_else(|| "0".into());
                    let conf_str = item
                        .ai_confidence
                        .map(|c| format!("{:.1}%", c))
                        .unwrap_or_else(|| "100%".into());
                    writer
                        .write_record([
                            "Balance Sheet Item",
                            &code_str,
                            &item.account_name,
                            &val_str,
                            &conf_str,
                        ])
                        .unwrap();
                }

                // Helper to write KPI row to CSV
                let mut write_csv_kpi = |cat: &str, name: &str, kpi: &KpiResult| {
                    writer
                        .write_record([
                            "KPI Metric",
                            name,
                            cat,
                            &kpi.formatted,
                            kpi.status.as_deref().unwrap_or(""),
                        ])
                        .unwrap();
                };

                // Write a subset of key KPIs
                let f = &kpis;
                write_csv_kpi("Financial Size", "Total Assets", &f.total_assets);
                write_csv_kpi(
                    "Financial Size",
                    "Gross Loan Portfolio",
                    &f.gross_loan_portfolio,
                );
                write_csv_kpi("Financial Size", "Total Equity", &f.total_equity);
                write_csv_kpi("Portfolio Quality", "PAR 30", &f.par30);
                write_csv_kpi("Profitability", "ROA", &f.roa);
                write_csv_kpi("Profitability", "ROE", &f.roe);
                write_csv_kpi(
                    "Liquidity & Solvency",
                    "Capital Adequacy Ratio",
                    &f.capital_adequacy_ratio,
                );

                    writer
                        .into_inner()
                        .map_err(|e| AppError::InternalServerError(e.to_string()))?
                };

                state
                    .storage
                    .store(&storage_key, &generated_bytes, "text/csv")
                    .await?;
                generated_bytes
            }
        };

            let res = Response::builder()
                .header("Content-Type", "text/csv")
                .header(
                    "Content-Disposition",
                    format!("attachment; filename=\"{}\"", filename),
                )
                .body(Body::from(bytes))
                .unwrap();
            Ok(res)
        }
        "docx" => {
            let filename = format!("submission_{}.docx", id);
            let storage_key = format!("exports/individual/{}/{}", id, filename);

            let bytes = match state.storage.get_object(&storage_key).await {
                Ok(b) => b,
                Err(_) => {
                    let (submission, cooperative, line_items, kpis) = compile_export_data(&state, id).await?;
                    let generated_bytes = {
                        let mut doc =
                        Docx::new()
                            .add_paragraph(
                                Paragraph::new().add_run(
                                    Run::new()
                                        .bold()
                                        .size(36)
                                        .add_text("COOPERATIVE PERFORMANCE REPORT"),
                                ),
                            )
                            .add_paragraph(
                                Paragraph::new().add_run(
                                    Run::new()
                                        .size(24)
                                        .add_text(format!("Cooperative: {}", cooperative.name)),
                                ),
                            )
                            .add_paragraph(Paragraph::new().add_run(Run::new().size(20).add_text(
                                format!("Reporting Period: {}", submission.reporting_year),
                            )))
                            .add_paragraph(Paragraph::new().add_run(Run::new().size(18).add_text(
                                format!("Generated on: {}", Utc::now().format("%Y-%m-%d")),
                            )))
                            .add_paragraph(Paragraph::new()); // blank line

                    // Balance Sheet Table
                    doc = doc.add_paragraph(
                        Paragraph::new().add_run(
                            Run::new()
                                .bold()
                                .size(28)
                                .add_text("1. Balance Sheet Line Items"),
                        ),
                    );
                    let mut bs_rows = vec![];
                    bs_rows.push(TableRow::new(vec![
                        TableCell::new().add_paragraph(
                            Paragraph::new().add_run(Run::new().bold().add_text("Account Code")),
                        ),
                        TableCell::new().add_paragraph(
                            Paragraph::new().add_run(Run::new().bold().add_text("Account Name")),
                        ),
                        TableCell::new().add_paragraph(
                            Paragraph::new().add_run(Run::new().bold().add_text("Category")),
                        ),
                        TableCell::new().add_paragraph(
                            Paragraph::new().add_run(Run::new().bold().add_text("Value (SZL)")),
                        ),
                    ]));

                    for item in &line_items {
                        let code_str = item.account_code.map(|c| c.to_string()).unwrap_or_default();
                        let val_str = item
                            .value
                            .map(|v| format_currency(v.to_f64().unwrap_or(0.0)))
                            .unwrap_or_else(|| "$0".to_string());
                        bs_rows.push(TableRow::new(vec![
                            TableCell::new().add_paragraph(
                                Paragraph::new().add_run(Run::new().add_text(code_str)),
                            ),
                            TableCell::new().add_paragraph(
                                Paragraph::new().add_run(Run::new().add_text(&item.account_name)),
                            ),
                            TableCell::new().add_paragraph(Paragraph::new().add_run(
                                Run::new().add_text(format!("{:?}", item.account_category)),
                            )),
                            TableCell::new().add_paragraph(
                                Paragraph::new().add_run(Run::new().add_text(val_str)),
                            ),
                        ]));
                    }
                    doc = doc
                        .add_table(Table::new(bs_rows))
                        .add_paragraph(Paragraph::new());

                    // KPIs Table
                    doc = doc.add_paragraph(
                        Paragraph::new().add_run(
                            Run::new()
                                .bold()
                                .size(28)
                                .add_text("2. Key Performance Indicators (KPIs)"),
                        ),
                    );
                    let mut kpi_rows = vec![];
                    kpi_rows.push(TableRow::new(vec![
                        TableCell::new().add_paragraph(
                            Paragraph::new().add_run(Run::new().bold().add_text("Category")),
                        ),
                        TableCell::new().add_paragraph(
                            Paragraph::new().add_run(Run::new().bold().add_text("KPI Name")),
                        ),
                        TableCell::new().add_paragraph(
                            Paragraph::new().add_run(Run::new().bold().add_text("Description")),
                        ),
                        TableCell::new().add_paragraph(
                            Paragraph::new().add_run(Run::new().bold().add_text("Value")),
                        ),
                        TableCell::new().add_paragraph(
                            Paragraph::new().add_run(Run::new().bold().add_text("Benchmark")),
                        ),
                        TableCell::new().add_paragraph(
                            Paragraph::new().add_run(Run::new().bold().add_text("Status")),
                        ),
                    ]));

                    let add_kpi_docx_row =
                        |rows: &mut Vec<TableRow>, cat: &str, name: &str, kpi: &KpiResult| {
                            let bench_str = kpi
                                .benchmark
                                .map(|b| format!("{:.1}", b))
                                .unwrap_or_default();
                            rows.push(TableRow::new(vec![
                                TableCell::new().add_paragraph(
                                    Paragraph::new().add_run(Run::new().add_text(cat.to_string())),
                                ),
                                TableCell::new().add_paragraph(
                                    Paragraph::new().add_run(Run::new().add_text(name.to_string())),
                                ),
                                TableCell::new().add_paragraph(
                                    Paragraph::new().add_run(Run::new().add_text(&kpi.description)),
                                ),
                                TableCell::new().add_paragraph(
                                    Paragraph::new().add_run(Run::new().add_text(&kpi.formatted)),
                                ),
                                TableCell::new().add_paragraph(
                                    Paragraph::new().add_run(Run::new().add_text(bench_str)),
                                ),
                                TableCell::new().add_paragraph(Paragraph::new().add_run(
                                    Run::new().add_text(kpi.status.as_deref().unwrap_or("")),
                                )),
                            ]));
                        };

                    let f = &kpis;
                    add_kpi_docx_row(&mut kpi_rows, "Size", "Total Assets", &f.total_assets);
                    add_kpi_docx_row(
                        &mut kpi_rows,
                        "Size",
                        "Gross Loan Portfolio",
                        &f.gross_loan_portfolio,
                    );
                    add_kpi_docx_row(
                        &mut kpi_rows,
                        "Size",
                        "Total Member Deposits",
                        &f.total_member_deposits,
                    );
                    add_kpi_docx_row(&mut kpi_rows, "Quality", "PAR 30", &f.par30);
                    add_kpi_docx_row(
                        &mut kpi_rows,
                        "Quality",
                        "Loan Loss Coverage",
                        &f.loan_loss_coverage,
                    );
                    add_kpi_docx_row(&mut kpi_rows, "Profitability", "ROA", &f.roa);
                    add_kpi_docx_row(&mut kpi_rows, "Profitability", "ROE", &f.roe);
                    add_kpi_docx_row(
                        &mut kpi_rows,
                        "Liquidity",
                        "Capital Adequacy Ratio",
                        &f.capital_adequacy_ratio,
                    );
                    add_kpi_docx_row(
                        &mut kpi_rows,
                        "Liquidity",
                        "Liquid Funds Ratio",
                        &f.liquid_funds_ratio,
                    );

                    doc = doc.add_table(Table::new(kpi_rows));

                    let mut buf = std::io::Cursor::new(Vec::new());
                    doc.build()
                        .pack(&mut buf)
                        .map_err(|e| AppError::InternalServerError(e.to_string()))?;
                    buf.into_inner()
                };

                state
                    .storage
                    .store(
                        &storage_key,
                        &generated_bytes,
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    )
                    .await?;
                generated_bytes
            }
        };

            let res = Response::builder()
                .header(
                    "Content-Type",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
                .header(
                    "Content-Disposition",
                    format!("attachment; filename=\"{}\"", filename),
                )
                .body(Body::from(bytes))
                .unwrap();
            Ok(res)
        }
        "pdf" => {
            let filename = format!("submission_{}.pdf", id);
            let storage_key = format!("exports/individual/{}/{}", id, filename);

            let bytes = match state.storage.get_object(&storage_key).await {
                Ok(b) => b,
                Err(_) => {
                    let (submission, cooperative, line_items, kpis) = compile_export_data(&state, id).await?;
                    let generated_bytes = {
                        let mut writer = PdfWriter::new("Cooperative Report");

                // Header block
                writer.write_line(&cooperative.name.to_uppercase(), 18.0, true);
                writer.write_line("CoopData Performance & Compliance Report", 11.0, false);
                writer.write_line(
                    &format!("Reporting Period: {}", submission.reporting_year),
                    11.0,
                    false,
                );
                writer.write_line(
                    &format!("Generated on: {}", Utc::now().format("%Y-%m-%d")),
                    10.0,
                    false,
                );
                writer.draw_divider();

                // Balance Sheet Items Section
                writer.write_line("1. Key Balance Sheet Items", 14.0, true);
                writer.current_y -= 2.0;

                // Draw table columns header
                writer.check_page_break(10.0);
                writer.write_text("Code", 20.0, 10.0, true);
                writer.write_text("Account Name", 45.0, 10.0, true);
                writer.write_text("Category", 120.0, 10.0, true);
                writer.write_text("Value", 160.0, 10.0, true);
                writer.current_y -= 6.0;

                for item in &line_items {
                    // Filter down to display key items or only those with non-zero values to avoid extremely long PDFs
                    if item.value.map(|v| v.is_zero()).unwrap_or(true) {
                        continue;
                    }
                    writer.check_page_break(8.0);
                    let code_str = item
                        .account_code
                        .map(|c| c.to_string())
                        .unwrap_or_else(|| "N/A".into());
                    let val_str = item
                        .value
                        .map(|v| format_currency(v.to_f64().unwrap_or(0.0)))
                        .unwrap_or_else(|| "$0".to_string());

                    writer.write_text(&code_str, 20.0, 9.0, false);

                    let truncated_name = if item.account_name.len() > 30 {
                        format!("{}...", &item.account_name[..27])
                    } else {
                        item.account_name.clone()
                    };
                    writer.write_text(&truncated_name, 45.0, 9.0, false);
                    writer.write_text(&format!("{:?}", item.account_category), 120.0, 9.0, false);
                    writer.write_text(&val_str, 160.0, 9.0, false);

                    writer.current_y -= 5.5;
                }

                writer.draw_divider();

                // KPIs Section
                writer.write_line("2. Compliance & Operational KPIs", 14.0, true);
                writer.current_y -= 2.0;

                // Columns headers
                writer.check_page_break(10.0);
                writer.write_text("KPI Name", 20.0, 10.0, true);
                writer.write_text("Value", 100.0, 10.0, true);
                writer.write_text("Benchmark", 130.0, 10.0, true);
                writer.write_text("Status", 160.0, 10.0, true);
                writer.current_y -= 6.0;

                let add_pdf_kpi_row = |w: &mut PdfWriter, name: &str, kpi: &KpiResult| {
                    w.check_page_break(8.0);
                    let bench_str = kpi
                        .benchmark
                        .map(|b| format!("{:.1}", b))
                        .unwrap_or_else(|| "N/A".into());
                    w.write_text(name, 20.0, 9.0, false);
                    w.write_text(&kpi.formatted, 100.0, 9.0, false);
                    w.write_text(&bench_str, 130.0, 9.0, false);
                    w.write_text(kpi.status.as_deref().unwrap_or("N/A"), 160.0, 9.0, true);
                    w.current_y -= 5.5;
                };

                let f = &kpis;
                add_pdf_kpi_row(
                    &mut writer,
                    "Capital Adequacy Ratio",
                    &f.capital_adequacy_ratio,
                );
                add_pdf_kpi_row(&mut writer, "PAR 30", &f.par30);
                add_pdf_kpi_row(&mut writer, "PAR 90", &f.par90);
                add_pdf_kpi_row(&mut writer, "Loan Loss Coverage", &f.loan_loss_coverage);
                add_pdf_kpi_row(&mut writer, "ROA", &f.roa);
                add_pdf_kpi_row(&mut writer, "ROE", &f.roe);
                add_pdf_kpi_row(&mut writer, "Liquid Funds Ratio", &f.liquid_funds_ratio);
                add_pdf_kpi_row(
                    &mut writer,
                    "Operational Self-Sufficiency",
                    &f.operational_self_sufficiency,
                );

                let mut buf = std::io::BufWriter::new(Vec::new());
                writer
                    .doc
                    .save(&mut buf)
                    .map_err(|e| AppError::InternalServerError(e.to_string()))?;
                buf.into_inner()
                    .map_err(|e| AppError::InternalServerError(e.to_string()))?
            };

            state
                .storage
                .store(&storage_key, &generated_bytes, "application/pdf")
                .await?;
            generated_bytes
            }
        };

            let res = Response::builder()
                .header("Content-Type", "application/pdf")
                .header(
                    "Content-Disposition",
                    format!("attachment; filename=\"{}\"", filename),
                )
                .body(Body::from(bytes))
                .unwrap();
            Ok(res)
        }
        _ => Err(AppError::BadRequest("Unsupported export format".into())),
    }
}

/// GET /api/v1/apex/export
/// GET /api/v1/federation/export
/// GET /api/v1/ministry/export
/// Exports a consolidated multi-sheet Excel file of all cooperatives within the user's scope.
#[utoipa::path(
    get,
    path = "/api/v1/apex/export",
    responses(
        (status = 200, description = "Consolidated Excel workbook file stream"),
        (status = 403, description = "Forbidden")
    ),
    tag = "Export"
)]
pub async fn export_bulk_consolidated(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(query): Query<ExportQuery>,
) -> AppResult<impl IntoResponse> {
    let mut allowed_coops =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    if allowed_coops.is_empty() {
        return Err(AppError::Forbidden(
            "No cooperatives in your scope to export".into(),
        ));
    }

    if let Some(apex_id) = query.apex_id {
        let coops = state.cooperative_repo.find_by_apex_id(apex_id).await?;
        let coop_ids: Vec<Uuid> = coops.into_iter().map(|c| c.id).collect();
        allowed_coops.retain(|id| coop_ids.contains(id));
    } else if let Some(fed_id) = query.federation_id {
        let apexes = state.apex_repo.find_by_federation_id(fed_id).await?;
        let mut coop_ids = vec![];
        for apex in apexes {
            let coops = state.cooperative_repo.find_by_apex_id(apex.id).await?;
            coop_ids.extend(coops.into_iter().map(|c| c.id));
        }
        allowed_coops.retain(|id| coop_ids.contains(id));
    }

    if allowed_coops.is_empty() {
        return Err(AppError::Forbidden(
            "No cooperatives matching the selected hierarchical filter".into(),
        ));
    }

    // Phase C/F: Apex bucket check — serve any pre-baked format
    if let (Some(apex_id), Some(year)) = (query.apex_id, query.reporting_year) {
        let fmt = query.format.to_lowercase();
        let (filename, content_type) = match fmt.as_str() {
            "xlsx" => (format!("apex_{}_{}.xlsx", apex_id, year), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            "docx" => (format!("apex_{}_{}.docx", apex_id, year), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            "pdf"  => (format!("apex_{}_{}.pdf", apex_id, year),  "application/pdf"),
            _ => ("".to_string(), ""),
        };
        if !filename.is_empty() {
            let storage_key = format!("exports/apex/{}/{}", apex_id, filename);
            if let Ok(bytes) = state.storage.get_object(&storage_key).await {
                tracing::info!(apex_id = %apex_id, reporting_year = year, format = %fmt, "Bucket HIT for Apex export");
                let res = Response::builder()
                    .header("Content-Type", content_type)
                    .header("Content-Disposition", format!("attachment; filename=\"{}\"", filename))
                    .body(Body::from(bytes))
                    .unwrap();
                return Ok(res);
            }
            tracing::info!(apex_id = %apex_id, reporting_year = year, format = %fmt, "Bucket MISS for Apex export, falling back to live generation");
        }
    } else if let (Some(fed_id), Some(year)) = (query.federation_id, query.reporting_year) {
        // Phase D/F: Federation bucket check — serve any pre-baked format
        let fmt = query.format.to_lowercase();
        let (filename, content_type) = match fmt.as_str() {
            "xlsx" => (format!("federation_{}_{}.xlsx", fed_id, year), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            "docx" => (format!("federation_{}_{}.docx", fed_id, year), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            "pdf"  => (format!("federation_{}_{}.pdf", fed_id, year),  "application/pdf"),
            _ => ("".to_string(), ""),
        };
        if !filename.is_empty() {
            let storage_key = format!("exports/federation/{}/{}", fed_id, filename);
            if let Ok(bytes) = state.storage.get_object(&storage_key).await {
                tracing::info!(federation_id = %fed_id, reporting_year = year, format = %fmt, "Bucket HIT for Federation export");
                let res = Response::builder()
                    .header("Content-Type", content_type)
                    .header("Content-Disposition", format!("attachment; filename=\"{}\"", filename))
                    .body(Body::from(bytes))
                    .unwrap();
                return Ok(res);
            }
            tracing::info!(federation_id = %fed_id, reporting_year = year, format = %fmt, "Bucket MISS for Federation export, falling back to live generation");
        }
    } else if query.apex_id.is_none() && query.federation_id.is_none() {
        if let Some(year) = query.reporting_year {
            // Phase E/F: Ministry bucket check — serve any pre-baked format
            let fmt = query.format.to_lowercase();
            let (filename, content_type) = match fmt.as_str() {
                "xlsx" => (format!("ministry_{}.xlsx", year), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
                "docx" => (format!("ministry_{}.docx", year), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
                "pdf"  => (format!("ministry_{}.pdf", year),  "application/pdf"),
                _ => ("".to_string(), ""),
            };
            if !filename.is_empty() {
                let storage_key = format!("exports/ministry/{}", filename);
                if let Ok(bytes) = state.storage.get_object(&storage_key).await {
                    tracing::info!(reporting_year = year, format = %fmt, "Bucket HIT for Ministry export");
                    let res = Response::builder()
                        .header("Content-Type", content_type)
                        .header("Content-Disposition", format!("attachment; filename=\"{}\"", filename))
                        .body(Body::from(bytes))
                        .unwrap();
                    return Ok(res);
                }
                tracing::info!(reporting_year = year, format = %fmt, "Bucket MISS for Ministry export, falling back to live generation");
            }
        }
    }

    // Compile all cooperative data once; shared by all format arms
    let mut compiled_data = vec![];
    for coop_id in &allowed_coops {
        let submissions = state.submission_repo.find_by_cooperative(*coop_id).await?;
        if let Some(sub) = submissions.first() {
            if let Ok(data) = compile_export_data(&state, sub.id).await {
                compiled_data.push(data);
            }
        }
    }

    let timestamp = chrono::Utc::now().timestamp();
    let format_str = query.format.to_lowercase();

    match format_str.as_str() {
        "xlsx" => {
            let bytes = {
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

                // 1. SHEET: Summary Dashboard
                let summary_sheet = workbook.add_worksheet().set_name("Summary Dashboard")?;
                summary_sheet.write(0, 0, "Consolidated Reporting Dashboard")?;
                summary_sheet.write(
                    1,
                    0,
                    format!("Exported on: {}", Utc::now().format("%Y-%m-%d")),
                )?;

                let total_assets: f64 = compiled_data
                    .iter()
                    .map(|(_, _, _, r)| r.total_assets.value)
                    .sum();
                let total_loans: f64 = compiled_data
                    .iter()
                    .map(|(_, _, _, r)| r.gross_loan_portfolio.value)
                    .sum();
                let total_deposits: f64 = compiled_data
                    .iter()
                    .map(|(_, _, _, r)| r.total_member_deposits.value)
                    .sum();
                let total_members: f64 = 0.0; // membership count not available in financial KPIs

                summary_sheet.write_with_format(3, 0, "Metric", &header_format)?;
                summary_sheet.write_with_format(3, 1, "Consolidated Total", &header_format)?;
                summary_sheet.write(4, 0, "Total Consolidated Assets")?;
                summary_sheet.write(4, 1, total_assets)?;
                summary_sheet.write(5, 0, "Total Consolidated Loans")?;
                summary_sheet.write(5, 1, total_loans)?;
                summary_sheet.write(6, 0, "Total Member Deposits")?;
                summary_sheet.write(6, 1, total_deposits)?;
                summary_sheet.write(7, 0, "Total Members")?;
                summary_sheet.write(7, 1, total_members)?;

                summary_sheet.write(9, 0, "Member Cooperatives Performance Directory")?;
                let tbl_headers = [
                    "Cooperative Name",
                    "Reporting Year",
                    "Status",
                    "Assets",
                    "Gross Portfolio",
                    "Deposits",
                    "Members",
                ];
                for (c, h) in tbl_headers.iter().enumerate() {
                    summary_sheet.write_with_format(10, c as u16, *h, &header_format)?;
                }

                for (row_idx, (sub, coop, _, report)) in (11..).zip(compiled_data.iter()) {
                    summary_sheet.write(row_idx, 0, &coop.name)?;
                    summary_sheet.write(row_idx, 1, sub.reporting_year)?;
                    summary_sheet.write(row_idx, 2, format!("{:?}", sub.status))?;
                    summary_sheet.write(row_idx, 3, report.total_assets.value)?;
                    summary_sheet.write(row_idx, 4, report.gross_loan_portfolio.value)?;
                    summary_sheet.write(row_idx, 5, report.total_member_deposits.value)?;
                    summary_sheet.write(row_idx, 6, 0_f64)?; // membership count not in financial KPIs
                }

                // 2. SHEET: KPI Aggregates
                let kpi_agg_sheet = workbook.add_worksheet().set_name("KPI Aggregates")?;
                kpi_agg_sheet.write_with_format(0, 0, "Metric Name", &header_format)?;
                kpi_agg_sheet.write_with_format(
                    0,
                    1,
                    "Average / Mean Value Across Scope",
                    &header_format,
                )?;

                let add_agg_row = |sheet: &mut rust_xlsxwriter::Worksheet,
                                   name: &str,
                                   values: &[f64],
                                   is_percent: bool,
                                   row: &mut u32|
                 -> Result<(), rust_xlsxwriter::XlsxError> {
                    let mean = if !values.is_empty() {
                        values.iter().sum::<f64>() / values.len() as f64
                    } else {
                        0.0
                    };
                    sheet.write(*row, 0, name)?;
                    if is_percent {
                        sheet.write(*row, 1, format!("{:.1}%", mean))?;
                    } else {
                        sheet.write(*row, 1, mean)?;
                    }
                    *row += 1;
                    Ok(())
                };

                let mut r_idx = 1;
                let cars: Vec<f64> = compiled_data
                    .iter()
                    .map(|(_, _, _, r)| r.capital_adequacy_ratio.value)
                    .collect();
                let par30s: Vec<f64> = compiled_data
                    .iter()
                    .map(|(_, _, _, r)| r.par30.value)
                    .collect();
                let roas: Vec<f64> = compiled_data
                    .iter()
                    .map(|(_, _, _, r)| r.roa.value)
                    .collect();
                let roes: Vec<f64> = compiled_data
                    .iter()
                    .map(|(_, _, _, r)| r.roe.value)
                    .collect();

                add_agg_row(
                    kpi_agg_sheet,
                    "Average Capital Adequacy Ratio",
                    &cars,
                    true,
                    &mut r_idx,
                )?;
                add_agg_row(
                    kpi_agg_sheet,
                    "Average PAR 30 Ratio",
                    &par30s,
                    true,
                    &mut r_idx,
                )?;
                add_agg_row(kpi_agg_sheet, "Average ROA", &roas, true, &mut r_idx)?;
                add_agg_row(kpi_agg_sheet, "Average ROE", &roes, true, &mut r_idx)?;

                // 3. Per-cooperative sheets
                for (sub, coop, _, report) in &compiled_data {
                    let sheet_name = if coop.name.len() > 30 {
                        &coop.name[..30]
                    } else {
                        &coop.name
                    };
                    let coop_sheet = workbook.add_worksheet().set_name(sheet_name)?;

                    coop_sheet.write(0, 0, format!("Cooperative: {}", coop.name))?;
                    coop_sheet.write(1, 0, format!("Reporting Period: {}", sub.reporting_year))?;

                    let kpi_headers = [
                        "Category",
                        "KPI Name",
                        "Description",
                        "Value",
                        "Benchmark",
                        "Status",
                    ];
                    for (c, h) in kpi_headers.iter().enumerate() {
                        coop_sheet.write_with_format(3, c as u16, *h, &header_format)?;
                    }

                    let mut row = 4;
                    let mut write_row =
                        |cat: &str,
                         name: &str,
                         kpi: &KpiResult|
                         -> Result<(), rust_xlsxwriter::XlsxError> {
                            coop_sheet.write(row, 0, cat)?;
                            coop_sheet.write(row, 1, name)?;
                            coop_sheet.write(row, 2, &kpi.description)?;
                            coop_sheet.write(row, 3, &kpi.formatted)?;
                            if let Some(bench) = kpi.benchmark {
                                coop_sheet.write(row, 4, bench)?;
                            }
                            if let Some(ref status) = kpi.status {
                                let fmt = match status.as_str() {
                                    "green" => &green_format,
                                    "amber" => &amber_format,
                                    "red" => &red_format,
                                    _ => &Format::new(),
                                };
                                coop_sheet.write_with_format(row, 5, status.as_str(), fmt)?;
                            }
                            row += 1;
                            Ok(())
                        };

                    let f = report;
                    write_row("Financial Size", "Total Assets", &f.total_assets)?;
                    write_row(
                        "Financial Size",
                        "Gross Loan Portfolio",
                        &f.gross_loan_portfolio,
                    )?;
                    write_row("Financial Size", "Total Equity", &f.total_equity)?;
                    write_row("Portfolio Quality", "PAR 30", &f.par30)?;
                    write_row("Profitability", "ROA", &f.roa)?;
                    write_row("Profitability", "ROE", &f.roe)?;
                    write_row(
                        "Liquidity & Solvency",
                        "Capital Adequacy Ratio",
                        &f.capital_adequacy_ratio,
                    )?;
                }

                workbook
                    .save_to_buffer()
                    .map_err(|e| AppError::InternalServerError(e.to_string()))?
            };
            let filename = format!("consolidated_report_{}.xlsx", timestamp);
            let storage_key = format!("exports/consolidated/{}", filename);
            state
                .storage
                .store(
                    &storage_key,
                    &bytes,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
                .await?;
            let res = Response::builder()
                .header(
                    "Content-Type",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
                .header(
                    "Content-Disposition",
                    format!("attachment; filename=\"{}\"", filename),
                )
                .body(Body::from(bytes))
                .unwrap();
            Ok(res)
        }
        "csv" => {
            let bytes = {
                let mut wtr = csv::Writer::from_writer(vec![]);
                wtr.write_record([
                    "Cooperative Name",
                    "Reporting Year",
                    "Status",
                    "Assets",
                    "Gross Portfolio",
                    "Deposits",
                    "Members",
                ])
                .unwrap();
                for (sub, coop, _, report) in &compiled_data {
                    wtr.write_record(&[
                        coop.name.clone(),
                        sub.reporting_year.to_string(),
                        format!("{:?}", sub.status),
                        report.total_assets.value.to_string(),
                        report.gross_loan_portfolio.value.to_string(),
                        report.total_member_deposits.value.to_string(),
                        "0".to_string(),
                    ])
                    .unwrap();
                }
                wtr.into_inner().unwrap()
            };
            let filename = format!("consolidated_report_{}.csv", timestamp);
            let storage_key = format!("exports/consolidated/{}", filename);
            state
                .storage
                .store(&storage_key, &bytes, "text/csv")
                .await?;
            let res = Response::builder()
                .header("Content-Type", "text/csv")
                .header(
                    "Content-Disposition",
                    format!("attachment; filename=\"{}\"", filename),
                )
                .body(Body::from(bytes))
                .unwrap();
            Ok(res)
        }
        "docx" => {
            let bytes = {
                let mut docx = Docx::new();
                docx = docx.add_paragraph(
                    Paragraph::new()
                        .add_run(Run::new().add_text("Consolidated Report Dashboard").bold()),
                );
                docx = docx.add_paragraph(Paragraph::new().add_run(
                    Run::new().add_text(format!("Exported on: {}", Utc::now().format("%Y-%m-%d"))),
                ));

                let mut table = Table::new(vec![]);
                table = table.add_row(TableRow::new(vec![
                    TableCell::new().add_paragraph(
                        Paragraph::new().add_run(Run::new().add_text("Cooperative Name").bold()),
                    ),
                    TableCell::new().add_paragraph(
                        Paragraph::new().add_run(Run::new().add_text("Year").bold()),
                    ),
                    TableCell::new().add_paragraph(
                        Paragraph::new().add_run(Run::new().add_text("Status").bold()),
                    ),
                    TableCell::new().add_paragraph(
                        Paragraph::new().add_run(Run::new().add_text("Assets").bold()),
                    ),
                ]));

                for (sub, coop, _, report) in &compiled_data {
                    table =
                        table.add_row(TableRow::new(vec![
                            TableCell::new().add_paragraph(
                                Paragraph::new().add_run(Run::new().add_text(&coop.name)),
                            ),
                            TableCell::new().add_paragraph(
                                Paragraph::new()
                                    .add_run(Run::new().add_text(sub.reporting_year.to_string())),
                            ),
                            TableCell::new().add_paragraph(
                                Paragraph::new()
                                    .add_run(Run::new().add_text(format!("{:?}", sub.status))),
                            ),
                            TableCell::new().add_paragraph(Paragraph::new().add_run(
                                Run::new().add_text(report.total_assets.value.to_string()),
                            )),
                        ]));
                }
                docx = docx.add_table(table);

                let mut buf = std::io::Cursor::new(Vec::new());
                docx.build()
                    .pack(&mut buf)
                    .map_err(|e| AppError::InternalServerError(e.to_string()))?;
                buf.into_inner()
            };
            let filename = format!("consolidated_report_{}.docx", timestamp);
            let storage_key = format!("exports/consolidated/{}", filename);
            state
                .storage
                .store(
                    &storage_key,
                    &bytes,
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
                .await?;
            let res = Response::builder()
                .header(
                    "Content-Type",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
                .header(
                    "Content-Disposition",
                    format!("attachment; filename=\"{}\"", filename),
                )
                .body(Body::from(bytes))
                .unwrap();
            Ok(res)
        }
        "pdf" => {
            let bytes = {
                let mut writer = PdfWriter::new("Consolidated Report");
                writer.write_line("Consolidated Reporting Dashboard", 16.0, true);
                writer.current_y -= 10.0;
                writer.write_line(
                    &format!("Exported on: {}", Utc::now().format("%Y-%m-%d")),
                    12.0,
                    false,
                );
                writer.current_y -= 15.0;

                let total_assets: f64 = compiled_data
                    .iter()
                    .map(|(_, _, _, r)| r.total_assets.value)
                    .sum();
                let total_loans: f64 = compiled_data
                    .iter()
                    .map(|(_, _, _, r)| r.gross_loan_portfolio.value)
                    .sum();
                let total_deposits: f64 = compiled_data
                    .iter()
                    .map(|(_, _, _, r)| r.total_member_deposits.value)
                    .sum();
                let total_members: f64 = 0.0;

                writer.write_line(
                    &format!("Total Consolidated Assets: {:.2}", total_assets),
                    12.0,
                    false,
                );
                writer.current_y -= 8.0;
                writer.write_line(
                    &format!("Total Consolidated Loans: {:.2}", total_loans),
                    12.0,
                    false,
                );
                writer.current_y -= 8.0;
                writer.write_line(
                    &format!("Total Member Deposits: {:.2}", total_deposits),
                    12.0,
                    false,
                );
                writer.current_y -= 8.0;
                writer.write_line(&format!("Total Members: {:.2}", total_members), 12.0, false);
                writer.current_y -= 15.0;

                writer.write_line("Member Cooperatives Directory", 14.0, true);
                writer.current_y -= 10.0;

                for (sub, coop, _, report) in &compiled_data {
                    writer.check_page_break(20.0);
                    let txt = format!(
                        "{} | Year: {} | Assets: {:.2} | Loans: {:.2}",
                        coop.name,
                        sub.reporting_year,
                        report.total_assets.value,
                        report.gross_loan_portfolio.value
                    );
                    writer.write_line(&txt, 10.0, false);
                    writer.current_y -= 6.0;
                }

                writer
                    .doc
                    .save_to_bytes()
                    .map_err(|e| AppError::InternalServerError(e.to_string()))?
            };
            let filename = format!("consolidated_report_{}.pdf", timestamp);
            let storage_key = format!("exports/consolidated/{}", filename);
            state
                .storage
                .store(&storage_key, &bytes, "application/pdf")
                .await?;
            let res = Response::builder()
                .header("Content-Type", "application/pdf")
                .header(
                    "Content-Disposition",
                    format!("attachment; filename=\"{}\"", filename),
                )
                .body(Body::from(bytes))
                .unwrap();
            Ok(res)
        }
        _ => Err(AppError::BadRequest("Unsupported export format".into())),
    }
}
