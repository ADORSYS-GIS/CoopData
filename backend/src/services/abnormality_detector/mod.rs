pub mod calculations;
mod flags;
mod sum_checks;

use uuid::Uuid;

use crate::entities::abnormality_flag;
use crate::entities::chart_of_account;
use crate::entities::enums::CooperativeType;
use crate::error::AppResult;
use crate::repositories::{
    AbnormalityFlagRepository, BalanceSheetLineItemRepository, ChartOfAccountsRepository,
};

pub use calculations::FlagOutput;

pub struct AbnormalityDetector {
    line_item_repo: BalanceSheetLineItemRepository,
    flag_repo: AbnormalityFlagRepository,
    coa_repo: ChartOfAccountsRepository,
}

impl AbnormalityDetector {
    pub fn new(
        line_item_repo: BalanceSheetLineItemRepository,
        flag_repo: AbnormalityFlagRepository,
        coa_repo: ChartOfAccountsRepository,
    ) -> Self {
        Self {
            line_item_repo,
            flag_repo,
            coa_repo,
        }
    }

    pub async fn run(
        &self,
        submission_id: Uuid,
        cooperative_id: Uuid,
        fs_id: Uuid,
        coa: &[chart_of_account::Model],
        cooperative_type: &str,
    ) -> AppResult<(Vec<FlagOutput>, Vec<FlagOutput>)> {
        let line_items = self
            .line_item_repo
            .find_by_financial_statement(fs_id)
            .await?;

        let presence_values = calculations::build_presence_values_map(&line_items);

        let mut all_flags = Vec::new();

        let coop_type = CooperativeType::parse(cooperative_type).unwrap_or(CooperativeType::Other);
        let required_codes = self.coa_repo.find_required_by_coop_type(&coop_type).await?;
        all_flags.extend(flags::check_missing_required(
            &required_codes,
            &presence_values,
        ));
        all_flags.extend(flags::run_low_flags(&presence_values));

        for month in 0..=12 {
            let month_values = calculations::build_values_map_for_month(&line_items, month as i16);
            if month_values.is_empty() {
                continue;
            }

            let month_label = match month {
                0 => "Dec (Prev)",
                1 => "Jan",
                2 => "Feb",
                3 => "Mar",
                4 => "Apr",
                5 => "May",
                6 => "Jun",
                7 => "Jul",
                8 => "Aug",
                9 => "Sep",
                10 => "Oct",
                11 => "Nov",
                12 => "Dec",
                _ => "Unknown Month",
            };

            let mut month_flags = Vec::new();
            month_flags.extend(sum_checks::run_sum_checks(coa, &month_values));
            month_flags.extend(flags::run_critical_flags(&month_values));
            month_flags.extend(flags::run_high_flags(&month_values));
            month_flags.extend(flags::run_medium_flags(&month_values));
            month_flags.extend(flags::run_special_flags(&month_values));

            for mut flag in month_flags {
                flag.message = format!("{}: {}", month_label, flag.message);
                all_flags.push(flag);
            }
        }

        // MED-014: rounding inconsistency (values with > 2 decimal places)
        for item in &line_items {
            if let Some(val) = item.value {
                let frac = val.fract().abs();
                if frac > rust_decimal::Decimal::new(1, 2) {
                    all_flags.push(calculations::flag(
                        "MED-014",
                        "medium",
                        format!(
                            "Value {} for account {} has more than 2 decimal places. Possible currency/formatting issue.",
                            val,
                            item.account_code.map(|c| c.to_string()).unwrap_or_else(|| "unknown".into())
                        ),
                        item.account_code.map(|c| c.to_string()),
                    ));
                    break; // flag once per statement, not per item
                }
            }
        }

        self.flag_repo.delete_by_submission(submission_id).await?;

        // LOW-005: emit all-clear only when no flags from any other category
        if all_flags.is_empty() {
            all_flags.push(calculations::flag(
                "LOW-005",
                "low",
                "No abnormalities detected. Your financial statement appears complete and consistent.".into(),
                None,
            ));
        } else {
            // Remove LOW-001 and LOW-005 stubs emitted by run_low_flags since real flags exist —
            // LOW-001 is still informational so keep it; just drop the empty-map LOW-005.
            all_flags.retain(|f| f.rule_id != "LOW-005");
        }

        let active_models: Vec<abnormality_flag::ActiveModel> = all_flags
            .iter()
            .map(|f| abnormality_flag::ActiveModel {
                id: sea_orm::ActiveValue::Set(Uuid::new_v4()),
                submission_id: sea_orm::ActiveValue::Set(submission_id),
                cooperative_id: sea_orm::ActiveValue::Set(cooperative_id),
                rule_id: sea_orm::ActiveValue::Set(f.rule_id.clone()),
                severity: sea_orm::ActiveValue::Set(f.severity.clone()),
                message: sea_orm::ActiveValue::Set(f.message.clone()),
                field_ref: sea_orm::ActiveValue::Set(f.field_ref.clone()),
                created_at: sea_orm::ActiveValue::Set(chrono::Utc::now()),
            })
            .collect();
        self.flag_repo.bulk_create(active_models).await?;

        let (errors, warnings) = all_flags
            .into_iter()
            .partition(|f| f.severity == "critical" || f.severity == "high");

        Ok((errors, warnings))
    }
}
