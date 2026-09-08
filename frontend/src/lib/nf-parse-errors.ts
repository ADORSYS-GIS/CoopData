/**
 * Human-readable guidance for each non-financial parse error rule.
 * Each entry explains what the error means and how the user can fix it.
 */

export interface RuleGuidance {
  /** Short human title for the rule. */
  title: string;
  /** Plain-language explanation of what went wrong. */
  description: string;
  /** Concrete steps the user can take to fix it. */
  fix: string;
}

const RULE_GUIDANCE: Record<string, RuleGuidance> = {
  MISSING_HEADERS: {
    title: "Missing required columns",
    description:
      "The sheet is missing one or more columns that are required to import this section. Without these columns the system cannot identify the data.",
    fix: "Add the missing column(s) to the sheet and re-upload. The column names are listed in the message. Common names are accepted (e.g. 'Member CODE', 'Open Date', 'Account CODE').",
  },
  MISSING_REQUIRED: {
    title: "Row is incomplete",
    description:
      "This row is missing one or more required fields (such as a member ID, an account/loan ID, or a date), so it cannot be imported.",
    fix: "Open the sheet, find the row number shown, and fill in the missing required fields. Then re-upload the file.",
  },
  INVALID_ENUM: {
    title: "Invalid value",
    description:
      "The value in this cell is not one of the accepted options for that field, so the row was skipped.",
    fix: "Correct the value to one of the accepted options (shown in the message) and re-upload. For example, member status must be one of: Active, Dormant, Exited, Deceased.",
  },
  LOAN_WITHOUT_MEMBER: {
    title: "Loan references an unknown member",
    description:
      "This loan is linked to a member ID that does not appear in the membership (members) sheet, so the loan cannot be attached to a member.",
    fix: "Make sure the member exists in the membership sheet, or correct the member ID on this loan row so it matches a member in the membership sheet. Then re-upload.",
  },
  SAVINGS_WITHOUT_MEMBER: {
    title: "Savings account references an unknown member",
    description:
      "This savings account is linked to a member ID that does not appear in the membership (members) sheet, so it cannot be attached to a member.",
    fix: "Make sure the member exists in the membership sheet, or correct the member ID on this savings row so it matches a member in the membership sheet. Then re-upload.",
  },
  FIXED_DEPOSIT_WITHOUT_MEMBER: {
    title: "Fixed deposit references an unknown member",
    description:
      "This fixed deposit is linked to a member ID that does not appear in the membership (members) sheet, so it cannot be attached to a member.",
    fix: "Make sure the member exists in the membership sheet, or correct the member ID on this fixed deposit row so it matches a member in the membership sheet. Then re-upload.",
  },
  EXIT_BEFORE_JOIN: {
    title: "Exit date is before join date",
    description: "The member's exit date is earlier than their join date, which is not possible.",
    fix: "Correct the exit date (or join date) on this row so the exit date is on or after the join date. Then re-upload.",
  },
  MATURITY_BEFORE_START: {
    title: "Maturity date is before start date",
    description:
      "The maturity date is earlier than the start date, which is not possible for a loan or fixed deposit.",
    fix: "Correct the maturity date (or start date) on this row so the maturity date is on or after the start date. Then re-upload.",
  },
  DPD_STATUS_MISMATCH: {
    title: "Loan status and days-past-due conflict",
    description:
      "The loan is marked as 'Performing' but has a non-zero days-past-due (DPD) category, which is contradictory.",
    fix: "Either set the loan status to a non-performing status, or set the DPD category to 0. Then re-upload.",
  },
  MEMBER_COUNT_DRIFT: {
    title: "Member count differs from existing data",
    description:
      "The number of members in the uploaded file does not match the number already stored for this cooperative.",
    fix: "Review the membership sheet to ensure it contains the complete and correct member list, then re-upload.",
  },
};

/** Returns guidance for a rule, or a generic fallback if unknown. */
export function ruleGuidance(rule: string): RuleGuidance {
  const known = RULE_GUIDANCE[rule];
  if (known) return known;
  return {
    title: rule,
    description:
      "This row was flagged during validation and was not imported. Review the row and the message for details.",
    fix: "Correct the issue described in the message and re-upload the file.",
  };
}

/** A short, human-readable label for a rule (falls back to the raw rule). */
export function ruleTitle(rule: string): string {
  return RULE_GUIDANCE[rule]?.title ?? rule;
}
