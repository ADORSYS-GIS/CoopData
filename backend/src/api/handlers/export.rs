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
                    let generated_bytes = crate::services::export_generator::ExportGenerator::generate_excel_fallback(&submission, &cooperative, &line_items, &kpis)?;
                    state
                        .storage
                        .store(&storage_key, &generated_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                        .await?;
                    generated_bytes
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

    if compiled_data.is_empty() {
        return Err(AppError::NotFound(
            "No submission data available to export for the selected scope and year.".into(),
        ));
    }

    // Phase G: Live-generation fallback — delegate to the shared generator functions.
    // This path is only hit when the bucket has no pre-baked file (e.g. first run before approval cascade).
    let fmt = query.format.to_lowercase();
    let timestamp = chrono::Utc::now().timestamp();

    let (bytes, content_type, filename) = match fmt.as_str() {
        "xlsx" => {
            // Build a quick consolidated XLSX from the compiled data using the apex generator
            // if we can identify the apex, or fall back to the generic summary workbook.
            let bytes = {
                use rust_xlsxwriter::{Color, Format, Workbook};
                let mut workbook = Workbook::new();
                let header_format = Format::new()
                    .set_bold()
                    .set_background_color(Color::RGB(0x1F4E78))
                    .set_font_color(Color::White);

                let sheet = workbook.add_worksheet().set_name("Consolidated Summary")?;
                sheet.write_with_format(0, 0, "Cooperative", &header_format)?;
                sheet.write_with_format(0, 1, "Year", &header_format)?;
                sheet.write_with_format(0, 2, "Status", &header_format)?;
                sheet.write_with_format(0, 3, "Total Assets", &header_format)?;
                sheet.write_with_format(0, 4, "Gross Portfolio", &header_format)?;
                sheet.write_with_format(0, 5, "CAR", &header_format)?;
                sheet.write_with_format(0, 6, "PAR30", &header_format)?;

                for (row, (sub, coop, _items, kpis)) in (1..).zip(compiled_data.iter()) {
                    sheet.write(row, 0, &coop.name)?;
                    sheet.write(row, 1, sub.reporting_year)?;
                    sheet.write(row, 2, format!("{:?}", sub.status))?;
                    sheet.write(row, 3, kpis.total_assets.value)?;
                    sheet.write(row, 4, kpis.gross_loan_portfolio.value)?;
                    sheet.write(row, 5, &kpis.capital_adequacy_ratio.formatted)?;
                    sheet.write(row, 6, &kpis.par30.formatted)?;
                }

                workbook.save_to_buffer()
                    .map_err(|e| AppError::InternalServerError(e.to_string()))?
            };
            let filename = format!("consolidated_{}.xlsx", timestamp);
            let content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            (bytes, content_type, filename)
        }
        "csv" => {
            let bytes = {
                let mut wtr = csv::Writer::from_writer(vec![]);
                wtr.write_record(["Cooperative", "Year", "Status", "Total Assets", "Gross Portfolio", "PAR30"]).unwrap();
                for (sub, coop, _items, kpis) in &compiled_data {
                    wtr.write_record(&[
                        coop.name.clone(),
                        sub.reporting_year.to_string(),
                        format!("{:?}", sub.status),
                        kpis.total_assets.value.to_string(),
                        kpis.gross_loan_portfolio.value.to_string(),
                        kpis.par30.formatted.clone(),
                    ]).unwrap();
                }
                wtr.into_inner().unwrap()
            };
            let filename = format!("consolidated_{}.csv", timestamp);
            (bytes, "text/csv", filename)
        }
        "docx" => {
            use docx_rs::{Docx, Paragraph, Run, Table, TableCell, TableRow};
            let mut rows = vec![TableRow::new(vec![
                TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().bold().add_text("Cooperative"))),
                TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().bold().add_text("Year"))),
                TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().bold().add_text("Assets"))),
                TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().bold().add_text("PAR30"))),
            ])];
            for (sub, coop, _items, kpis) in &compiled_data {
                rows.push(TableRow::new(vec![
                    TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text(&coop.name))),
                    TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text(sub.reporting_year.to_string()))),
                    TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text(kpis.total_assets.value.to_string()))),
                    TableCell::new().add_paragraph(Paragraph::new().add_run(Run::new().add_text(&kpis.par30.formatted))),
                ]));
            }
            let docx = Docx::new()
                .add_paragraph(Paragraph::new().add_run(Run::new().bold().size(32).add_text("Consolidated Report")))
                .add_paragraph(Paragraph::new().add_run(Run::new().size(18).add_text(format!("Generated: {}", chrono::Utc::now().format("%Y-%m-%d")))))
                .add_paragraph(Paragraph::new())
                .add_table(Table::new(rows));
            let mut buf = std::io::Cursor::new(Vec::new());
            docx.build()
                .pack(&mut buf)
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;
            let filename = format!("consolidated_{}.docx", timestamp);
            (buf.into_inner(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", filename)
        }
        "pdf" => {
            let mut writer = PdfWriter::new("Consolidated Report");
            writer.write_line("Consolidated Reporting Dashboard", 16.0, true);
            writer.current_y -= 8.0;
            writer.write_line(&format!("Generated: {}", chrono::Utc::now().format("%Y-%m-%d")), 11.0, false);
            writer.current_y -= 8.0;
            writer.draw_divider();
            for (sub, coop, _items, kpis) in &compiled_data {
                writer.check_page_break(14.0);
                writer.write_line(&format!("{} | Year: {} | Assets: {} | PAR30: {}",
                    coop.name, sub.reporting_year,
                    kpis.total_assets.formatted, kpis.par30.formatted,
                ), 9.0, false);
                writer.current_y -= 4.0;
            }
            let bytes = writer.doc.save_to_bytes()
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;
            let filename = format!("consolidated_{}.pdf", timestamp);
            (bytes, "application/pdf", filename)
        }
        _ => return Err(AppError::BadRequest("Unsupported export format".into())),
    };

    let res = Response::builder()
        .header("Content-Type", content_type)
        .header("Content-Disposition", format!("attachment; filename=\"{}\"", filename))
        .body(Body::from(bytes))
        .unwrap();
    Ok(res)
}


