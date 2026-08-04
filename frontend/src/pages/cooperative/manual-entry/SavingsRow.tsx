import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WizardSavings } from "./types";

interface SavingsRowProps {
  record: WizardSavings;
  idx: number;
  memberIds: string[];
  onUpdate: (key: string, field: keyof WizardSavings, value: unknown) => void;
  onRemove: (key: string) => void;
}

export function SavingsRow({ record, idx, memberIds, onUpdate, onRemove }: SavingsRowProps) {
  const { t } = useTranslation();

  return (
    <tr className="border-t border-border/50 hover:bg-muted/20 transition-colors">
      <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{idx + 1}</td>
      <td className="px-2 py-2">
        <select
          value={record.memberBusinessId}
          onChange={(e) => onUpdate(record._rowKey, "memberBusinessId", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground font-mono"
        >
          <option value="">{t("savingsRow.selectMember")}</option>
          {memberIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          value={record.savingsAccountId}
          onChange={(e) => onUpdate(record._rowKey, "savingsAccountId", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 font-mono"
          placeholder={t("manualEntry.placeholderSavingsId")}
        />
      </td>
      <td className="px-2 py-2">
        <select
          value={record.accountType}
          onChange={(e) => onUpdate(record._rowKey, "accountType", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground"
        >
          <option value="Voluntary">{t("savingsRow.types.voluntary")}</option>
          <option value="Mandatory">{t("savingsRow.types.mandatory")}</option>
          <option value="Fixed">{t("savingsRow.types.fixed")}</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="date"
          value={record.accountOpeningDate}
          onChange={(e) => onUpdate(record._rowKey, "accountOpeningDate", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5"
        />
      </td>
      <td className="px-2 py-2">
        <select
          value={record.accountStatus}
          onChange={(e) => onUpdate(record._rowKey, "accountStatus", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground"
        >
          <option value="Active">{t("savingsRow.statuses.active")}</option>
          <option value="Inactive">{t("savingsRow.statuses.inactive")}</option>
          <option value="Closed">{t("savingsRow.statuses.closed")}</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <select
          value={record.contributionFrequency}
          onChange={(e) => onUpdate(record._rowKey, "contributionFrequency", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground"
        >
          <option value="Monthly">{t("savingsRow.frequencies.monthly")}</option>
          <option value="Weekly">{t("savingsRow.frequencies.weekly")}</option>
          <option value="Daily">{t("savingsRow.frequencies.daily")}</option>
          <option value="Irregular">{t("savingsRow.frequencies.irregular")}</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="date"
          value={record.lastContributionDate}
          onChange={(e) => onUpdate(record._rowKey, "lastContributionDate", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="number"
          value={record.numberOfContributions}
          onChange={(e) =>
            onUpdate(record._rowKey, "numberOfContributions", Number(e.target.value))
          }
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 font-mono"
        />
      </td>
      <td className="px-2 py-2">
        <select
          value={record.balanceTrend}
          onChange={(e) => onUpdate(record._rowKey, "balanceTrend", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground"
        >
          <option value="Stable">{t("savingsRow.trends.stable")}</option>
          <option value="Increasing">{t("savingsRow.trends.increasing")}</option>
          <option value="Decreasing">{t("savingsRow.trends.decreasing")}</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="number"
          step="0.01"
          placeholder="0.05"
          value={record.interestRate}
          onChange={(e) => onUpdate(record._rowKey, "interestRate", Number(e.target.value))}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 font-mono"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="number"
          placeholder="0.00"
          value={record.balance}
          onChange={(e) => onUpdate(record._rowKey, "balance", Number(e.target.value))}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 font-mono"
        />
      </td>
      <td className="px-2 py-2">
        <button
          onClick={() => onRemove(record._rowKey)}
          className="size-7 rounded-lg grid place-items-center text-danger hover:bg-danger/10 transition-colors text-sm"
        >
          <Trash2 className="size-3.5" />
        </button>
      </td>
    </tr>
  );
}
