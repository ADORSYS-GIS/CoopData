//! NF Indicator Engine — computes non-financial indicators from NF database tables.
//!
//! Queries members, savings, loans, fixed_deposits, and farm_coop tables
//! to derive aggregate statistics and penetration ratios for the analytics page.
//! Unlike KpiEngine (pure computation), this engine requires database access
//! because it aggregates across raw NF records.

use chrono::Utc;
use rust_decimal::prelude::ToPrimitive;
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use uuid::Uuid;

use crate::entities::enums::{AgeGroup, Gender, LoanStatus, MemberStatus};
use crate::entities::farm_coop;
use crate::entities::fixed_deposit;
use crate::entities::loan;
use crate::entities::member;
use crate::entities::savings_account;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct MembershipStats {
    pub total: u64,
    pub active: u64,
    pub dormant: u64,
    pub exited: u64,
    pub male: u64,
    pub female: u64,
    pub other: u64,
    pub under_18: u64,
    pub age_18_35: u64,
    pub age_36_50: u64,
    pub over_50: u64,
    pub urban: u64,
    pub rural: u64,
    pub agm_attendance: u64,
    pub leadership_count: u64,
    pub voting_count: u64,
    pub active_pct: f64,
    pub dormancy_pct: f64,
    pub exit_pct: f64,
    pub male_pct: f64,
    pub female_pct: f64,
    pub other_pct: f64,
    pub youth_pct: f64,
    pub adult_pct: f64,
    pub urban_pct: f64,
    pub rural_pct: f64,
    pub agm_participation_pct: f64,
    pub women_in_governance_pct: f64,
    pub youth_in_governance_pct: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct SavingsStats {
    pub total_accounts: u64,
    pub active_accounts: u64,
    pub dormant_accounts: u64,
    pub zero_balance_count: u64,
    pub increasing_trend: u64,
    pub stable_trend: u64,
    pub declining_trend: u64,
    pub high_withdrawal_count: u64,
    pub emergency_withdrawal_count: u64,
    pub total_balance: f64,
    pub average_balance: f64,
    pub savings_penetration_pct: f64,
    pub active_savers_pct: f64,
    pub dormant_savings_pct: f64,
    pub zero_balance_pct: f64,
    pub increasing_trend_pct: f64,
    pub regular_savers_pct: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct LoanStats {
    pub total_loans: u64,
    pub active_loans: u64,
    pub performing: u64,
    pub arrears: u64,
    pub restructured: u64,
    pub written_off: u64,
    pub members_with_loans: u64,
    pub youth_borrowers: u64,
    pub women_borrowers: u64,
    pub rural_borrowers: u64,
    pub multiple_loan_count: u64,
    pub large_borrower_count: u64,
    pub total_balance: f64,
    pub total_loan_amount: f64,
    pub average_loan_size: f64,
    pub on_time_repayment_pct: f64,
    pub arrears_rate_pct: f64,
    pub restructured_pct: f64,
    pub credit_penetration_pct: f64,
    pub youth_borrower_pct: f64,
    pub women_borrower_pct: f64,
    pub rural_borrower_pct: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct FixedDepositStats {
    pub total_fds: u64,
    pub active_fds: u64,
    pub matured_fds: u64,
    pub withdrawn_fds: u64,
    pub rolled_over_fds: u64,
    pub members_with_fds: u64,
    pub early_withdrawal_count: u64,
    pub single_depositor_count: u64,
    pub total_balance: f64,
    pub average_balance: f64,
    pub fd_penetration_pct: f64,
    pub early_withdrawal_pct: f64,
    pub rollover_rate_pct: f64,
    pub concentration_risk_pct: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct FarmCoopStats {
    pub total_coops: u64,
    pub active_producers: u64,
    pub using_planning: u64,
    pub using_shared_inputs: u64,
    pub with_offtake_agreement: u64,
    pub with_storage: u64,
    pub with_processing: u64,
    pub with_irrigation: u64,
    pub with_climate_mitigation: u64,
    pub active_producer_pct: f64,
    pub planning_adoption_pct: f64,
    pub shared_services_pct: f64,
    pub formal_offtake_pct: f64,
    pub storage_coverage_pct: f64,
    pub processing_access_pct: f64,
    pub irrigation_coverage_pct: f64,
    pub climate_mitigation_pct: f64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct NfStatisticsResponse {
    pub membership: MembershipStats,
    pub savings: SavingsStats,
    pub loans: LoanStats,
    pub fixed_deposits: FixedDepositStats,
    pub farm_coop: FarmCoopStats,
    pub computed_at: chrono::DateTime<Utc>,
}

fn pct(part: u64, total: u64) -> f64 {
    if total == 0 {
        0.0
    } else {
        (part as f64 / total as f64) * 100.0
    }
}

pub struct NfIndicatorEngine;

impl NfIndicatorEngine {
    pub async fn compute(
        db: &DatabaseConnection,
        cooperative_id: Uuid,
    ) -> crate::error::AppResult<NfStatisticsResponse> {
        use crate::entities::submission;
        use sea_orm::{QueryFilter, QueryOrder, EntityTrait, ColumnTrait};

        let latest_approved = submission::Entity::find()
            .filter(submission::Column::CooperativeId.eq(cooperative_id))
            .filter(submission::Column::Status.eq(crate::entities::enums::SubmissionStatus::Approved))
            .order_by_desc(submission::Column::ReportingYear)
            .one(db)
            .await?;

        if let Some(sub) = latest_approved {
            Self::compute_for_submission(db, cooperative_id, Some(sub.id)).await
        } else {
            // If there's no approved submission, compute with a dummy non-existent ID
            // so that it safely returns zero for all metrics.
            Self::compute_for_submission(db, cooperative_id, Some(Uuid::nil())).await
        }
    }

    pub async fn compute_for_submission(
        db: &DatabaseConnection,
        cooperative_id: Uuid,
        submission_id: Option<Uuid>,
    ) -> crate::error::AppResult<NfStatisticsResponse> {
        let (membership, savings, loans, fixed_deposits, farm_coop) = tokio::join!(
            Self::compute_membership(db, cooperative_id, submission_id),
            Self::compute_savings(db, cooperative_id, submission_id),
            Self::compute_loans(db, cooperative_id, submission_id),
            Self::compute_fixed_deposits(db, cooperative_id, submission_id),
            Self::compute_farm_coop(db, cooperative_id, submission_id),
        );

        let membership = membership?;
        let mut savings = savings?;
        let mut loans = loans?;
        let mut fixed_deposits = fixed_deposits?;
        let farm_coop = farm_coop?;

        // Patch penetration rates now that we have membership total
        let total_members = membership.total;
        if total_members > 0 {
            savings.savings_penetration_pct = pct(
                Self::count_unique_members_with_savings(db, cooperative_id, submission_id).await?,
                total_members,
            );
            loans.credit_penetration_pct = pct(loans.members_with_loans, total_members);
            fixed_deposits.fd_penetration_pct = pct(fixed_deposits.members_with_fds, total_members);
        }

        Ok(NfStatisticsResponse {
            membership,
            savings,
            loans,
            fixed_deposits,
            farm_coop,
            computed_at: Utc::now(),
        })
    }

    async fn compute_membership(
        db: &DatabaseConnection,
        cooperative_id: Uuid,
        submission_id: Option<Uuid>,
    ) -> crate::error::AppResult<MembershipStats> {
        use member::Column as C;

        let mut query = member::Entity::find().filter(C::CooperativeId.eq(cooperative_id));
        if let Some(submission_id) = submission_id {
            query = query.filter(C::SubmissionId.eq(submission_id));
        }
        let all = query.all(db).await?;

        let total = all.len() as u64;
        let active = all
            .iter()
            .filter(|m| m.status == MemberStatus::Active)
            .count() as u64;
        let dormant = all
            .iter()
            .filter(|m| m.status == MemberStatus::Dormant)
            .count() as u64;
        let exited = all
            .iter()
            .filter(|m| m.status == MemberStatus::Exited)
            .count() as u64;

        let male = all.iter().filter(|m| m.gender == Gender::Male).count() as u64;
        let female = all.iter().filter(|m| m.gender == Gender::Female).count() as u64;
        let other = all.iter().filter(|m| m.gender == Gender::Other).count() as u64;

        let under_18 = all
            .iter()
            .filter(|m| m.age_group == AgeGroup::Under18)
            .count() as u64;
        let age_18_35 = all
            .iter()
            .filter(|m| m.age_group == AgeGroup::Between18And35)
            .count() as u64;
        let age_36_50 = all
            .iter()
            .filter(|m| m.age_group == AgeGroup::Between36And50)
            .count() as u64;
        let over_50 = all
            .iter()
            .filter(|m| m.age_group == AgeGroup::Over50)
            .count() as u64;

        let urban = all
            .iter()
            .filter(|m| m.urban_rural.as_str() == "Urban")
            .count() as u64;
        let rural = all
            .iter()
            .filter(|m| m.urban_rural.as_str() == "Rural")
            .count() as u64;

        let agm_attendance = all.iter().filter(|m| m.agm_attendance).count() as u64;
        let leadership_count = all.iter().filter(|m| m.leadership_role.is_some()).count() as u64;
        let voting_count = all.iter().filter(|m| m.voting_exercised).count() as u64;

        let women_leaders = all
            .iter()
            .filter(|m| m.gender == Gender::Female && m.leadership_role.is_some())
            .count() as u64;
        let youth_leaders = all
            .iter()
            .filter(|m| {
                matches!(m.age_group, AgeGroup::Under18 | AgeGroup::Between18And35)
                    && m.leadership_role.is_some()
            })
            .count() as u64;

        Ok(MembershipStats {
            total,
            active,
            dormant,
            exited,
            male,
            female,
            other,
            under_18,
            age_18_35,
            age_36_50,
            over_50,
            urban,
            rural,
            agm_attendance,
            leadership_count,
            voting_count,
            active_pct: pct(active, total),
            dormancy_pct: pct(dormant, total),
            exit_pct: pct(exited, total),
            male_pct: pct(male, total),
            female_pct: pct(female, total),
            other_pct: pct(other, total),
            youth_pct: pct(under_18 + age_18_35, total),
            adult_pct: pct(age_36_50 + over_50, total),
            urban_pct: pct(urban, total),
            rural_pct: pct(rural, total),
            agm_participation_pct: pct(agm_attendance, total),
            women_in_governance_pct: pct(women_leaders, leadership_count),
            youth_in_governance_pct: pct(youth_leaders, leadership_count),
        })
    }

    async fn compute_savings(
        db: &DatabaseConnection,
        cooperative_id: Uuid,
        submission_id: Option<Uuid>,
    ) -> crate::error::AppResult<SavingsStats> {
        use savings_account::Column as C;

        let mut query = savings_account::Entity::find().filter(C::CooperativeId.eq(cooperative_id));
        if let Some(submission_id) = submission_id {
            query = query.filter(C::SubmissionId.eq(submission_id));
        }
        let all = query.all(db).await?;

        let total_accounts = all.len() as u64;
        let active_accounts = all.iter().filter(|s| s.account_status == "Active").count() as u64;
        let dormant_accounts = all.iter().filter(|s| s.account_status == "Dormant").count() as u64;
        let zero_balance_count = all.iter().filter(|s| s.zero_balance_flag).count() as u64;

        let increasing_trend = all
            .iter()
            .filter(|s| s.balance_trend == "Increasing")
            .count() as u64;
        let stable_trend = all.iter().filter(|s| s.balance_trend == "Stable").count() as u64;
        let declining_trend = all
            .iter()
            .filter(|s| s.balance_trend == "Declining")
            .count() as u64;

        let high_withdrawal_count = all
            .iter()
            .filter(|s| s.withdrawal_frequency_category == "High")
            .count() as u64;
        let emergency_withdrawal_count =
            all.iter().filter(|s| s.emergency_withdrawals_flag).count() as u64;

        let total_balance: f64 = all.iter().filter_map(|s| s.balance.to_f64()).sum();
        let average_balance = if total_accounts > 0 {
            total_balance / total_accounts as f64
        } else {
            0.0
        };

        let _unique_members_with_savings: u64 = {
            let mut set = std::collections::HashSet::new();
            for s in &all {
                set.insert(s.member_id);
            }
            set.len() as u64
        };

        let regular_savers = all
            .iter()
            .filter(|s| matches!(s.contribution_frequency.as_str(), "Monthly" | "Quarterly"))
            .count() as u64;

        Ok(SavingsStats {
            total_accounts,
            active_accounts,
            dormant_accounts,
            zero_balance_count,
            increasing_trend,
            stable_trend,
            declining_trend,
            high_withdrawal_count,
            emergency_withdrawal_count,
            total_balance,
            average_balance,
            savings_penetration_pct: 0.0, // patched in compute() after membership total is known
            active_savers_pct: pct(active_accounts, total_accounts),
            dormant_savings_pct: pct(dormant_accounts, total_accounts),
            zero_balance_pct: pct(zero_balance_count, total_accounts),
            increasing_trend_pct: pct(increasing_trend, active_accounts),
            regular_savers_pct: pct(regular_savers, total_accounts),
        })
    }

    async fn compute_loans(
        db: &DatabaseConnection,
        cooperative_id: Uuid,
        submission_id: Option<Uuid>,
    ) -> crate::error::AppResult<LoanStats> {
        use loan::Column as C;

        let mut query = loan::Entity::find().filter(C::CooperativeId.eq(cooperative_id));
        if let Some(submission_id) = submission_id {
            query = query.filter(C::SubmissionId.eq(submission_id));
        }
        let all = query.all(db).await?;

        let total_loans = all.len() as u64;
        let active_loans = all
            .iter()
            .filter(|l| l.loan_status != LoanStatus::WrittenOff)
            .count() as u64;
        let performing = all
            .iter()
            .filter(|l| l.loan_status == LoanStatus::Performing)
            .count() as u64;
        let arrears = all
            .iter()
            .filter(|l| l.loan_status == LoanStatus::Arrears)
            .count() as u64;
        let restructured = all
            .iter()
            .filter(|l| l.loan_status == LoanStatus::Restructured)
            .count() as u64;
        let written_off = all
            .iter()
            .filter(|l| l.loan_status == LoanStatus::WrittenOff)
            .count() as u64;

        let on_time = all
            .iter()
            .filter(|l| l.repayment_regularity == "Regular")
            .count() as u64;

        let youth_borrowers = all.iter().filter(|l| l.youth_borrower_flag).count() as u64;
        let women_borrowers = all.iter().filter(|l| l.women_borrower_flag).count() as u64;
        let rural_borrowers = all.iter().filter(|l| l.rural_borrower_flag).count() as u64;
        let multiple_loan_count = all.iter().filter(|l| l.multiple_loans_flag).count() as u64;
        let large_borrower_count = all.iter().filter(|l| l.large_borrower_flag).count() as u64;

        let total_balance: f64 = all.iter().filter_map(|l| l.balance.to_f64()).sum();
        let total_loan_amount: f64 = all.iter().filter_map(|l| l.loan_amount.to_f64()).sum();
        let average_loan_size = if active_loans > 0 {
            total_balance / active_loans as f64
        } else {
            0.0
        };

        let unique_borrowers: u64 = {
            let mut set = std::collections::HashSet::new();
            for l in &all {
                set.insert(l.member_id);
            }
            set.len() as u64
        };

        Ok(LoanStats {
            total_loans,
            active_loans,
            performing,
            arrears,
            restructured,
            written_off,
            members_with_loans: unique_borrowers,
            youth_borrowers,
            women_borrowers,
            rural_borrowers,
            multiple_loan_count,
            large_borrower_count,
            total_balance,
            total_loan_amount,
            average_loan_size,
            on_time_repayment_pct: pct(on_time, active_loans),
            arrears_rate_pct: pct(arrears, active_loans),
            restructured_pct: pct(restructured, total_loans),
            credit_penetration_pct: 0.0, // patched in compute() after membership total is known
            youth_borrower_pct: pct(youth_borrowers, active_loans),
            women_borrower_pct: pct(women_borrowers, active_loans),
            rural_borrower_pct: pct(rural_borrowers, active_loans),
        })
    }

    async fn compute_fixed_deposits(
        db: &DatabaseConnection,
        cooperative_id: Uuid,
        submission_id: Option<Uuid>,
    ) -> crate::error::AppResult<FixedDepositStats> {
        use fixed_deposit::Column as C;

        let mut query = fixed_deposit::Entity::find().filter(C::CooperativeId.eq(cooperative_id));
        if let Some(submission_id) = submission_id {
            query = query.filter(C::SubmissionId.eq(submission_id));
        }
        let all = query.all(db).await?;

        let total_fds = all.len() as u64;
        let active_fds = all.iter().filter(|f| f.status.as_str() == "Active").count() as u64;
        let matured_fds = all
            .iter()
            .filter(|f| f.status.as_str() == "Matured")
            .count() as u64;
        let withdrawn_fds = all
            .iter()
            .filter(|f| f.status.as_str() == "Withdrawn")
            .count() as u64;
        let rolled_over_fds = all
            .iter()
            .filter(|f| f.status.as_str() == "RolledOver")
            .count() as u64;

        let early_withdrawal_count = all.iter().filter(|f| f.early_withdrawal_flag).count() as u64;
        let single_depositor_count = all
            .iter()
            .filter(|f| f.single_depositor_dependency_flag)
            .count() as u64;

        let total_balance: f64 = all.iter().filter_map(|f| f.balance.to_f64()).sum();
        let average_balance = if total_fds > 0 {
            total_balance / total_fds as f64
        } else {
            0.0
        };

        let unique_members_with_fds: u64 = {
            let mut set = std::collections::HashSet::new();
            for f in &all {
                set.insert(f.member_id);
            }
            set.len() as u64
        };

        let matured_or_rolled = matured_fds + rolled_over_fds;
        let _long_term_fds = all.iter().filter(|f| f.tenure_category == "Long").count() as u64;

        Ok(FixedDepositStats {
            total_fds,
            active_fds,
            matured_fds,
            withdrawn_fds,
            rolled_over_fds,
            members_with_fds: unique_members_with_fds,
            early_withdrawal_count,
            single_depositor_count,
            total_balance,
            average_balance,
            fd_penetration_pct: 0.0, // patched in compute() after membership total is known
            early_withdrawal_pct: pct(early_withdrawal_count, total_fds),
            rollover_rate_pct: pct(rolled_over_fds, matured_or_rolled),
            concentration_risk_pct: pct(single_depositor_count, total_fds),
        })
    }

    async fn count_unique_members_with_savings(
        db: &DatabaseConnection,
        cooperative_id: Uuid,
        submission_id: Option<Uuid>,
    ) -> crate::error::AppResult<u64> {
        use savings_account::Column as C;
        let mut query = savings_account::Entity::find().filter(C::CooperativeId.eq(cooperative_id));
        if let Some(submission_id) = submission_id {
            query = query.filter(C::SubmissionId.eq(submission_id));
        }
        let all = query.all(db).await?;
        let mut set = std::collections::HashSet::new();
        for s in &all {
            set.insert(s.member_id);
        }
        Ok(set.len() as u64)
    }

    async fn compute_farm_coop(
        db: &DatabaseConnection,
        cooperative_id: Uuid,
        submission_id: Option<Uuid>,
    ) -> crate::error::AppResult<FarmCoopStats> {
        use farm_coop::Column as C;

        let mut query = farm_coop::Entity::find().filter(C::CooperativeId.eq(cooperative_id));
        if let Some(submission_id) = submission_id {
            query = query.filter(C::SubmissionId.eq(submission_id));
        }
        let all = query.all(db).await?;

        let total = all.len() as u64;
        let active_producers = all.iter().filter(|f| f.active_producer_flag).count() as u64;
        let using_planning = all.iter().filter(|f| f.use_of_production_planning).count() as u64;
        let using_shared_inputs = all.iter().filter(|f| f.use_of_shared_inputs).count() as u64;
        let with_offtake = all.iter().filter(|f| f.formal_offtake_agreement).count() as u64;
        let with_storage = all.iter().filter(|f| f.access_to_storage).count() as u64;
        let with_processing = all
            .iter()
            .filter(|f| f.access_to_processing_facilities)
            .count() as u64;
        let with_irrigation = all.iter().filter(|f| f.irrigation_access).count() as u64;
        let with_climate = all
            .iter()
            .filter(|f| {
                f.climate_mitigation_practices != "None"
                    && !f.climate_mitigation_practices.is_empty()
            })
            .count() as u64;

        Ok(FarmCoopStats {
            total_coops: total,
            active_producers,
            using_planning,
            using_shared_inputs,
            with_offtake_agreement: with_offtake,
            with_storage,
            with_processing,
            with_irrigation,
            with_climate_mitigation: with_climate,
            active_producer_pct: pct(active_producers, total),
            planning_adoption_pct: pct(using_planning, total),
            shared_services_pct: pct(using_shared_inputs, total),
            formal_offtake_pct: pct(with_offtake, total),
            storage_coverage_pct: pct(with_storage, total),
            processing_access_pct: pct(with_processing, total),
            irrigation_coverage_pct: pct(with_irrigation, total),
            climate_mitigation_pct: pct(with_climate, total),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pct_zero_total() {
        assert!((pct(5, 0) - 0.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_pct_normal() {
        let result = pct(3, 10);
        assert!((result - 30.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_pct_full() {
        let result = pct(100, 100);
        assert!((result - 100.0).abs() < f64::EPSILON);
    }
}
