import React, { useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  useExchangeRateHistory,
  useExchangeRateList,
  useUpdateExchangeRate,
} from "@/hooks/settings/useExchangeRateAdmin";

const EDITABLE_CURRENCY = "SZL";

const formatDate = (iso: string): string => new Date(iso).toLocaleDateString("en-GB");
const formatDateTime = (iso: string): string => new Date(iso).toLocaleString("en-GB");

export const ExchangeRateSettings: React.FC = () => {
  const { data: rates, isLoading } = useExchangeRateList();
  const { data: history } = useExchangeRateHistory();
  const update = useUpdateExchangeRate();

  const current = rates?.find((r) => r.currency_code === EDITABLE_CURRENCY);
  const [rate, setRate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [sourceNote, setSourceNote] = useState("");

  const parsedRate = Number(rate);
  const canSave =
    rate.trim() !== "" &&
    Number.isFinite(parsedRate) &&
    parsedRate > 0 &&
    sourceNote.trim().length > 0 &&
    !update.isPending;

  const handleSave = () => {
    update.mutate(
      {
        currency_code: EDITABLE_CURRENCY,
        rate_to_usd: parsedRate,
        effective_date: effectiveDate,
        source_note: sourceNote.trim(),
      },
      {
        onSuccess: () => {
          toast.success("Exchange rate updated");
          setRate("");
          setSourceNote("");
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted-foreground">
        <Spinner size="md" /> Loading exchange rates…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card
        title="SZL / USD exchange rate"
        subtitle="All analytics are converted to USD at this rate"
        info="A submission freezes the rate in force at the moment it is approved, so its USD figures never change afterwards. Changing the rate here only affects drafts and submissions approved later."
      >
        <div className="space-y-4">
          {current && (
            <p className="text-sm">
              Current rate: <strong>1 USD = {current.rate_to_usd} SZL</strong> (effective{" "}
              {formatDate(current.effective_date)}
              {current.source_note ? `, source: ${current.source_note}` : ""})
            </p>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="fx-rate">SZL per 1 USD</Label>
              <Input
                id="fx-rate"
                type="number"
                min="0"
                step="0.0001"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="e.g. 18.5"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fx-date">Effective date</Label>
              <Input
                id="fx-date"
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fx-source">Source (required)</Label>
              <Input
                id="fx-source"
                value={sourceNote}
                onChange={(e) => setSourceNote(e.target.value)}
                placeholder="e.g. Central Bank of Eswatini, 24 Sep 2026"
              />
            </div>
          </div>
          <Button onClick={handleSave} disabled={!canSave}>
            {update.isPending ? "Saving…" : "Save rate"}
          </Button>
        </div>
      </Card>

      <Card title="Change history" subtitle="Every rate change, newest first">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-4">Changed at</th>
                <th className="py-2 pr-4">Currency</th>
                <th className="py-2 pr-4">Rate (per 1 USD)</th>
                <th className="py-2 pr-4">Effective</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2">Changed by</th>
              </tr>
            </thead>
            <tbody>
              {(history ?? []).map((h) => (
                <tr key={h.id} className="border-b border-border/50">
                  <td className="py-2 pr-4">{formatDateTime(h.changed_at)}</td>
                  <td className="py-2 pr-4">{h.currency_code}</td>
                  <td className="py-2 pr-4 font-mono">{h.rate_to_usd}</td>
                  <td className="py-2 pr-4">{formatDate(h.effective_date)}</td>
                  <td className="py-2 pr-4">{h.source_note ?? "—"}</td>
                  <td className="py-2 font-mono">
                    {h.changed_by ? h.changed_by.slice(0, 8) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
