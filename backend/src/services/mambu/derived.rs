//! Indicators CoopData asks for that can be counted from the member list, so nobody has
//! to enter them by hand for a SACCO that is synced from Mambu.

use chrono::NaiveDate;
use rust_decimal::Decimal;
use sea_orm::Set;
use uuid::Uuid;

use crate::entities::enums::{Gender, MemberStatus};
use crate::entities::non_financial_indicator_entry;
use crate::error::AppResult;
use crate::services::nf_excel_parser::MemberRecord;
use crate::AppState;

pub const NEW_MEMBERS_JOINED: &str = "new_members_joined";
pub const MEMBERS_EXITED: &str = "members_exited";
pub const WOMEN_MEMBERS_COUNT: &str = "women_members_count";
pub const YOUTH_MEMBERS_COUNT: &str = "youth_members_count";
pub const TOTAL_BOARD_MEMBERS: &str = "total_board_members";
pub const FEMALE_BOARD_MEMBERS: &str = "female_board_members";

fn in_period(date: NaiveDate, from: NaiveDate, to: NaiveDate) -> bool {
    date >= from && date <= to
}

/// Counts for the period from `from` to `to`. Joined and exited members are counted in
/// the period; women and youth members are those still in the SACCO.
pub fn indicator_values(
    members: &[MemberRecord],
    from: NaiveDate,
    to: NaiveDate,
) -> Vec<(&'static str, i64)> {
    let in_sacco =
        |m: &&MemberRecord| !matches!(m.status, MemberStatus::Exited | MemberStatus::Deceased);
    let joined = members
        .iter()
        .filter(|m| in_period(m.join_date, from, to))
        .count();
    let exited = members
        .iter()
        .filter(|m| m.exit_date.is_some_and(|d| in_period(d, from, to)))
        .count();
    let women = members
        .iter()
        .filter(in_sacco)
        .filter(|m| m.gender == Gender::Female)
        .count();
    let youth = members
        .iter()
        .filter(in_sacco)
        .filter(|m| m.age_group.is_youth())
        .count();
    let board = members
        .iter()
        .filter(in_sacco)
        .filter(|m| m.leadership_role.is_some());
    let board_total = board.clone().count();
    let board_women = board.filter(|m| m.gender == Gender::Female).count();
    vec![
        (TOTAL_BOARD_MEMBERS, board_total as i64),
        (FEMALE_BOARD_MEMBERS, board_women as i64),
        (NEW_MEMBERS_JOINED, joined as i64),
        (MEMBERS_EXITED, exited as i64),
        (WOMEN_MEMBERS_COUNT, women as i64),
        (YOUTH_MEMBERS_COUNT, youth as i64),
    ]
}

/// Saves the counted indicators on the submission. An indicator that is not in the
/// catalog is skipped.
pub async fn save_indicators(
    state: &AppState,
    submission_id: Uuid,
    members: &[MemberRecord],
    from: NaiveDate,
    to: NaiveDate,
) -> AppResult<usize> {
    let catalog = state
        .non_financial_indicator_catalog_repo
        .find_all()
        .await?;
    let now = chrono::Utc::now();
    let entries: Vec<non_financial_indicator_entry::ActiveModel> =
        indicator_values(members, from, to)
            .into_iter()
            .filter_map(|(name, value)| {
                let item = catalog.iter().find(|c| c.indicator_name == name)?;
                Some(non_financial_indicator_entry::ActiveModel {
                    id: Set(Uuid::new_v4()),
                    submission_id: Set(submission_id),
                    catalog_id: Set(item.id),
                    value_numeric: Set(Some(Decimal::from(value))),
                    value_text: Set(None),
                    value_boolean: Set(None),
                    created_at: Set(now),
                    updated_at: Set(now),
                })
            })
            .collect();
    let saved = state
        .non_financial_indicator_entry_repo
        .save_batch(submission_id, entries)
        .await?;
    Ok(saved.len())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entities::enums::{AgeGroup, EswatiniRegion, UrbanRural};

    fn member(
        join: (i32, u32, u32),
        exit: Option<(i32, u32, u32)>,
        status: MemberStatus,
        gender: Gender,
        age: AgeGroup,
    ) -> MemberRecord {
        let date = |(y, m, d): (i32, u32, u32)| NaiveDate::from_ymd_opt(y, m, d).unwrap();
        MemberRecord {
            member_id: "M".into(),
            join_date: date(join),
            status,
            exit_date: exit.map(date),
            gender,
            age_group: age,
            region: EswatiniRegion::Manzini,
            urban_rural: UrbanRural::Unknown,
            agm_attendance: false,
            leadership_role: None,
            voting_exercised: false,
            share_balance: Decimal::ZERO,
        }
    }

    #[test]
    fn indicators_are_counted_for_the_period() {
        let members = vec![
            member(
                (2026, 3, 1),
                None,
                MemberStatus::Active,
                Gender::Female,
                AgeGroup::Between18And35,
            ),
            member(
                (2025, 1, 1),
                None,
                MemberStatus::Dormant,
                Gender::Male,
                AgeGroup::Over50,
            ),
            member(
                (2020, 1, 1),
                Some((2026, 6, 1)),
                MemberStatus::Exited,
                Gender::Female,
                AgeGroup::Between18And35,
            ),
        ];
        let from = NaiveDate::from_ymd_opt(2026, 1, 1).unwrap();
        let to = NaiveDate::from_ymd_opt(2026, 12, 31).unwrap();
        let values = indicator_values(&members, from, to);
        let get = |n: &str| values.iter().find(|(k, _)| *k == n).map(|(_, v)| *v);
        assert_eq!(get(NEW_MEMBERS_JOINED), Some(1));
        assert_eq!(get(MEMBERS_EXITED), Some(1));
        assert_eq!(get(WOMEN_MEMBERS_COUNT), Some(1));
        assert_eq!(get(YOUTH_MEMBERS_COUNT), Some(1));
        assert_eq!(get(TOTAL_BOARD_MEMBERS), Some(0));
    }
}
