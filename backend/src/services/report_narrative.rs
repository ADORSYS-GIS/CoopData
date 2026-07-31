use crate::config::AppConfig;
use crate::error::{AppError, AppResult};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

// ── Output types (design doc §5.2) ────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CooperativeNarratives {
    pub executive_summary: String,
    pub financial_position: String,
    pub portfolio_quality: String,
    pub non_financial: String,
    pub benchmark_comparison: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ApexNarratives {
    pub executive_dashboard: String,
    pub risk_distribution: String,
    pub risk_watch: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FederationNarratives {
    pub executive_dashboard: String,
    pub risk_distribution: String,
    pub sector_breakdown: String,
    pub apex_comparison: String,
    pub pearls_analysis: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MinistryNarratives {
    pub executive_dashboard: String,
    pub risk_distribution: String,
    pub sector_breakdown: String,
    pub apex_comparison: String,
    pub pearls_analysis: String,
}

// ── Input context types (design doc §5.1) ─────────────────────────────────

#[derive(Debug, Clone)]
pub struct CooperativeNarrativeContext {
    pub coop_name: String,
    pub region: String,
    pub sector: String,
    pub institution_type: String,
    pub reg_no: String,
    pub reporting_year: i32,
    pub kpis: Vec<KpiSnapshot>,
    pub prior_kpis: Vec<KpiSnapshot>,
    pub total_assets: f64,
    pub total_equity: f64,
    pub total_deposits: f64,
    pub gross_loans: f64,
    pub net_surplus: f64,
    pub assets_yoy: String,
    pub equity_yoy: String,
    pub deposits_yoy: String,
    pub loans_yoy: String,
    pub sector_avg_par30: Option<f64>,
    pub national_avg_par30: Option<f64>,
    pub sector_avg_car: Option<f64>,
    pub line_items: Option<Vec<BalanceSheetLineItemData>>,
    pub membership_stats: Option<MembershipStats>,
    pub savings_stats: Option<SavingsStats>,
    pub loan_stats: Option<LoanStats>,
}

#[derive(Debug, Clone)]
pub struct ApexNarrativeContext {
    pub apex_name: String,
    pub reporting_year: i32,
    pub total_coops: u64,
    pub coops_with_data: u64,
    pub cooperatives: Vec<CoopKpiRowData>,
    pub distributions: HashMap<String, TrafficLightData>,
    pub nf_summary: NfSummaryData,
}

#[derive(Debug, Clone)]
pub struct FederationNarrativeContext {
    pub federation_name: String,
    pub reporting_year: i32,
    pub total_coops: u64,
    pub coops_with_data: u64,
    pub apexes: Vec<ApexNarrativeContext>,
    pub distributions: HashMap<String, TrafficLightData>,
    pub nf_summary: NfSummaryData,
}

#[derive(Debug, Clone)]
pub struct MinistryNarrativeContext {
    pub reporting_year: i32,
    pub total_coops: u64,
    pub coops_with_data: u64,
    pub distributions: HashMap<String, TrafficLightData>,
    pub cooperatives: Vec<CoopKpiRowData>,
    pub nf_summary: NfSummaryData,
}

#[derive(Debug, Clone)]
pub struct KpiSnapshot {
    pub name: String,
    pub value: f64,
    pub formatted: String,
    pub unit: String,
    pub status: Option<String>,
    pub benchmark: Option<f64>,
}

#[derive(Debug, Clone)]
pub struct BalanceSheetLineItemData {
    pub account_code: Option<i32>,
    pub account_name: String,
    pub current_value: f64,
    pub prior_value: Option<f64>,
}

#[derive(Debug, Clone)]
pub struct MembershipStats {
    pub total_members: u64,
    pub active_members: u64,
    pub dormant_members: u64,
    pub women_members: u64,
    pub youth_members: u64,
    pub rural_members: u64,
    pub agm_participation_pct: f64,
    pub leadership_count: u64,
    pub voting_participation_pct: f64,
}

#[derive(Debug, Clone)]
pub struct SavingsStats {
    pub total_savings_accounts: u64,
    pub active_savers: u64,
    pub savings_penetration_pct: f64,
    pub avg_savings_balance: f64,
}

#[derive(Debug, Clone)]
pub struct LoanStats {
    pub active_borrowers: u64,
    pub women_borrowers: u64,
    pub youth_borrowers: u64,
    pub rural_borrowers: u64,
    pub on_time_repayment_pct: f64,
}

#[derive(Debug, Clone)]
pub struct CoopKpiRowData {
    pub name: String,
    pub sector: Option<String>,
    pub region: Option<String>,
    pub kpis: HashMap<String, f64>,
    pub nf: NfCoopData,
}

#[derive(Debug, Clone, Default)]
pub struct NfCoopData {
    pub total_members: u64,
    pub active_members_pct: f64,
    pub savings_penetration_pct: f64,
    pub credit_penetration_pct: f64,
    pub on_time_repayment_pct: f64,
    pub dormancy_pct: f64,
    pub agm_participation_pct: f64,
    pub women_pct: f64,
    pub youth_pct: f64,
    pub rural_pct: f64,
}

#[derive(Debug, Clone)]
pub struct TrafficLightData {
    pub green_pct: f64,
    pub amber_pct: f64,
    pub red_pct: f64,
    pub no_data_pct: f64,
    pub green_count: u64,
    pub amber_count: u64,
    pub red_count: u64,
    pub national_avg: Option<f64>,
}

#[derive(Debug, Clone, Default)]
pub struct NfSummaryData {
    pub cooperatives_with_data: u64,
    pub avg_active_members_pct: f64,
    pub avg_savings_penetration_pct: f64,
    pub avg_credit_penetration_pct: f64,
    pub avg_on_time_repayment_pct: f64,
    pub avg_dormancy_pct: f64,
    pub avg_agm_participation_pct: f64,
    pub avg_women_pct: f64,
    pub avg_youth_pct: f64,
    pub avg_rural_pct: f64,
}

// ── Trait (design doc §5.2) ────────────────────────────────────────────────

#[async_trait]
pub trait ReportNarrativeGenerator: Send + Sync {
    async fn generate_cooperative_narratives(
        &self,
        ctx: &CooperativeNarrativeContext,
    ) -> AppResult<CooperativeNarratives>;

    async fn generate_apex_narratives(
        &self,
        ctx: &ApexNarrativeContext,
    ) -> AppResult<ApexNarratives>;

    async fn generate_federation_narratives(
        &self,
        ctx: &FederationNarrativeContext,
    ) -> AppResult<FederationNarratives>;

    async fn generate_ministry_narratives(
        &self,
        ctx: &MinistryNarrativeContext,
    ) -> AppResult<MinistryNarratives>;
}

// ── LLM implementation ─────────────────────────────────────────────────────

pub struct LlmNarrativeGenerator {
    client: reqwest::Client,
    api_key: String,
    provider_url: String,
    model: String,
    max_tokens: u32,
}

impl LlmNarrativeGenerator {
    pub fn new(config: &AppConfig) -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .connect_timeout(std::time::Duration::from_secs(10))
                .build()
                .expect("Failed to build narrative HTTP client"),
            api_key: config.ai_api_key.clone(),
            provider_url: config.ai_provider_url.trim_end_matches('/').to_string(),
            model: config.ai_model.clone(),
            max_tokens: config.ai_max_tokens,
        }
    }

    async fn chat(&self, prompt: &str) -> AppResult<String> {
        let url = format!("{}/chat/completions", self.provider_url);
        let body = serde_json::json!({
            "model": self.model,
            "messages": [{ "role": "user", "content": prompt }],
            "temperature": 0,
            "max_tokens": self.max_tokens
        });

        const MAX_RETRIES: u32 = 6;
        const BASE_DELAY_MS: u64 = 15_000; // 15 seconds base

        for attempt in 1..=MAX_RETRIES {
            let res = self
                .client
                .post(&url)
                .bearer_auth(&self.api_key)
                .json(&body)
                .send()
                .await;

            let res = match res {
                Ok(r) => r,
                Err(e) => {
                    // Connection error — retry with backoff
                    if attempt < MAX_RETRIES {
                        let delay_ms = BASE_DELAY_MS * 2u64.pow(attempt - 1);
                        tracing::warn!(
                            attempt,
                            max_retries = MAX_RETRIES,
                            delay_ms,
                            error = %e,
                            "[narrative] ⏳ Connection error, retrying in {}ms",
                            delay_ms
                        );
                        tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
                        continue;
                    }
                    return Err(AppError::ExternalServiceError(format!(
                        "Narrative LLM request failed after {MAX_RETRIES} retries: {e}"
                    )));
                }
            };

            if res.status().as_u16() == 429 {
                let text = res.text().await.unwrap_or_default();
                
                // Parse the retry delay from the response body.
                // Gemini always includes "Please retry in Xs" or "retryDelay": "Xs" even on quota errors.
                // If a retry delay is present, the rate limit is TEMPORARY — wait and retry.
                // Only fail immediately if there's NO retry hint (truly permanent quota exhaustion).
                let delay_ms = if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                    // Gemini format: { "error": { "retryDelay": "46s", ... } }
                    let retry_delay = json["error"]["retryDelay"]
                        .as_str()
                        .or_else(|| json["retryDelay"].as_str());
                    
                    if let Some(delay_str) = retry_delay {
                        let secs: u64 = delay_str.trim_end_matches('s').parse().unwrap_or(0);
                        if secs > 0 { secs * 1000 } else { BASE_DELAY_MS * 2u64.pow(attempt - 1) }
                    } else {
                        // Fallback: check "Please retry in 46.926118825s" in message
                        let msg = json["error"]["message"].as_str().unwrap_or("");
                        if let Some(pos) = msg.find("Please retry in ") {
                            let num_str = &msg[pos + 16..];
                            if let Some(end) = num_str.find('s') {
                                let secs: u64 = num_str[..end].parse().unwrap_or(0);
                                if secs > 0 { secs * 1000 } else { BASE_DELAY_MS * 2u64.pow(attempt - 1) }
                            } else {
                                BASE_DELAY_MS * 2u64.pow(attempt - 1)
                            }
                        } else {
                            // No retry hint at all — this is a permanent quota exhaustion (e.g. daily limit hit, no billing)
                            tracing::error!(
                                attempt,
                                "[narrative] 💳 Quota exhausted with no retry hint — failing immediately."
                            );
                            return Err(AppError::ExternalServiceError(format!(
                                "Narrative LLM quota exhausted (no retry delay): {text}"
                            )));
                        }
                    }
                } else {
                    // Not JSON — no retry hint possible, fail
                    return Err(AppError::ExternalServiceError(format!(
                        "Narrative LLM quota/rate error (non-JSON): {text}"
                    )));
                };

                // We have a retry delay — use it. Gemini tells us exactly when the quota resets.
                if attempt < MAX_RETRIES {
                    tracing::warn!(
                        attempt,
                        max_retries = MAX_RETRIES,
                        delay_ms,
                        "[narrative] ⏳ Rate/quota limited (429), waiting {}s as Gemini requested (attempt {}/{})",
                        delay_ms / 1000,
                        attempt,
                        MAX_RETRIES
                    );
                    tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
                    continue;
                } else {
                    tracing::error!(
                        attempt,
                        "[narrative] ❌ Rate limited after {} retries: {}",
                        MAX_RETRIES,
                        text
                    );
                    return Err(AppError::ExternalServiceError(format!(
                        "Narrative LLM rate limited after {MAX_RETRIES} retries: {text}"
                    )));
                }
            }

            if !res.status().is_success() {
                let status = res.status();
                let text = res.text().await.unwrap_or_default();
                tracing::error!(status = %status, response = %text, "[narrative] ❌ LLM API error");
                return Err(AppError::ExternalServiceError(format!(
                    "Narrative LLM API error {status}: {text}"
                )));
            }

            let json: serde_json::Value = res
                .json()
                .await
                .map_err(|e| AppError::ExternalServiceError(format!("Narrative LLM parse error: {e}")))?;

            let content = json["choices"][0]["message"]["content"]
                .as_str()
                .ok_or_else(|| AppError::ExternalServiceError("Empty narrative LLM response".into()))?;

            return Ok(content.to_string());
        }

        Err(AppError::ExternalServiceError("Narrative LLM: max retries exhausted".into()))
    }

    fn parse_json<T: serde::de::DeserializeOwned>(raw: &str) -> AppResult<T> {
        let cleaned = raw
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();

        serde_json::from_str(cleaned).map_err(|e| {
            tracing::error!(error = %e, raw = %cleaned, "Failed to parse narrative JSON");
            AppError::ExternalServiceError(format!("Failed to parse narrative JSON: {e}"))
        })
    }

    #[allow(dead_code)]
    fn fallback_cooperative(ctx: &CooperativeNarrativeContext) -> CooperativeNarratives {
        CooperativeNarratives {
            executive_summary: format!(
                "{} reported its financial performance for {}.", ctx.coop_name, ctx.reporting_year
            ),
            financial_position: String::new(),
            portfolio_quality: String::new(),
            non_financial: String::new(),
            benchmark_comparison: String::new(),
        }
    }

    #[allow(dead_code)]
    fn fallback_apex(ctx: &ApexNarrativeContext) -> ApexNarratives {
        ApexNarratives {
            executive_dashboard: format!(
                "{} oversees {} cooperatives for {}.",
                ctx.apex_name, ctx.total_coops, ctx.reporting_year
            ),
            risk_distribution: String::new(),
            risk_watch: String::new(),
        }
    }

    #[allow(dead_code)]
    fn fallback_federation(ctx: &FederationNarrativeContext) -> FederationNarratives {
        FederationNarratives {
            executive_dashboard: format!(
                "{} oversees {} cooperatives for {}.",
                ctx.federation_name, ctx.total_coops, ctx.reporting_year
            ),
            risk_distribution: String::new(),
            sector_breakdown: String::new(),
            apex_comparison: String::new(),
            pearls_analysis: String::new(),
        }
    }

    #[allow(dead_code)]
    fn fallback_ministry(_ctx: &MinistryNarrativeContext) -> MinistryNarratives {
        MinistryNarratives {
            executive_dashboard: String::new(),
            risk_distribution: String::new(),
            sector_breakdown: String::new(),
            apex_comparison: String::new(),
            pearls_analysis: String::new(),
        }
    }
}

#[async_trait]
impl ReportNarrativeGenerator for LlmNarrativeGenerator {
    async fn generate_cooperative_narratives(
        &self,
        ctx: &CooperativeNarrativeContext,
    ) -> AppResult<CooperativeNarratives> {
        let exec_prompt = build_coop_executive_summary_prompt(ctx);
        let fin_prompt = build_coop_financial_position_prompt(ctx);
        let portfolio_prompt = build_coop_portfolio_quality_prompt(ctx);
        let nf_prompt = build_coop_non_financial_prompt(ctx);
        let bench_prompt = build_coop_benchmark_comparison_prompt(ctx);

        tracing::info!("[narrative] 🚀 Starting 5 concurrent LLM calls for cooperative narratives");
        tracing::info!(chars = exec_prompt.len(), "[narrative] 📡 Prompt 1/5: executive_summary | chars={}", exec_prompt.len());
        tracing::info!(chars = fin_prompt.len(), "[narrative] 📡 Prompt 2/5: financial_position | chars={}", fin_prompt.len());
        tracing::info!(chars = portfolio_prompt.len(), "[narrative] 📡 Prompt 3/5: portfolio_quality | chars={}", portfolio_prompt.len());
        tracing::info!(chars = nf_prompt.len(), "[narrative] 📡 Prompt 4/5: non_financial | chars={}", nf_prompt.len());
        tracing::info!(chars = bench_prompt.len(), "[narrative] 📡 Prompt 5/5: benchmark_comparison | chars={}", bench_prompt.len());

        let start = std::time::Instant::now();
        let (exec_result, fin_result, portfolio_result, nf_result, bench_result) = tokio::try_join!(
            self.chat(&exec_prompt),
            self.chat(&fin_prompt),
            self.chat(&portfolio_prompt),
            self.chat(&nf_prompt),
            self.chat(&bench_prompt),
        )?;
        
        tracing::info!(
            elapsed_ms = start.elapsed().as_millis(),
            "[narrative] ✅ All 5 LLM responses received in {}ms",
            start.elapsed().as_millis()
        );
        
        tracing::info!("[narrative] 🔍 Parsing JSON responses...");
        let result = Ok(CooperativeNarratives {
            executive_summary: Self::parse_json::<ExecutiveSummaryOutput>(&exec_result)?
                .executive_summary,
            financial_position: Self::parse_json::<FinancialPositionOutput>(&fin_result)?
                .financial_position,
            portfolio_quality: Self::parse_json::<PortfolioQualityOutput>(&portfolio_result)?
                .portfolio_quality,
            non_financial: Self::parse_json::<NonFinancialOutput>(&nf_result)?
                .non_financial,
            benchmark_comparison: Self::parse_json::<BenchmarkOutput>(&bench_result)?
                .benchmark_comparison,
        });
        
        tracing::info!("[narrative] ✅ All 5 narratives parsed successfully");
        result
    }

    async fn generate_apex_narratives(
        &self,
        ctx: &ApexNarrativeContext,
    ) -> AppResult<ApexNarratives> {
        let exec_prompt = build_apex_executive_dashboard_prompt(ctx);
        let risk_dist_prompt = build_apex_risk_distribution_prompt(ctx);
        let risk_watch_prompt = build_apex_risk_watch_prompt(ctx);
        
        tracing::info!("[narrative] 🚀 Starting 3 concurrent LLM calls for apex narratives");
        tracing::info!(chars = exec_prompt.len(), "[narrative] 📡 Prompt 1/3: executive_dashboard | chars={}", exec_prompt.len());
        tracing::info!(chars = risk_dist_prompt.len(), "[narrative] 📡 Prompt 2/3: risk_distribution | chars={}", risk_dist_prompt.len());
        tracing::info!(chars = risk_watch_prompt.len(), "[narrative] 📡 Prompt 3/3: risk_watch | chars={}", risk_watch_prompt.len());
        
        let start = std::time::Instant::now();
        let (exec_result, risk_dist_result, risk_watch_result) = tokio::try_join!(
            self.chat(&exec_prompt),
            self.chat(&risk_dist_prompt),
            self.chat(&risk_watch_prompt),
        )?;
        
        tracing::info!(
            elapsed_ms = start.elapsed().as_millis(),
            "[narrative] ✅ All 3 LLM responses received in {}ms",
            start.elapsed().as_millis()
        );
        
        tracing::info!("[narrative] 🔍 Parsing JSON responses...");
        let result = Ok(ApexNarratives {
            executive_dashboard: Self::parse_json::<ExecutiveDashboardOutput>(&exec_result)?
                .executive_dashboard,
            risk_distribution: Self::parse_json::<RiskDistributionOutput>(&risk_dist_result)?
                .risk_distribution,
            risk_watch: Self::parse_json::<RiskWatchOutput>(&risk_watch_result)?
                .risk_watch,
        });
        
        tracing::info!("[narrative] ✅ All 3 narratives parsed successfully");
        result
    }

    async fn generate_federation_narratives(
        &self,
        ctx: &FederationNarrativeContext,
    ) -> AppResult<FederationNarratives> {
        let exec_prompt = build_fed_executive_dashboard_prompt(ctx);
        let risk_dist_prompt = build_fed_risk_distribution_prompt(ctx);
        let sector_prompt = build_fed_sector_breakdown_prompt(ctx);
        let apex_cmp_prompt = build_fed_apex_comparison_prompt(ctx);
        let pearls_prompt = build_fed_pearls_analysis_prompt(ctx);
        
        tracing::info!("[narrative] 🚀 Starting 5 concurrent LLM calls for federation narratives");
        tracing::info!(chars = exec_prompt.len(), "[narrative] 📡 Prompt 1/5: executive_dashboard | chars={}", exec_prompt.len());
        tracing::info!(chars = risk_dist_prompt.len(), "[narrative] 📡 Prompt 2/5: risk_distribution | chars={}", risk_dist_prompt.len());
        tracing::info!(chars = sector_prompt.len(), "[narrative] 📡 Prompt 3/5: sector_breakdown | chars={}", sector_prompt.len());
        tracing::info!(chars = apex_cmp_prompt.len(), "[narrative] 📡 Prompt 4/5: apex_comparison | chars={}", apex_cmp_prompt.len());
        tracing::info!(chars = pearls_prompt.len(), "[narrative] 📡 Prompt 5/5: pearls_analysis | chars={}", pearls_prompt.len());
        
        let start = std::time::Instant::now();
        let (exec_result, risk_dist_result, sector_result, apex_cmp_result, pearls_result) = tokio::try_join!(
            self.chat(&exec_prompt),
            self.chat(&risk_dist_prompt),
            self.chat(&sector_prompt),
            self.chat(&apex_cmp_prompt),
            self.chat(&pearls_prompt),
        )?;
        
        tracing::info!(
            elapsed_ms = start.elapsed().as_millis(),
            "[narrative] ✅ All 5 LLM responses received in {}ms",
            start.elapsed().as_millis()
        );
        
        tracing::info!("[narrative] 🔍 Parsing JSON responses...");
        let result = Ok(FederationNarratives {
            executive_dashboard: Self::parse_json::<ExecutiveDashboardOutput>(&exec_result)?
                .executive_dashboard,
            risk_distribution: Self::parse_json::<RiskDistributionOutput>(&risk_dist_result)?
                .risk_distribution,
            sector_breakdown: Self::parse_json::<SectorBreakdownOutput>(&sector_result)?
                .sector_breakdown,
            apex_comparison: Self::parse_json::<ApexComparisonOutput>(&apex_cmp_result)?
                .apex_comparison,
            pearls_analysis: Self::parse_json::<PearlsAnalysisOutput>(&pearls_result)?
                .pearls_analysis,
        });
        
        tracing::info!("[narrative] ✅ All 5 narratives parsed successfully");
        result
    }

    async fn generate_ministry_narratives(
        &self,
        ctx: &MinistryNarrativeContext,
    ) -> AppResult<MinistryNarratives> {
        let exec_prompt = build_ministry_executive_dashboard_prompt(ctx);
        let risk_dist_prompt = build_ministry_risk_distribution_prompt(ctx);
        let sector_prompt = build_ministry_sector_breakdown_prompt(ctx);
        let apex_cmp_prompt = build_ministry_apex_comparison_prompt(ctx);
        let pearls_prompt = build_ministry_pearls_analysis_prompt(ctx);
        
        tracing::info!("[narrative] 🚀 Starting 5 concurrent LLM calls for ministry narratives");
        tracing::info!(chars = exec_prompt.len(), "[narrative] 📡 Prompt 1/5: executive_dashboard | chars={}", exec_prompt.len());
        tracing::info!(chars = risk_dist_prompt.len(), "[narrative] 📡 Prompt 2/5: risk_distribution | chars={}", risk_dist_prompt.len());
        tracing::info!(chars = sector_prompt.len(), "[narrative] 📡 Prompt 3/5: sector_breakdown | chars={}", sector_prompt.len());
        tracing::info!(chars = apex_cmp_prompt.len(), "[narrative] 📡 Prompt 4/5: apex_comparison | chars={}", apex_cmp_prompt.len());
        tracing::info!(chars = pearls_prompt.len(), "[narrative] 📡 Prompt 5/5: pearls_analysis | chars={}", pearls_prompt.len());
        
        let start = std::time::Instant::now();
        let (exec_result, risk_dist_result, sector_result, apex_cmp_result, pearls_result) = tokio::try_join!(
            self.chat(&exec_prompt),
            self.chat(&risk_dist_prompt),
            self.chat(&sector_prompt),
            self.chat(&apex_cmp_prompt),
            self.chat(&pearls_prompt),
        )?;

        tracing::info!(
            elapsed_ms = start.elapsed().as_millis(),
            "[narrative] ✅ All 5 LLM responses received in {}ms",
            start.elapsed().as_millis()
        );
        
        tracing::info!("[narrative] 🔍 Parsing JSON responses...");
        let result = Ok(MinistryNarratives {
            executive_dashboard: Self::parse_json::<ExecutiveDashboardOutput>(&exec_result)?
                .executive_dashboard,
            risk_distribution: Self::parse_json::<RiskDistributionOutput>(&risk_dist_result)?
                .risk_distribution,
            sector_breakdown: Self::parse_json::<SectorBreakdownOutput>(&sector_result)?
                .sector_breakdown,
            apex_comparison: Self::parse_json::<ApexComparisonOutput>(&apex_cmp_result)?
                .apex_comparison,
            pearls_analysis: Self::parse_json::<PearlsAnalysisOutput>(&pearls_result)?
                .pearls_analysis,
        });
        
        tracing::info!("[narrative] ✅ All 5 narratives parsed successfully");
        result
    }
}

// ── Per-prompt JSON output types ────────────────────────────────────────────

#[derive(Deserialize)]
struct ExecutiveSummaryOutput {
    executive_summary: String,
}

#[derive(Deserialize)]
struct FinancialPositionOutput {
    financial_position: String,
}

#[derive(Deserialize)]
struct PortfolioQualityOutput {
    portfolio_quality: String,
}

#[derive(Deserialize)]
struct NonFinancialOutput {
    non_financial: String,
}

#[derive(Deserialize)]
struct BenchmarkOutput {
    benchmark_comparison: String,
}

#[derive(Deserialize)]
struct ExecutiveDashboardOutput {
    executive_dashboard: String,
}

#[derive(Deserialize)]
struct RiskDistributionOutput {
    risk_distribution: String,
}

#[derive(Deserialize)]
struct RiskWatchOutput {
    risk_watch: String,
}

#[derive(Deserialize)]
struct SectorBreakdownOutput {
    sector_breakdown: String,
}

#[derive(Deserialize)]
struct ApexComparisonOutput {
    apex_comparison: String,
}

#[derive(Deserialize)]
struct PearlsAnalysisOutput {
    pearls_analysis: String,
}

// ── Mock implementation ─────────────────────────────────────────────────────

pub struct MockNarrativeGenerator;

#[async_trait]
impl ReportNarrativeGenerator for MockNarrativeGenerator {
    async fn generate_cooperative_narratives(
        &self,
        ctx: &CooperativeNarrativeContext,
    ) -> AppResult<CooperativeNarratives> {
        Ok(CooperativeNarratives {
            executive_summary: format!(
                "[MOCK] {} cooperative performance review for {}.",
                ctx.coop_name, ctx.reporting_year
            ),
            financial_position: "[MOCK] Financial position analysis placeholder.".into(),
            portfolio_quality: "[MOCK] Portfolio quality assessment placeholder.".into(),
            non_financial: "[MOCK] Non-financial metrics placeholder.".into(),
            benchmark_comparison: "[MOCK] Benchmark comparison placeholder.".into(),
        })
    }

    async fn generate_apex_narratives(
        &self,
        ctx: &ApexNarrativeContext,
    ) -> AppResult<ApexNarratives> {
        Ok(ApexNarratives {
            executive_dashboard: format!(
                "[MOCK] {} oversees {} cooperatives for {}.",
                ctx.apex_name, ctx.total_coops, ctx.reporting_year
            ),
            risk_distribution: "[MOCK] Risk distribution analysis placeholder.".into(),
            risk_watch: "[MOCK] Risk watch placeholder.".into(),
        })
    }

    async fn generate_federation_narratives(
        &self,
        ctx: &FederationNarrativeContext,
    ) -> AppResult<FederationNarratives> {
        Ok(FederationNarratives {
            executive_dashboard: format!(
                "[MOCK] {} oversees {} cooperatives for {}.",
                ctx.federation_name, ctx.total_coops, ctx.reporting_year
            ),
            risk_distribution: "[MOCK] Risk distribution analysis placeholder.".into(),
            sector_breakdown: "[MOCK] Sector breakdown placeholder.".into(),
            apex_comparison: "[MOCK] Apex comparison placeholder.".into(),
            pearls_analysis: "[MOCK] PEARLS analysis placeholder.".into(),
        })
    }

    async fn generate_ministry_narratives(
        &self,
        ctx: &MinistryNarrativeContext,
    ) -> AppResult<MinistryNarratives> {
        Ok(MinistryNarratives {
            executive_dashboard: format!(
                "[MOCK] National cooperative sector overview for {}.",
                ctx.reporting_year
            ),
            risk_distribution: "[MOCK] Risk distribution analysis placeholder.".into(),
            sector_breakdown: "[MOCK] Sector breakdown placeholder.".into(),
            apex_comparison: "[MOCK] Apex comparison placeholder.".into(),
            pearls_analysis: "[MOCK] PEARLS analysis placeholder.".into(),
        })
    }
}

// ── Factory ─────────────────────────────────────────────────────────────────

pub fn create_narrative_generator(config: &AppConfig) -> Arc<dyn ReportNarrativeGenerator> {
    if config.extraction_backend == "llm" && !config.ai_api_key.is_empty() {
        tracing::info!(
            "Narrative generator: LLM backend (model: {})",
            config.ai_model
        );
        Arc::new(LlmNarrativeGenerator::new(config))
    } else {
        tracing::warn!("Narrative generator: MOCK backend (no AI narratives will be generated)");
        Arc::new(MockNarrativeGenerator)
    }
}

// ── Formatting helpers ──────────────────────────────────────────────────────

fn fmt_kpi_table(kpis: &[KpiSnapshot]) -> String {
    let mut table = String::from("| KPI | Value | Formatted | Unit | Status | Benchmark |\n|-----|-------|-----------|------|--------|-----------|\n");
    for kpi in kpis {
        let status = kpi.status.as_deref().unwrap_or("-");
        let benchmark = kpi
            .benchmark
            .map(|b| format!("{b:.1}%"))
            .unwrap_or_default();
        table.push_str(&format!(
            "| {} | {:.2} | {} | {} | {} | {} |\n",
            kpi.name, kpi.value, kpi.formatted, kpi.unit, status, benchmark
        ));
    }
    table
}

fn fmt_prior_kpi_table(kpis: &[KpiSnapshot]) -> String {
    let mut table = String::from("| KPI | Value | Formatted | Status |\n|-----|-------|-----------|--------|\n");
    for kpi in kpis {
        let status = kpi.status.as_deref().unwrap_or("-");
        table.push_str(&format!(
            "| {} | {:.2} | {} | {} |\n",
            kpi.name, kpi.value, kpi.formatted, status
        ));
    }
    table
}

fn fmt_distributions(dists: &HashMap<String, TrafficLightData>) -> String {
    let mut table = String::from("| KPI | Green % | Amber % | Red % | No Data % | National Avg |\n|-----|---------|---------|-------|-----------|-------------|\n");
    for (name, d) in dists {
        let avg = d
            .national_avg
            .map(|a| format!("{a:.1}%"))
            .unwrap_or_default();
        table.push_str(&format!(
            "| {} | {:.0}% (n={}) | {:.0}% (n={}) | {:.0}% (n={}) | {:.0}% (n={}) | {} |\n",
            name,
            d.green_pct, d.green_count,
            d.amber_pct, d.amber_count,
            d.red_pct, d.red_count,
            d.no_data_pct, 0u64,
            avg
        ));
    }
    table
}

fn fmt_line_items_table(items: &[BalanceSheetLineItemData]) -> String {
    let mut table = String::from("| Account Code | Account Name | Current Year | Prior Year |\n|-------------|-------------|-------------|------------|\n");
    for item in items {
        let code = item.account_code.map(|c| c.to_string()).unwrap_or_default();
        let prior = item
            .prior_value
            .map(|v| format!("E {v:.0}"))
            .unwrap_or_else(|| "N/A".into());
        table.push_str(&format!(
            "| {} | {} | E {:.0} | {} |\n",
            code, item.account_name, item.current_value, prior
        ));
    }
    table
}

fn fmt_sector_distribution(coops: &[CoopKpiRowData]) -> String {
    use std::collections::HashMap as StdHashMap;
    let mut by_sector: StdHashMap<String, Vec<&CoopKpiRowData>> = StdHashMap::new();
    for c in coops {
        let sector = c.sector.as_deref().unwrap_or("Unknown").to_string();
        by_sector.entry(sector).or_default().push(c);
    }
    let mut table = String::from("| Sector | Count | Avg PAR30 | Avg ROA | Avg CAR |\n|--------|-------|-----------|---------|--------|\n");
    for (sector, list) in &by_sector {
        let n = list.len() as f64;
        let avg_par30 = list.iter().map(|c| c.kpis.get("par30").copied().unwrap_or(0.0)).sum::<f64>() / n;
        let avg_roa = list.iter().map(|c| c.kpis.get("roa").copied().unwrap_or(0.0)).sum::<f64>() / n;
        let avg_car = list.iter().map(|c| c.kpis.get("capital_adequacy_ratio").copied().unwrap_or(0.0)).sum::<f64>() / n;
        table.push_str(&format!(
            "| {} | {} | {:.1}% | {:.1}% | {:.1}% |\n",
            sector, list.len(), avg_par30, avg_roa, avg_car
        ));
    }
    table
}

fn fmt_pearls_compliance(coops: &[CoopKpiRowData]) -> String {
    let pearls_kpis = ["par30", "par90", "roa", "roe", "capital_adequacy_ratio", "liquid_funds_ratio", "operational_self_sufficiency", "operating_expense_ratio", "loan_loss_coverage"];
    let benchmarks: std::collections::HashMap<&str, f64> = [
        ("par30", 5.0), ("par90", 2.0), ("roa", 3.0), ("roe", 8.0),
        ("capital_adequacy_ratio", 10.0), ("liquid_funds_ratio", 15.0),
        ("operational_self_sufficiency", 110.0), ("operating_expense_ratio", 5.0),
        ("loan_loss_coverage", 100.0),
    ].into();

    let mut table = String::from("| KPI | Benchmark | Meeting | Exceeding | Below | Compliance % |\n|-----|-----------|---------|-----------|-------|-------------|\n");
    for kpi_name in &pearls_kpis {
        let bench = benchmarks.get(kpi_name).copied().unwrap_or(0.0);
        let total = coops.len() as f64;
        let mut meeting = 0u64;
        let mut exceeding = 0u64;
        let mut below = 0u64;
        for c in coops {
            if let Some(val) = c.kpis.get(*kpi_name) {
                match *kpi_name {
                    "par30" | "par90" | "operating_expense_ratio" => {
                        if *val <= bench { meeting += 1; } else { exceeding += 1; }
                    }
                    _ => {
                        if *val >= bench { meeting += 1; } else { below += 1; }
                    }
                }
            }
        }
        let compliance = if total > 0.0 { meeting as f64 / total * 100.0 } else { 0.0 };
        table.push_str(&format!(
            "| {} | {:.1}% | {} | {} | {} | {:.0}% |\n",
            kpi_name, bench, meeting, exceeding, below, compliance
        ));
    }
    table
}

fn fmt_high_risk_table(coops: &[CoopKpiRowData]) -> String {
    let high_risk: Vec<_> = coops
        .iter()
        .filter(|c| {
            let red_count = ["par30", "par90", "roa", "roe", "capital_adequacy_ratio", "liquid_funds_ratio", "operational_self_sufficiency"]
                .iter()
                .filter(|kpi| {
                    let val = c.kpis.get(**kpi).copied().unwrap_or(0.0);
                    match **kpi {
                        "par30" | "par90" => val > 10.0,
                        "roa" | "roe" | "capital_adequacy_ratio" | "liquid_funds_ratio" | "operational_self_sufficiency" => val < 1.0,
                        _ => false,
                    }
                })
                .count();
            red_count >= 3
        })
        .collect();

    if high_risk.is_empty() {
        return "No high-risk cooperatives identified.".into();
    }

    let mut table = String::from("| Cooperative | Red KPIs | PAR30 | ROA | CAR |\n|------------|---------|-------|-----|-----|\n");
    for c in &high_risk {
        let red_count = ["par30", "par90", "roa", "roe", "capital_adequacy_ratio", "liquid_funds_ratio", "operational_self_sufficiency"]
            .iter()
            .filter(|kpi| {
                let val = c.kpis.get(**kpi).copied().unwrap_or(0.0);
                match **kpi {
                    "par30" | "par90" => val > 10.0,
                    "roa" | "roe" | "capital_adequacy_ratio" | "liquid_funds_ratio" | "operational_self_sufficiency" => val < 1.0,
                    _ => false,
                }
            })
            .count();
        let par30 = c.kpis.get("par30").map(|v| format!("{v:.1}%")).unwrap_or_default();
        let roa = c.kpis.get("roa").map(|v| format!("{v:.1}%")).unwrap_or_default();
        let car = c.kpis.get("capital_adequacy_ratio").map(|v| format!("{v:.1}%")).unwrap_or_default();
        table.push_str(&format!("| {} | {} | {} | {} | {} |\n", c.name, red_count, par30, roa, car));
    }
    table
}

const KPI_THRESHOLDS: &str = "KPI STATUS THRESHOLDS:
- par30: green <= 5%, amber <= 10%, red > 10% (lower is better)
- par90: green <= 2%, amber <= 5%, red > 5% (lower is better)
- roa: green >= 3%, amber >= 1%, red < 1% (higher is better)
- roe: green >= 8%, amber >= 4%, red < 4% (higher is better)
- capital_adequacy_ratio: green >= 10%, amber >= 8%, red < 8% (higher is better)
- liquid_funds_ratio: green >= 15%, amber >= 10%, red < 10% (higher is better)
- operational_self_sufficiency: green >= 110%, amber >= 100%, red < 100% (higher is better)
- operating_expense_ratio: green <= 5%, amber <= 8%, red > 8% (lower is better)
- loan_loss_coverage: green >= 100%, amber >= 80%, red < 80% (higher is better)";

const RULES_SUFFIX: &str = "RULES:
- Use specific numbers from the data
- Reference benchmarks when relevant
- Be professional but actionable — this report is reviewed by apex, federation, and ministry officials
- Do NOT invent data not provided in the tables
- Do NOT use markdown formatting — write plain text only
- Maximum 150 words per paragraph
- Write in third person (\"The cooperative\" not \"Your cooperative\")";

// ── Prompt builders (design doc §6.1–6.10) ────────────────────────────────

fn build_coop_executive_summary_prompt(ctx: &CooperativeNarrativeContext) -> String {
    let kpi_table = fmt_kpi_table(&ctx.kpis);
    let prior_table = if ctx.prior_kpis.is_empty() {
        String::from("(no prior year data)")
    } else {
        fmt_prior_kpi_table(&ctx.prior_kpis)
    };
    let sector_avg_par30 = ctx.sector_avg_par30.map(|v| format!("{v:.1}%")).unwrap_or_else(|| "N/A".into());
    let national_avg_par30 = ctx.national_avg_par30.map(|v| format!("{v:.1}%")).unwrap_or_else(|| "N/A".into());
    let sector_avg_car = ctx.sector_avg_car.map(|v| format!("{v:.1}%")).unwrap_or_else(|| "N/A".into());

    format!(
        r#"You are a senior financial analyst specializing in SACCO (Savings and Credit Cooperative) oversight in Eswatini. Your task is to generate a professional executive summary narrative for a cooperative's performance report.

COOPERATIVE METADATA:
- Name: {coop_name}
- Region: {region}
- Sector: {sector}
- Institution Type: {institution_type}
- Registration Number: {reg_no}
- Reporting Year: {reporting_year}

CURRENT YEAR KPIs:
{current_kpi_table}

PRIOR YEAR KPIs (if available):
{prior_kpi_table}

{thresholds}

SECTOR BENCHMARKS:
- Sector Average PAR30: {sector_avg_par30}
- National Average PAR30: {national_avg_par30}
- Sector Average CAR: {sector_avg_car}

TASK:
Generate exactly THREE paragraphs:

1. EXECUTIVE SUMMARY (2-3 sentences):
   Overall financial health assessment. Reference the cooperative's size (total assets), profitability (ROA/ROE), and key status indicators. Compare to sector benchmarks where relevant.

2. KEY STRENGTHS (2-3 bullet points as a single paragraph):
   Identify 2-3 areas where the cooperative performs well. Reference specific KPI values and their green/amber/red status. Highlight improvements from prior year if available.

3. RISKS AND VULNERABILITIES (2-3 bullet points as a single paragraph):
   Identify 2-3 areas of concern. Reference specific KPI values that are amber or red. Highlight deteriorating trends from prior year if available.

{rules}

Return ONLY a minified JSON object with this exact structure:
{{"executive_summary":"..."}}
No markdown fences, no explanation, no extra keys."#,
        coop_name = ctx.coop_name,
        region = ctx.region,
        sector = ctx.sector,
        institution_type = ctx.institution_type,
        reg_no = ctx.reg_no,
        reporting_year = ctx.reporting_year,
        current_kpi_table = kpi_table,
        prior_kpi_table = prior_table,
        thresholds = KPI_THRESHOLDS,
        sector_avg_par30 = sector_avg_par30,
        national_avg_par30 = national_avg_par30,
        sector_avg_car = sector_avg_car,
        rules = RULES_SUFFIX,
    )
}

fn build_coop_financial_position_prompt(ctx: &CooperativeNarrativeContext) -> String {
    let line_items_table = ctx.line_items.as_ref().map(|items| fmt_line_items_table(items)).unwrap_or_else(|| "(no balance sheet data available)".into());

    format!(
        r#"You are a senior financial analyst specializing in SACCO oversight in Eswatini. Your task is to generate a narrative analysis of a cooperative's financial position based on its balance sheet and income statement data.

COOPERATIVE METADATA:
- Name: {coop_name}
- Sector: {sector}
- Reporting Year: {reporting_year}

BALANCE SHEET LINE ITEMS (Current Year):
{line_items_table}

KEY FINANCIAL KPIs:
- Total Assets: E {total_assets} (YoY: {assets_yoy})
- Total Equity: E {total_equity} (YoY: {equity_yoy})
- Total Member Deposits: E {total_deposits} (YoY: {deposits_yoy})
- Gross Loan Portfolio: E {gross_loans} (YoY: {loans_yoy})
- Net Surplus: E {net_surplus}

TASK:
Generate exactly TWO paragraphs:

1. FINANCIAL POSITION ANALYSIS (3-4 sentences):
   Analyze the balance sheet composition. Discuss asset growth/decline, funding structure (deposits vs equity vs borrowings), and loan portfolio size. Reference year-over-year changes.

2. INCOME STATEMENT INSIGHTS (2-3 sentences):
   Discuss profitability (net surplus), operational efficiency, and sustainability.

RULES:
- Use specific numbers and percentages
- Reference year-over-year trends
- Be factual and analytical — no opinion language
- Do NOT invent data not provided
- Do NOT use markdown formatting
- Maximum 120 words per paragraph

Return ONLY a minified JSON object:
{{"financial_position":"..."}}
No markdown fences, no explanation."#,
        coop_name = ctx.coop_name,
        sector = ctx.sector,
        reporting_year = ctx.reporting_year,
        line_items_table = line_items_table,
        total_assets = ctx.total_assets as u64,
        total_equity = ctx.total_equity as u64,
        total_deposits = ctx.total_deposits as u64,
        gross_loans = ctx.gross_loans as u64,
        net_surplus = ctx.net_surplus as u64,
        assets_yoy = ctx.assets_yoy,
        equity_yoy = ctx.equity_yoy,
        deposits_yoy = ctx.deposits_yoy,
        loans_yoy = ctx.loans_yoy,
    )
}

fn build_coop_portfolio_quality_prompt(ctx: &CooperativeNarrativeContext) -> String {
    let portfolio_kpis: Vec<_> = ctx.kpis.iter().filter(|k| {
        matches!(k.name.as_str(), "par30" | "par90" | "npl_ratio" | "loan_loss_coverage" | "gross_loan_portfolio" | "net_loan_portfolio")
    }).cloned().collect();
    let kpi_table = if portfolio_kpis.is_empty() {
        "(no portfolio quality KPIs available)".into()
    } else {
        fmt_kpi_table(&portfolio_kpis)
    };

    format!(
        r#"You are a senior financial analyst specializing in SACCO loan portfolio quality in Eswatini. Your task is to generate a narrative analysis of a cooperative's portfolio quality and risk profile.

COOPERATIVE METADATA:
- Name: {coop_name}
- Sector: {sector}
- Reporting Year: {reporting_year}

PORTFOLIO QUALITY KPIs:
{kpi_table}

TASK:
Generate exactly TWO paragraphs:

1. PORTFOLIO QUALITY ASSESSMENT (3-4 sentences):
   Analyze PAR30, PAR90, and NPL ratio. Compare to benchmarks and prior year. Discuss provisioning adequacy (loan loss coverage). Identify trends.

2. RISK RECOMMENDATIONS (2-3 sentences):
   Provide actionable recommendations based on portfolio quality findings. Reference specific thresholds.

RULES:
- Use specific percentages and amounts
- Compare to benchmarks
- Be direct about risks — this is a regulatory report
- Do NOT invent data
- Do NOT use markdown formatting
- Maximum 120 words per paragraph

Return ONLY a minified JSON object:
{{"portfolio_quality":"..."}}
No markdown fences, no explanation."#,
        coop_name = ctx.coop_name,
        sector = ctx.sector,
        reporting_year = ctx.reporting_year,
        kpi_table = kpi_table,
    )
}

fn build_coop_non_financial_prompt(ctx: &CooperativeNarrativeContext) -> String {
    let nf = ctx.membership_stats.as_ref();
    let savings = ctx.savings_stats.as_ref();
    let loans = ctx.loan_stats.as_ref();

    let membership_section = nf.map(|m| {
        format!(
            "MEMBERSHIP STATISTICS:
- Total Members: {total_members}
- Active Members: {active_members} ({active_pct}%)
- Dormant Members: {dormant} ({dormant_pct}%)
- Women Members: {women} ({women_pct}%)
- Youth Members (under 35): {youth} ({youth_pct}%)
- Rural Members: {rural} ({rural_pct}%)
- AGM Attendance: {agm_pct}%
- Leadership Count: {leadership_count}
- Voting Participation: {voting_pct}%",
            total_members = m.total_members,
            active_members = m.active_members,
            active_pct = if m.total_members > 0 { m.active_members as f64 / m.total_members as f64 * 100.0 } else { 0.0 },
            dormant = m.dormant_members,
            dormant_pct = if m.total_members > 0 { m.dormant_members as f64 / m.total_members as f64 * 100.0 } else { 0.0 },
            women = m.women_members,
            women_pct = if m.total_members > 0 { m.women_members as f64 / m.total_members as f64 * 100.0 } else { 0.0 },
            youth = m.youth_members,
            youth_pct = if m.total_members > 0 { m.youth_members as f64 / m.total_members as f64 * 100.0 } else { 0.0 },
            rural = m.rural_members,
            rural_pct = if m.total_members > 0 { m.rural_members as f64 / m.total_members as f64 * 100.0 } else { 0.0 },
            agm_pct = m.agm_participation_pct,
            leadership_count = m.leadership_count,
            voting_pct = m.voting_participation_pct,
        )
    }).unwrap_or_else(|| "(no membership data available)".into());

    let savings_section = savings.map(|s| {
        format!(
            "SAVINGS PERFORMANCE:
- Total Savings Accounts: {total_savings_accounts}
- Active Savers: {active_savers} ({active_savers_pct}%)
- Savings Penetration: {savings_penetration}%
- Average Savings Balance: E {avg_balance}",
            total_savings_accounts = s.total_savings_accounts,
            active_savers = s.active_savers,
            active_savers_pct = if s.total_savings_accounts > 0 { s.active_savers as f64 / s.total_savings_accounts as f64 * 100.0 } else { 0.0 },
            savings_penetration = s.savings_penetration_pct,
            avg_balance = s.avg_savings_balance,
        )
    }).unwrap_or_else(|| "(no savings data available)".into());

    let loan_section = loans.map(|l| {
        format!(
            "LOAN DEMOGRAPHICS:
- Active Borrowers: {active_borrowers}
- Women Borrowers: {women_borrowers} ({women_pct}%)
- Youth Borrowers: {youth_borrowers} ({youth_pct}%)
- Rural Borrowers: {rural_borrowers} ({rural_pct}%)
- On-Time Repayment Rate: {on_time_repayment}%",
            active_borrowers = l.active_borrowers,
            women_borrowers = l.women_borrowers,
            women_pct = if l.active_borrowers > 0 { l.women_borrowers as f64 / l.active_borrowers as f64 * 100.0 } else { 0.0 },
            youth_borrowers = l.youth_borrowers,
            youth_pct = if l.active_borrowers > 0 { l.youth_borrowers as f64 / l.active_borrowers as f64 * 100.0 } else { 0.0 },
            rural_borrowers = l.rural_borrowers,
            rural_pct = if l.active_borrowers > 0 { l.rural_borrowers as f64 / l.active_borrowers as f64 * 100.0 } else { 0.0 },
            on_time_repayment = l.on_time_repayment_pct,
        )
    }).unwrap_or_else(|| "(no loan demographic data available)".into());

    format!(
        r#"You are a social impact analyst specializing in SACCO cooperatives in Eswatini. Your task is to generate a narrative analysis of a cooperative's non-financial performance indicators.

COOPERATIVE METADATA:
- Name: {coop_name}
- Sector: {sector}
- Reporting Year: {reporting_year}

{membership_section}

{savings_section}

{loan_section}

TASK:
Generate exactly TWO paragraphs:

1. SOCIAL IMPACT ASSESSMENT (3-4 sentences):
   Analyze membership diversity (gender, age, geography), financial inclusion (savings penetration, credit access), and community engagement (AGM participation, governance).

2. INCLUSION RECOMMENDATIONS (2-3 sentences):
   Highlight areas of strength and areas for improvement in social inclusion. Reference specific percentages.

RULES:
- Use specific percentages and counts
- Be factual about inclusion metrics
- Do NOT invent data
- Do NOT use markdown formatting
- Maximum 120 words per paragraph

Return ONLY a minified JSON object:
{{"non_financial":"..."}}
No markdown fences, no explanation."#,
        coop_name = ctx.coop_name,
        sector = ctx.sector,
        reporting_year = ctx.reporting_year,
        membership_section = membership_section,
        savings_section = savings_section,
        loan_section = loan_section,
    )
}

fn build_coop_benchmark_comparison_prompt(ctx: &CooperativeNarrativeContext) -> String {
    let kpi_table = fmt_kpi_table(&ctx.kpis);
    let green_count = ctx.kpis.iter().filter(|k| k.status.as_deref() == Some("green")).count();
    let amber_count = ctx.kpis.iter().filter(|k| k.status.as_deref() == Some("amber")).count();
    let red_count = ctx.kpis.iter().filter(|k| k.status.as_deref() == Some("red")).count();
    let sector_avg_par30 = ctx.sector_avg_par30.map(|v| format!("{v:.1}%")).unwrap_or_else(|| "N/A".into());
    let national_avg_par30 = ctx.national_avg_par30.map(|v| format!("{v:.1}%")).unwrap_or_else(|| "N/A".into());
    let sector_avg_car = ctx.sector_avg_car.map(|v| format!("{v:.1}%")).unwrap_or_else(|| "N/A".into());

    format!(
        r#"You are a PEARLS framework analyst for SACCO cooperatives in Eswatini. Your task is to generate a narrative comparing a cooperative's KPIs against PEARLS benchmarks and sector averages.

COOPERATIVE METADATA:
- Name: {coop_name}
- Sector: {sector}
- Reporting Year: {reporting_year}

PEARLS BENCHMARK COMPARISON:
{kpi_table}

STATUS DISTRIBUTION:
- Green (Pass): {green_count} KPIs
- Amber (Watch): {amber_count} KPIs
- Red (Alert): {red_count} KPIs

SECTOR BENCHMARKS:
- Sector Average PAR30: {sector_avg_par30}
- National Average PAR30: {national_avg_par30}
- Sector Average CAR: {sector_avg_car}

TASK:
Generate exactly TWO paragraphs:

1. BENCHMARK ANALYSIS (3-4 sentences):
   Compare the cooperative's performance against PEARLS benchmarks. Highlight KPIs that meet, exceed, or fall below benchmarks. Reference specific values.

2. PERFORMANCE TREND (2-3 sentences):
   Discuss year-over-year improvements or deteriorations. Identify the most significant changes.

RULES:
- Use specific percentages and benchmark comparisons
- Reference PEARLS thresholds explicitly
- Be objective — let the numbers speak
- Do NOT invent data
- Do NOT use markdown formatting
- Maximum 120 words per paragraph

Return ONLY a minified JSON object:
{{"benchmark_comparison":"..."}}
No markdown fences, no explanation."#,
        coop_name = ctx.coop_name,
        sector = ctx.sector,
        reporting_year = ctx.reporting_year,
        kpi_table = kpi_table,
        green_count = green_count,
        amber_count = amber_count,
        red_count = red_count,
        sector_avg_par30 = sector_avg_par30,
        national_avg_par30 = national_avg_par30,
        sector_avg_car = sector_avg_car,
    )
}

fn build_apex_executive_dashboard_prompt(ctx: &ApexNarrativeContext) -> String {
    let dist_table = fmt_distributions(&ctx.distributions);
    let top: String = ctx.cooperatives.iter().take(5).map(|c| c.name.clone()).collect::<Vec<_>>().join(", ");
    let high_risk: Vec<_> = ctx.cooperatives.iter().filter(|c| {
        ["par30", "par90", "roa", "roe", "capital_adequacy_ratio", "liquid_funds_ratio", "operational_self_sufficiency"]
            .iter()
            .filter(|kpi| {
                let val = c.kpis.get(**kpi).copied().unwrap_or(0.0);
                match **kpi {
                    "par30" | "par90" => val > 10.0,
                    "roa" | "roe" | "capital_adequacy_ratio" | "liquid_funds_ratio" | "operational_self_sufficiency" => val < 1.0,
                    _ => false,
                }
            })
            .count() >= 3
    }).map(|c| c.name.clone()).collect::<Vec<_>>();
    let attention = if high_risk.is_empty() { "None".into() } else { high_risk.join(", ") };

    format!(
        r#"You are a senior regulatory analyst for the Ministry of Commerce, Industry and Energy in Eswatini. Your task is to generate a narrative overview of cooperative sector performance at the Apex level.

ENTITY METADATA:
- Apex Name: {apex_name}
- Tier: Apex
- Reporting Year: {reporting_year}
- Total Cooperatives: {total_coops}
- Cooperatives with Data: {coops_with_data}
- Filing Rate: {filing_rate:.1}%

AGGREGATE KPI DISTRIBUTIONS:
{dist_table}

TOP PERFORMING COOPERATIVES: {top}
COOPERATIVES REQUIRING ATTENTION: {attention}

NON-FINANCIAL SUMMARY:
- Average Active Members %: {avg_active_members:.1}%
- Average Savings Penetration: {avg_savings_pen:.1}%
- Average Credit Penetration: {avg_credit_pen:.1}%
- Average On-Time Repayment: {avg_repayment:.1}%
- Average Dormancy: {avg_dormancy:.1}%

TASK:
Generate exactly TWO paragraphs:

1. SECTOR OVERVIEW (3-4 sentences):
   Summarize the overall health of the cooperative sector. Reference total cooperatives, filing rates, and the distribution of green/amber/red KPIs.

2. KEY FINDINGS AND RECOMMENDATIONS (3-4 sentences):
   Highlight the most significant findings. Reference specific cooperatives or KPI trends. Provide actionable regulatory recommendations.

RULES:
- Use specific numbers and percentages
- Reference cooperative names where relevant
- Be factual and regulatory in tone
- Do NOT invent data
- Do NOT use markdown formatting
- Maximum 150 words per paragraph

Return ONLY a minified JSON object:
{{"executive_dashboard":"..."}}
No markdown fences, no explanation."#,
        apex_name = ctx.apex_name,
        reporting_year = ctx.reporting_year,
        total_coops = ctx.total_coops,
        coops_with_data = ctx.coops_with_data,
        filing_rate = if ctx.total_coops > 0 { ctx.coops_with_data as f64 / ctx.total_coops as f64 * 100.0 } else { 0.0 },
        dist_table = dist_table,
        top = top,
        attention = attention,
        avg_active_members = ctx.nf_summary.avg_active_members_pct,
        avg_savings_pen = ctx.nf_summary.avg_savings_penetration_pct,
        avg_credit_pen = ctx.nf_summary.avg_credit_penetration_pct,
        avg_repayment = ctx.nf_summary.avg_on_time_repayment_pct,
        avg_dormancy = ctx.nf_summary.avg_dormancy_pct,
    )
}

fn build_apex_risk_distribution_prompt(ctx: &ApexNarrativeContext) -> String {
    let dist_table = fmt_distributions(&ctx.distributions);

    format!(
        r#"You are a regulatory risk analyst for the Ministry of Commerce, Industry and Energy in Eswatini. Your task is to generate a narrative analysis of the risk distribution across cooperatives at the Apex level.

ENTITY METADATA:
- Apex Name: {apex_name}
- Tier: Apex
- Reporting Year: {reporting_year}
- Total Cooperatives: {total_coops}
- Cooperatives with Data: {coops_with_data}

AGGREGATE KPI DISTRIBUTIONS:
{dist_table}

TASK:
Generate exactly TWO paragraphs:

1. RISK DISTRIBUTION ANALYSIS (3-4 sentences):
   Analyze the traffic light distribution across all KPIs. Discuss which KPIs have the highest proportion of green (healthy), amber (watch), and red (risk) cooperatives. Highlight the most concerning distributions.

2. COOPERATIVE DETAIL INSIGHTS (2-3 sentences):
   Identify patterns in the distribution — are certain KPIs disproportionately dragging cooperatives into red? Provide actionable insights for regulatory focus.

RULES:
- Use specific percentages and counts from the distribution data
- Compare KPI distributions to each other
- Be factual and regulatory in tone
- Do NOT invent data
- Do NOT use markdown formatting
- Maximum 120 words per paragraph

Return ONLY a minified JSON object:
{{"risk_distribution":"..."}}
No markdown fences, no explanation."#,
        apex_name = ctx.apex_name,
        reporting_year = ctx.reporting_year,
        total_coops = ctx.total_coops,
        coops_with_data = ctx.coops_with_data,
        dist_table = dist_table,
    )
}

fn build_apex_risk_watch_prompt(ctx: &ApexNarrativeContext) -> String {
    let high_risk_table = fmt_high_risk_table(&ctx.cooperatives);
    let high_risk_count = ctx.cooperatives.iter().filter(|c| {
        ["par30", "par90", "roa", "roe", "capital_adequacy_ratio", "liquid_funds_ratio", "operational_self_sufficiency"]
            .iter()
            .filter(|kpi| {
                let val = c.kpis.get(**kpi).copied().unwrap_or(0.0);
                match **kpi {
                    "par30" | "par90" => val > 10.0,
                    "roa" | "roe" | "capital_adequacy_ratio" | "liquid_funds_ratio" | "operational_self_sufficiency" => val < 1.0,
                    _ => false,
                }
            })
            .count() >= 3
    }).count();

    format!(
        r#"You are a regulatory risk analyst for the Ministry of Commerce, Industry and Energy in Eswatini. Your task is to generate a narrative risk assessment for cooperatives flagged as high-risk.

ENTITY METADATA:
- Apex Name: {apex_name}
- Tier: Apex
- Reporting Year: {reporting_year}
- Total Cooperatives: {total_coops}
- High-Risk Cooperatives (Red KPIs >= 3): {high_risk_count}

HIGH-RISK COOPERATIVE DETAILS:
{high_risk_table}

TASK:
Generate exactly TWO paragraphs:

1. RISK ASSESSMENT (3-4 sentences):
   Assess the overall risk profile of the apex. Discuss the number and severity of high-risk cooperatives. Reference specific KPI breaches.

2. INTERVENTION RECOMMENDATIONS (2-3 sentences):
   Recommend specific regulatory interventions for the highest-risk cooperatives. Prioritize by severity.

RULES:
- Use specific numbers and cooperative names
- Be direct about risks — this is a regulatory document
- Prioritize recommendations by urgency
- Do NOT invent data
- Do NOT use markdown formatting
- Maximum 120 words per paragraph

Return ONLY a minified JSON object:
{{"risk_watch":"..."}}
No markdown fences, no explanation."#,
        apex_name = ctx.apex_name,
        reporting_year = ctx.reporting_year,
        total_coops = ctx.total_coops,
        high_risk_count = high_risk_count,
        high_risk_table = high_risk_table,
    )
}

fn build_fed_executive_dashboard_prompt(ctx: &FederationNarrativeContext) -> String {
    let dist_table = fmt_distributions(&ctx.distributions);
    let top: String = ctx.apexes.iter().flat_map(|a| a.cooperatives.iter()).take(5).map(|c| c.name.clone()).collect::<Vec<_>>().join(", ");
    let filing_rate = if ctx.total_coops > 0 { ctx.coops_with_data as f64 / ctx.total_coops as f64 * 100.0 } else { 0.0 };

    format!(
        r#"You are a senior regulatory analyst for the Ministry of Commerce, Industry and Energy in Eswatini. Your task is to generate a narrative overview of cooperative sector performance at the Federation level.

ENTITY METADATA:
- Federation Name: {federation_name}
- Tier: Federation
- Reporting Year: {reporting_year}
- Total Cooperatives: {total_coops}
- Cooperatives with Data: {coops_with_data}
- Filing Rate: {filing_rate:.1}%
- Total Apexes: {total_apexes}

AGGREGATE KPI DISTRIBUTIONS:
{dist_table}

TOP PERFORMING COOPERATIVES: {top}

NON-FINANCIAL SUMMARY:
- Average Active Members %: {avg_active:.1}%
- Average Savings Penetration: {avg_savings:.1}%
- Average Credit Penetration: {avg_credit:.1}%
- Average On-Time Repayment: {avg_repayment:.1}%
- Average Dormancy: {avg_dormancy:.1}%

TASK:
Generate exactly TWO paragraphs:

1. SECTOR OVERVIEW (3-4 sentences):
   Summarize the overall health of the cooperative sector. Reference total cooperatives, filing rates, and the distribution of green/amber/red KPIs.

2. KEY FINDINGS AND RECOMMENDATIONS (3-4 sentences):
   Highlight the most significant findings. Reference specific cooperatives or KPI trends. Provide actionable recommendations for federation leadership.

RULES:
- Use specific numbers and percentages
- Reference cooperative names where relevant
- Be factual and regulatory in tone
- Do NOT invent data
- Do NOT use markdown formatting
- Maximum 150 words per paragraph

Return ONLY a minified JSON object:
{{"executive_dashboard":"..."}}
No markdown fences, no explanation."#,
        federation_name = ctx.federation_name,
        reporting_year = ctx.reporting_year,
        total_coops = ctx.total_coops,
        coops_with_data = ctx.coops_with_data,
        filing_rate = filing_rate,
        total_apexes = ctx.apexes.len(),
        dist_table = dist_table,
        top = top,
        avg_active = ctx.nf_summary.avg_active_members_pct,
        avg_savings = ctx.nf_summary.avg_savings_penetration_pct,
        avg_credit = ctx.nf_summary.avg_credit_penetration_pct,
        avg_repayment = ctx.nf_summary.avg_on_time_repayment_pct,
        avg_dormancy = ctx.nf_summary.avg_dormancy_pct,
    )
}

fn build_fed_risk_distribution_prompt(ctx: &FederationNarrativeContext) -> String {
    let dist_table = fmt_distributions(&ctx.distributions);

    format!(
        r#"You are a regulatory risk analyst for the Ministry of Commerce, Industry and Energy in Eswatini. Your task is to generate a narrative analysis of the risk distribution across cooperatives at the Federation level.

ENTITY METADATA:
- Federation Name: {federation_name}
- Tier: Federation
- Reporting Year: {reporting_year}
- Total Cooperatives: {total_coops}
- Cooperatives with Data: {coops_with_data}

AGGREGATE KPI DISTRIBUTIONS:
{dist_table}

TASK:
Generate exactly TWO paragraphs:

1. RISK DISTRIBUTION ANALYSIS (3-4 sentences):
   Analyze the traffic light distribution across all KPIs. Discuss which KPIs have the highest proportion of green (healthy), amber (watch), and red (risk) cooperatives. Highlight the most concerning distributions.

2. COOPERATIVE DETAIL INSIGHTS (2-3 sentences):
   Identify patterns in the distribution — are certain KPIs disproportionately dragging cooperatives into red? Provide actionable insights for federation leadership.

RULES:
- Use specific percentages and counts from the distribution data
- Compare KPI distributions to each other
- Be factual and regulatory in tone
- Do NOT invent data
- Do NOT use markdown formatting
- Maximum 120 words per paragraph

Return ONLY a minified JSON object:
{{"risk_distribution":"..."}}
No markdown fences, no explanation."#,
        federation_name = ctx.federation_name,
        reporting_year = ctx.reporting_year,
        total_coops = ctx.total_coops,
        coops_with_data = ctx.coops_with_data,
        dist_table = dist_table,
    )
}

fn build_fed_sector_breakdown_prompt(ctx: &FederationNarrativeContext) -> String {
    let all_coops: Vec<CoopKpiRowData> = ctx.apexes.iter().flat_map(|a| a.cooperatives.iter().cloned()).collect();
    let sector_table = fmt_sector_distribution(&all_coops);

    format!(
        r#"You are a sector analyst for the Ministry of Commerce, Industry and Energy in Eswatini. Your task is to generate a narrative analysis of cooperative sector distribution.

ENTITY METADATA:
- Federation Name: {federation_name}
- Tier: Federation
- Reporting Year: {reporting_year}
- Total Cooperatives: {total_coops}

SECTOR DISTRIBUTION:
{sector_table}

TASK:
Generate exactly TWO paragraphs:

1. SECTOR COMPOSITION ANALYSIS (3-4 sentences):
   Analyze the distribution of cooperatives across sectors. Discuss which sectors dominate and their relative financial health.

2. SECTOR-SPECIFIC INSIGHTS (2-3 sentences):
   Highlight sector-specific strengths or weaknesses. Reference specific percentages.

RULES:
- Use specific numbers and percentages
- Compare sectors objectively
- Do NOT invent data
- Do NOT use markdown formatting
- Maximum 120 words per paragraph

Return ONLY a minified JSON object:
{{"sector_breakdown":"..."}}
No markdown fences, no explanation."#,
        federation_name = ctx.federation_name,
        reporting_year = ctx.reporting_year,
        total_coops = ctx.total_coops,
        sector_table = sector_table,
    )
}

fn build_fed_apex_comparison_prompt(ctx: &FederationNarrativeContext) -> String {
    // Build apex-level comparison data
    let mut apex_rows = Vec::new();
    for apex in &ctx.apexes {
        let filing_rate = if apex.total_coops > 0 {
            apex.coops_with_data as f64 / apex.total_coops as f64 * 100.0
        } else {
            0.0
        };
        let avg_par30 = if !apex.cooperatives.is_empty() {
            apex.cooperatives.iter().map(|c| c.kpis.get("par30").copied().unwrap_or(0.0)).sum::<f64>()
                / apex.cooperatives.len() as f64
        } else {
            0.0
        };
        let avg_roa = if !apex.cooperatives.is_empty() {
            apex.cooperatives.iter().map(|c| c.kpis.get("roa").copied().unwrap_or(0.0)).sum::<f64>()
                / apex.cooperatives.len() as f64
        } else {
            0.0
        };
        apex_rows.push(format!("| {} | {} | {} | {:.1}% | {:.1}% | {:.1}% |",
            apex.apex_name, apex.total_coops, apex.coops_with_data, filing_rate, avg_par30, avg_roa));
    }
    let apex_table = if apex_rows.is_empty() {
        "(no apex data available)".into()
    } else {
        let mut t = String::from("| Apex | Total Coops | Filed | Filing Rate | Avg PAR30 | Avg ROA |\n|------|-------------|-------|-------------|-----------|--------|\n");
        for row in &apex_rows {
            t.push_str(row);
            t.push('\n');
        }
        t
    };

    format!(
        r#"You are a regulatory analyst for the Ministry of Commerce, Industry and Energy in Eswatini. Your task is to generate a narrative comparison of Apex-level performance and filing compliance within a Federation.

ENTITY METADATA:
- Federation Name: {federation_name}
- Tier: Federation
- Reporting Year: {reporting_year}
- Total Apexes: {total_apexes}

APEX COMPARISON DATA:
{apex_table}

TASK:
Generate exactly TWO paragraphs:

1. APEX COMPARISON (3-4 sentences):
   Compare the performance of apexes within the federation. Discuss filing rates, average PAR30, and ROA differences. Identify which apexes are leading and which are lagging.

2. FILING COMPLIANCE INSIGHTS (2-3 sentences):
   Analyze filing compliance across apexes. Highlight apexes with low filing rates and recommend actions to improve compliance.

RULES:
- Use specific numbers and apex names
- Compare apexes objectively
- Be factual and regulatory in tone
- Do NOT invent data
- Do NOT use markdown formatting
- Maximum 120 words per paragraph

Return ONLY a minified JSON object:
{{"apex_comparison":"..."}}
No markdown fences, no explanation."#,
        federation_name = ctx.federation_name,
        reporting_year = ctx.reporting_year,
        total_apexes = ctx.apexes.len(),
        apex_table = apex_table,
    )
}

fn build_fed_pearls_analysis_prompt(ctx: &FederationNarrativeContext) -> String {
    let all_coops: Vec<CoopKpiRowData> = ctx.apexes.iter().flat_map(|a| a.cooperatives.iter().cloned()).collect();
    let pearls_table = fmt_pearls_compliance(&all_coops);

    format!(
        r#"You are a PEARLS framework specialist for the Ministry of Commerce, Industry and Energy in Eswatini. Your task is to generate a narrative analysis of PEARLS benchmark compliance across cooperatives.

ENTITY METADATA:
- Federation Name: {federation_name}
- Tier: Federation
- Reporting Year: {reporting_year}
- Total Cooperatives with Data: {coops_with_data}

PEARLS COMPLIANCE SUMMARY:
{pearls_table}

TASK:
Generate exactly TWO paragraphs:

1. PEARLS COMPLIANCE OVERVIEW (3-4 sentences):
   Summarize overall PEARLS compliance rates across the sector. Highlight which criteria have the highest and lowest compliance.

2. IMPROVEMENT PRIORITIES (2-3 sentences):
   Identify the most critical PEARLS criteria requiring attention. Reference specific cooperatives and their gaps.

RULES:
- Use specific compliance percentages
- Reference PEARLS criteria by name
- Be regulatory and actionable
- Do NOT invent data
- Do NOT use markdown formatting
- Maximum 120 words per paragraph

Return ONLY a minified JSON object:
{{"pearls_analysis":"..."}}
No markdown fences, no explanation."#,
        federation_name = ctx.federation_name,
        reporting_year = ctx.reporting_year,
        coops_with_data = ctx.coops_with_data,
        pearls_table = pearls_table,
    )
}

fn build_ministry_executive_dashboard_prompt(ctx: &MinistryNarrativeContext) -> String {
    let dist_table = fmt_distributions(&ctx.distributions);
    let top: String = ctx.cooperatives.iter().take(5).map(|c| c.name.clone()).collect::<Vec<_>>().join(", ");
    let high_risk: Vec<_> = ctx.cooperatives.iter().filter(|c| {
        ["par30", "par90", "roa", "roe", "capital_adequacy_ratio", "liquid_funds_ratio", "operational_self_sufficiency"]
            .iter()
            .filter(|kpi| {
                let val = c.kpis.get(**kpi).copied().unwrap_or(0.0);
                match **kpi {
                    "par30" | "par90" => val > 10.0,
                    "roa" | "roe" | "capital_adequacy_ratio" | "liquid_funds_ratio" | "operational_self_sufficiency" => val < 1.0,
                    _ => false,
                }
            })
            .count() >= 3
    }).map(|c| c.name.clone()).collect::<Vec<_>>();
    let attention = if high_risk.is_empty() { "None".into() } else { high_risk.join(", ") };
    let filing_rate = if ctx.total_coops > 0 { ctx.coops_with_data as f64 / ctx.total_coops as f64 * 100.0 } else { 0.0 };

    format!(
        r#"You are a senior regulatory analyst for the Ministry of Commerce, Industry and Energy in Eswatini. Your task is to generate a national overview narrative of the cooperative sector.

ENTITY METADATA:
- Tier: Ministry (National)
- Reporting Year: {reporting_year}
- Total Cooperatives: {total_coops}
- Cooperatives with Data: {coops_with_data}
- Filing Rate: {filing_rate:.1}%

AGGREGATE KPI DISTRIBUTIONS:
{dist_table}

TOP PERFORMING COOPERATIVES: {top}
COOPERATIVES REQUIRING ATTENTION: {attention}

NON-FINANCIAL SUMMARY:
- Average Active Members %: {avg_active:.1}%
- Average Savings Penetration: {avg_savings:.1}%
- Average Credit Penetration: {avg_credit:.1}%
- Average On-Time Repayment: {avg_repayment:.1}%
- Average Dormancy: {avg_dormancy:.1}%

TASK:
Generate exactly TWO paragraphs:

1. NATIONAL SECTOR OVERVIEW (3-4 sentences):
   Summarize the overall health of the national cooperative sector. Reference total cooperatives, filing rates, and KPI distributions.

2. KEY FINDINGS AND RECOMMENDATIONS (3-4 sentences):
   Highlight the most significant findings. Reference specific cooperatives or KPI trends. Provide regulatory recommendations for ministry leadership.

RULES:
- Use specific numbers and percentages
- Reference cooperative names where relevant
- Be factual and regulatory in tone
- Do NOT invent data
- Do NOT use markdown formatting
- Maximum 150 words per paragraph

Return ONLY a minified JSON object:
{{"executive_dashboard":"..."}}
No markdown fences, no explanation."#,
        reporting_year = ctx.reporting_year,
        total_coops = ctx.total_coops,
        coops_with_data = ctx.coops_with_data,
        filing_rate = filing_rate,
        dist_table = dist_table,
        top = top,
        attention = attention,
        avg_active = ctx.nf_summary.avg_active_members_pct,
        avg_savings = ctx.nf_summary.avg_savings_penetration_pct,
        avg_credit = ctx.nf_summary.avg_credit_penetration_pct,
        avg_repayment = ctx.nf_summary.avg_on_time_repayment_pct,
        avg_dormancy = ctx.nf_summary.avg_dormancy_pct,
    )
}

fn build_ministry_risk_distribution_prompt(ctx: &MinistryNarrativeContext) -> String {
    let dist_table = fmt_distributions(&ctx.distributions);

    format!(
        r#"You are a regulatory risk analyst for the Ministry of Commerce, Industry and Energy in Eswatini. Your task is to generate a narrative analysis of the national risk distribution across cooperatives.

ENTITY METADATA:
- Tier: Ministry (National)
- Reporting Year: {reporting_year}
- Total Cooperatives: {total_coops}
- Cooperatives with Data: {coops_with_data}

AGGREGATE KPI DISTRIBUTIONS:
{dist_table}

TASK:
Generate exactly TWO paragraphs:

1. RISK DISTRIBUTION ANALYSIS (3-4 sentences):
   Analyze the traffic light distribution across all KPIs. Discuss which KPIs have the highest proportion of green (healthy), amber (watch), and red (risk) cooperatives. Highlight the most concerning distributions.

2. NATIONAL INSIGHTS (2-3 sentences):
   Identify patterns in the distribution — are certain KPIs disproportionately dragging cooperatives into red? Provide actionable insights for ministry leadership.

RULES:
- Use specific percentages and counts from the distribution data
- Compare KPI distributions to each other
- Be factual and regulatory in tone
- Do NOT invent data
- Do NOT use markdown formatting
- Maximum 120 words per paragraph

Return ONLY a minified JSON object:
{{"risk_distribution":"..."}}
No markdown fences, no explanation."#,
        reporting_year = ctx.reporting_year,
        total_coops = ctx.total_coops,
        coops_with_data = ctx.coops_with_data,
        dist_table = dist_table,
    )
}

fn build_ministry_sector_breakdown_prompt(ctx: &MinistryNarrativeContext) -> String {
    let sector_table = fmt_sector_distribution(&ctx.cooperatives);

    format!(
        r#"You are a sector analyst for the Ministry of Commerce, Industry and Energy in Eswatini. Your task is to generate a narrative analysis of cooperative sector distribution.

ENTITY METADATA:
- Tier: Ministry (National)
- Reporting Year: {reporting_year}
- Total Cooperatives: {total_coops}

SECTOR DISTRIBUTION:
{sector_table}

TASK:
Generate exactly TWO paragraphs:

1. SECTOR COMPOSITION ANALYSIS (3-4 sentences):
   Analyze the distribution of cooperatives across sectors. Discuss which sectors dominate and their relative financial health.

2. SECTOR-SPECIFIC INSIGHTS (2-3 sentences):
   Highlight sector-specific strengths or weaknesses. Reference specific percentages.

RULES:
- Use specific numbers and percentages
- Compare sectors objectively
- Do NOT invent data
- Do NOT use markdown formatting
- Maximum 120 words per paragraph

Return ONLY a minified JSON object:
{{"sector_breakdown":"..."}}
No markdown fences, no explanation."#,
        reporting_year = ctx.reporting_year,
        total_coops = ctx.total_coops,
        sector_table = sector_table,
    )
}

fn build_ministry_apex_comparison_prompt(ctx: &MinistryNarrativeContext) -> String {
    // Build sector-level comparison data (ministry has no apexes, compare by sector)
    let mut sector_rows = Vec::new();
    use std::collections::HashMap as StdHashMap;
    let mut by_sector: StdHashMap<String, Vec<&CoopKpiRowData>> = StdHashMap::new();
    for c in &ctx.cooperatives {
        let sector = c.sector.as_deref().unwrap_or("Unknown").to_string();
        by_sector.entry(sector).or_default().push(c);
    }
    for (sector, list) in &by_sector {
        let total = list.len();
        let filed = list.iter().filter(|c| c.kpis.contains_key("par30")).count();
        let filing_rate = if total > 0 { filed as f64 / total as f64 * 100.0 } else { 0.0 };
        let avg_par30 = list.iter().map(|c| c.kpis.get("par30").copied().unwrap_or(0.0)).sum::<f64>()
            / if total > 0 { total as f64 } else { 1.0 };
        let avg_roa = list.iter().map(|c| c.kpis.get("roa").copied().unwrap_or(0.0)).sum::<f64>()
            / if total > 0 { total as f64 } else { 1.0 };
        sector_rows.push(format!("| {} | {} | {} | {:.1}% | {:.1}% | {:.1}% |",
            sector, total, filed, filing_rate, avg_par30, avg_roa));
    }
    let sector_table = if sector_rows.is_empty() {
        "(no sector data available)".into()
    } else {
        let mut t = String::from("| Sector | Total Coops | Filed | Filing Rate | Avg PAR30 | Avg ROA |\n|--------|-------------|-------|-------------|-----------|--------|\n");
        for row in &sector_rows {
            t.push_str(row);
            t.push('\n');
        }
        t
    };

    format!(
        r#"You are a regulatory analyst for the Ministry of Commerce, Industry and Energy in Eswatini. Your task is to generate a narrative comparison of sector-level performance and filing compliance at the National level.

ENTITY METADATA:
- Tier: Ministry (National)
- Reporting Year: {reporting_year}
- Total Sectors: {total_sectors}

SECTOR COMPARISON DATA:
{sector_table}

TASK:
Generate exactly TWO paragraphs:

1. SECTOR COMPARISON (3-4 sentences):
   Compare the performance of sectors nationally. Discuss filing rates, average PAR30, and ROA differences. Identify which sectors are leading and which are lagging.

2. FILING COMPLIANCE INSIGHTS (2-3 sentences):
   Analyze filing compliance across sectors. Highlight sectors with low filing rates and recommend actions to improve compliance.

RULES:
- Use specific numbers and sector names
- Compare sectors objectively
- Be factual and regulatory in tone
- Do NOT invent data
- Do NOT use markdown formatting
- Maximum 120 words per paragraph

Return ONLY a minified JSON object:
{{"apex_comparison":"..."}}
No markdown fences, no explanation."#,
        reporting_year = ctx.reporting_year,
        total_sectors = by_sector.len(),
        sector_table = sector_table,
    )
}

fn build_ministry_pearls_analysis_prompt(ctx: &MinistryNarrativeContext) -> String {
    let pearls_table = fmt_pearls_compliance(&ctx.cooperatives);

    format!(
        r#"You are a PEARLS framework specialist for the Ministry of Commerce, Industry and Energy in Eswatini. Your task is to generate a narrative analysis of PEARLS benchmark compliance across cooperatives.

ENTITY METADATA:
- Tier: Ministry (National)
- Reporting Year: {reporting_year}
- Total Cooperatives with Data: {coops_with_data}

PEARLS COMPLIANCE SUMMARY:
{pearls_table}

TASK:
Generate exactly TWO paragraphs:

1. PEARLS COMPLIANCE OVERVIEW (3-4 sentences):
   Summarize overall PEARLS compliance rates across the sector. Highlight which criteria have the highest and lowest compliance.

2. IMPROVEMENT PRIORITIES (2-3 sentences):
   Identify the most critical PEARLS criteria requiring attention. Reference specific cooperatives and their gaps.

RULES:
- Use specific compliance percentages
- Reference PEARLS criteria by name
- Be regulatory and actionable
- Do NOT invent data
- Do NOT use markdown formatting
- Maximum 120 words per paragraph

Return ONLY a minified JSON object:
{{"pearls_analysis":"..."}}
No markdown fences, no explanation."#,
        reporting_year = ctx.reporting_year,
        coops_with_data = ctx.coops_with_data,
        pearls_table = pearls_table,
    )
}

// ── Context builders ─────────────────────────────────────────────────────────

#[allow(clippy::too_many_arguments)]
pub fn build_cooperative_context(
    coop: &crate::entities::cooperative::Model,
    submission: &crate::entities::submission::Model,
    kpi_records: &[crate::entities::kpi_record::Model],
    prior_kpi_records: &[crate::entities::kpi_record::Model],
    line_items: Option<Vec<BalanceSheetLineItemData>>,
    membership_stats: Option<MembershipStats>,
    savings_stats: Option<SavingsStats>,
    loan_stats: Option<LoanStats>,
    sector_avg_par30: Option<f64>,
    national_avg_par30: Option<f64>,
    sector_avg_car: Option<f64>,
) -> CooperativeNarrativeContext {
    let kpis: Vec<KpiSnapshot> = kpi_records
        .iter()
        .map(|r| KpiSnapshot {
            name: r.kpi_name.clone(),
            value: r.value,
            formatted: r.formatted.clone(),
            unit: "percent".into(),
            status: r.status.clone(),
            benchmark: None,
        })
        .collect();

    let prior_kpis: Vec<KpiSnapshot> = prior_kpi_records
        .iter()
        .map(|r| KpiSnapshot {
            name: r.kpi_name.clone(),
            value: r.value,
            formatted: r.formatted.clone(),
            unit: "percent".into(),
            status: r.status.clone(),
            benchmark: None,
        })
        .collect();

    let find_kpi = |records: &[crate::entities::kpi_record::Model], name: &str| -> f64 {
        records.iter().find(|r| r.kpi_name == name).map(|r| r.value).unwrap_or(0.0)
    };

    let total_assets = find_kpi(kpi_records, "total_assets");
    let total_equity = find_kpi(kpi_records, "total_equity");
    let total_deposits = find_kpi(kpi_records, "total_member_deposits");
    let gross_loans = find_kpi(kpi_records, "gross_loan_portfolio");
    let net_surplus = find_kpi(kpi_records, "net_surplus");

    let prior_total_assets = find_kpi(prior_kpi_records, "total_assets");
    let prior_total_equity = find_kpi(prior_kpi_records, "total_equity");
    let prior_total_deposits = find_kpi(prior_kpi_records, "total_member_deposits");
    let prior_gross_loans = find_kpi(prior_kpi_records, "gross_loan_portfolio");

    let yoy = |current: f64, prior: f64| -> String {
        if prior == 0.0 {
            "N/A".into()
        } else {
            let pct = ((current - prior) / prior.abs()) * 100.0;
            format!("{:+.1}%", pct)
        }
    };

    CooperativeNarrativeContext {
        coop_name: coop.name.clone(),
        region: coop.region.as_ref().map(|r| format!("{r:?}")).unwrap_or_default(),
        sector: coop.sector.clone().unwrap_or_default(),
        institution_type: coop.institution_type.as_ref().map(|t| format!("{t:?}")).unwrap_or_default(),
        reg_no: coop.reg_no.clone().unwrap_or_default(),
        reporting_year: submission.reporting_year,
        kpis,
        prior_kpis,
        total_assets,
        total_equity,
        total_deposits,
        gross_loans,
        net_surplus,
        assets_yoy: yoy(total_assets, prior_total_assets),
        equity_yoy: yoy(total_equity, prior_total_equity),
        deposits_yoy: yoy(total_deposits, prior_total_deposits),
        loans_yoy: yoy(gross_loans, prior_gross_loans),
        sector_avg_par30,
        national_avg_par30,
        sector_avg_car,
        line_items,
        membership_stats,
        savings_stats,
        loan_stats,
    }
}

pub fn build_apex_context(
    apex: &crate::entities::apex::Model,
    coops_data: &[(
        crate::entities::cooperative::Model,
        Option<crate::entities::submission::Model>,
        Vec<crate::entities::kpi_record::Model>,
    )],
    reporting_year: i32,
) -> ApexNarrativeContext {
    let cooperatives: Vec<CoopKpiRowData> = coops_data
        .iter()
        .filter_map(|(coop, sub, kpis)| {
            if sub.is_none() {
                return None;
            }
            let kpi_map: HashMap<String, f64> = kpis.iter().map(|r| (r.kpi_name.clone(), r.value)).collect();
            Some(CoopKpiRowData {
                name: coop.name.clone(),
                sector: coop.sector.clone(),
                region: coop.region.as_ref().map(|r| format!("{r:?}")),
                kpis: kpi_map,
                nf: NfCoopData::default(),
            })
        })
        .collect();

    let distributions = compute_traffic_light_distributions(coops_data);

    let total_coops = coops_data.len() as u64;
    let coops_with_data = coops_data.iter().filter(|(_, s, _)| s.is_some()).count() as u64;

    ApexNarrativeContext {
        apex_name: apex.display_name.clone(),
        reporting_year,
        total_coops,
        coops_with_data,
        cooperatives,
        distributions,
        nf_summary: NfSummaryData::default(),
    }
}

#[allow(clippy::type_complexity)]
pub fn build_federation_context(
    federation: &crate::entities::federation::Model,
    apexes_data: &[(
        crate::entities::apex::Model,
        Vec<(
            crate::entities::cooperative::Model,
            Option<crate::entities::submission::Model>,
            Vec<crate::entities::kpi_record::Model>,
        )>,
    )],
    reporting_year: i32,
) -> FederationNarrativeContext {
    let apexes: Vec<ApexNarrativeContext> = apexes_data
        .iter()
        .map(|(apex, coops)| build_apex_context(apex, coops, reporting_year))
        .collect();

    let all_coops: Vec<_> = apexes_data.iter().flat_map(|(_, coops)| coops.iter().cloned()).collect();
    let total_coops = all_coops.len() as u64;
    let coops_with_data = all_coops.iter().filter(|(_, s, _)| s.is_some()).count() as u64;

    let distributions = compute_traffic_light_distributions(&all_coops);

    FederationNarrativeContext {
        federation_name: federation.display_name.clone(),
        reporting_year,
        total_coops,
        coops_with_data,
        apexes,
        distributions,
        nf_summary: NfSummaryData::default(),
    }
}

pub fn build_ministry_context(
    national_data: &[(
        crate::entities::cooperative::Model,
        Option<crate::entities::submission::Model>,
        Vec<crate::entities::kpi_record::Model>,
    )],
    reporting_year: i32,
) -> MinistryNarrativeContext {
    let cooperatives: Vec<CoopKpiRowData> = national_data
        .iter()
        .filter_map(|(coop, sub, kpis)| {
            if sub.is_none() {
                return None;
            }
            let kpi_map: HashMap<String, f64> = kpis.iter().map(|r| (r.kpi_name.clone(), r.value)).collect();
            Some(CoopKpiRowData {
                name: coop.name.clone(),
                sector: coop.sector.clone(),
                region: coop.region.as_ref().map(|r| format!("{r:?}")),
                kpis: kpi_map,
                nf: NfCoopData::default(),
            })
        })
        .collect();

    let distributions = compute_traffic_light_distributions(national_data);
    let total_coops = national_data.len() as u64;
    let coops_with_data = national_data.iter().filter(|(_, s, _)| s.is_some()).count() as u64;

    MinistryNarrativeContext {
        reporting_year,
        total_coops,
        coops_with_data,
        distributions,
        cooperatives,
        nf_summary: NfSummaryData::default(),
    }
}

fn compute_traffic_light_distributions(
    coops_data: &[(crate::entities::cooperative::Model, Option<crate::entities::submission::Model>, Vec<crate::entities::kpi_record::Model>)],
) -> HashMap<String, TrafficLightData> {
    let mut by_kpi: HashMap<String, Vec<&crate::entities::kpi_record::Model>> = HashMap::new();
    for (_, _, kpis) in coops_data {
        for r in kpis {
            by_kpi.entry(r.kpi_name.clone()).or_default().push(r);
        }
    }

    by_kpi
        .into_iter()
        .map(|(name, records)| {
            let total = records.len() as f64;
            let green = records.iter().filter(|r| r.status.as_deref() == Some("green")).count() as f64;
            let amber = records.iter().filter(|r| r.status.as_deref() == Some("amber")).count() as f64;
            let red = records.iter().filter(|r| r.status.as_deref() == Some("red")).count() as f64;
            let no_data = total - green - amber - red;
            let avg = if total > 0.0 {
                Some(records.iter().map(|r| r.value).sum::<f64>() / total)
            } else {
                None
            };

            (name, TrafficLightData {
                green_pct: if total > 0.0 { green / total * 100.0 } else { 0.0 },
                amber_pct: if total > 0.0 { amber / total * 100.0 } else { 0.0 },
                red_pct: if total > 0.0 { red / total * 100.0 } else { 0.0 },
                no_data_pct: if total > 0.0 { no_data / total * 100.0 } else { 0.0 },
                green_count: green as u64,
                amber_count: amber as u64,
                red_count: red as u64,
                national_avg: avg,
            })
        })
        .collect()
}

pub fn encode_cooperative_narrative_params(narratives: &CooperativeNarratives) -> String {
    format!(
        "&executive_summary={}&financial_position={}&portfolio_quality={}&non_financial={}&benchmark_comparison={}",
        urlencoding::encode(&narratives.executive_summary),
        urlencoding::encode(&narratives.financial_position),
        urlencoding::encode(&narratives.portfolio_quality),
        urlencoding::encode(&narratives.non_financial),
        urlencoding::encode(&narratives.benchmark_comparison),
    )
}

pub fn encode_apex_narrative_params(narratives: &ApexNarratives) -> String {
    format!(
        "&executive_dashboard={}&risk_distribution={}&risk_watch={}",
        urlencoding::encode(&narratives.executive_dashboard),
        urlencoding::encode(&narratives.risk_distribution),
        urlencoding::encode(&narratives.risk_watch),
    )
}

pub fn encode_federation_narrative_params(narratives: &FederationNarratives) -> String {
    format!(
        "&executive_dashboard={}&risk_distribution={}&sector_breakdown={}&apex_comparison={}&pearls_analysis={}",
        urlencoding::encode(&narratives.executive_dashboard),
        urlencoding::encode(&narratives.risk_distribution),
        urlencoding::encode(&narratives.sector_breakdown),
        urlencoding::encode(&narratives.apex_comparison),
        urlencoding::encode(&narratives.pearls_analysis),
    )
}

pub fn encode_ministry_narrative_params(narratives: &MinistryNarratives) -> String {
    format!(
        "&executive_dashboard={}&risk_distribution={}&sector_breakdown={}&apex_comparison={}&pearls_analysis={}",
        urlencoding::encode(&narratives.executive_dashboard),
        urlencoding::encode(&narratives.risk_distribution),
        urlencoding::encode(&narratives.sector_breakdown),
        urlencoding::encode(&narratives.apex_comparison),
        urlencoding::encode(&narratives.pearls_analysis),
    )
}
