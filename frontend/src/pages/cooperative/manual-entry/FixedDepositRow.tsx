import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WizardFixedDeposit } from "./types";

interface FixedDepositRowProps {
  record: WizardFixedDeposit;
  idx: number;
  memberIds: string[];
  onUpdate: (key: string, field: keyof WizardFixedDeposit, value: unknown) => void;
  onRemove: (key: string) => void;
}

export function FixedDepositRow({
  record,
  idx,
  memberIds,
  onUpdate,
  onRemove,
}: FixedDepositRowProps) {
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
          <option value="">{t("fixedDepositRow.selectMember")}</option>
          {memberIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          value={record.fixedDepositId}
          onChange={(e) => onUpdate(record._rowKey, "fixedDepositId", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 font-mono"
          placeholder={t("manualEntry.placeholderDepositId")}
        />
      </td>
      <td className="px-2 py-2">
        <select
          value={record.depositType}
          onChange={(e) => onUpdate(record._rowKey, "depositType", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground"
        >
          <option value="Standard">{t("fixedDepositRow.types.standard")}</option>
          <option value="Special">{t("fixedDepositRow.types.special")}</option>
          <option value="Premium">{t("fixedDepositRow.types.premium")}</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="date"
          value={record.startDate}
          onChange={(e) => onUpdate(record._rowKey, "startDate", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="date"
          value={record.maturityDate}
          onChange={(e) => onUpdate(record._rowKey, "maturityDate", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5"
        />
      </td>
      <td className="px-2 py-2">
        <select
          value={record.status}
          onChange={(e) => onUpdate(record._rowKey, "status", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground"
        >
          <option value="Active">{t("fixedDepositRow.statuses.active")}</option>
          <option value="Matured">{t("fixedDepositRow.statuses.matured")}</option>
          <option value="Withdrawn">{t("fixedDepositRow.statuses.withdrawn")}</option>
          <option value="RolledOver">{t("fixedDepositRow.statuses.rolledOver")}</option>
        </select>
      </td>
      <td className="px-2 py-2">
        <select
          value={record.tenureCategory}
          onChange={(e) => onUpdate(record._rowKey, "tenureCategory", e.target.value)}
          className="w-full text-xs bg-muted/30 border border-border rounded-lg px-2 py-1.5 text-foreground"
        >
          <option value="ShortTerm">{t("fixedDepositRow.tenures.shortTerm")}</option>
          <option value="MediumTerm">{t("fixedDepositRow.tenures.mediumTerm")}</option>
          <option value="LongTerm">{t("fixedDepositRow.tenures.longTerm")}</option>
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
