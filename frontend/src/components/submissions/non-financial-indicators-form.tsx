import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Info, CheckCircle, HelpCircle } from "lucide-react";
import { Card } from "@/components/app-shell";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  useIndicatorCatalog,
  useSubmissionEntries,
  useSaveSubmissionEntries,
  type SaveIndicatorEntry,
} from "@/hooks/submissions/useNonFinancialIndicators";
import { useMyCooperativeProfile } from "@/hooks/cooperatives/useCooperatives";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface NonFinancialIndicatorsFormProps {
  submissionId: string;
  isReadOnly?: boolean;
}

export const NonFinancialIndicatorsForm: React.FC<NonFinancialIndicatorsFormProps> = ({
  submissionId,
  isReadOnly = false,
}) => {
  const { t } = useTranslation();
  const { data: profile } = useMyCooperativeProfile();
  const { data: catalog, isLoading: isLoadingCatalog } = useIndicatorCatalog(
    profile?.institution_type || undefined,
  );
  const { data: entries, isLoading: isLoadingEntries } = useSubmissionEntries(submissionId);
  const saveMutation = useSaveSubmissionEntries(submissionId);

  // Form state maps catalog ID to its corresponding value object
  const [formValues, setFormValues] = useState<
    Record<string, { value_numeric?: number; value_text?: string; value_boolean?: boolean }>
  >({});

  // Populate form state when data loaded
  useEffect(() => {
    if (entries && catalog) {
      const initial: typeof formValues = {};
      catalog.forEach((item) => {
        const match = entries.find((e) => e.catalog_id === item.id);
        if (match) {
          initial[item.id] = {
            value_numeric: match.value_numeric ?? undefined,
            value_text: match.value_text ?? undefined,
            value_boolean: match.value_boolean ?? undefined,
          };
        } else {
          // Defaults
          initial[item.id] = {
            value_numeric: undefined,
            value_text: "",
            value_boolean: item.data_type === "Boolean" ? false : undefined,
          };
        }
      });
      setFormValues(initial);
    }
  }, [entries, catalog]);

  const handleChange = (
    catalogId: string,
    key: "value_numeric" | "value_text" | "value_boolean",
    val: number | string | boolean | undefined,
  ) => {
    setFormValues((prev) => ({
      ...prev,
      [catalogId]: {
        ...prev[catalogId],
        [key]: val,
      },
    }));
  };

  const isFormValid = () => {
    if (!catalog) return false;
    for (const item of catalog) {
      if (item.is_required) {
        const val = formValues[item.id];
        if (!val) return false;

        if (item.data_type === "Number") {
          const num = val.value_numeric;
          if (num === undefined || num === null || isNaN(Number(num))) {
            return false;
          }
        }
        if (item.data_type === "Text") {
          const txt = val.value_text;
          if (txt === undefined || txt === null || String(txt).trim() === "") {
            return false;
          }
        }
        if (item.data_type === "Boolean") {
          const bool = val.value_boolean;
          if (bool === undefined || bool === null) {
            return false;
          }
        }
      }
    }
    return true;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalog) return;

    // Validate required fields
    const toSave: SaveIndicatorEntry[] = [];
    for (const item of catalog) {
      const val = formValues[item.id] || {};
      if (item.is_required) {
        if (item.data_type === "Number") {
          const numVal = val.value_numeric;
          if (numVal === undefined || numVal === null || isNaN(Number(numVal))) {
            toast.error(t("nfIndicatorsForm.requiredNumber", { field: item.display_name }));
            return;
          }
        }
        if (item.data_type === "Text") {
          const textVal = val.value_text;
          if (textVal === undefined || textVal === null || String(textVal).trim() === "") {
            toast.error(t("nfIndicatorsForm.requiredText", { field: item.display_name }));
            return;
          }
        }
        if (item.data_type === "Boolean") {
          const boolVal = val.value_boolean;
          if (boolVal === undefined || boolVal === null) {
            toast.error(t("nfIndicatorsForm.requiredBoolean", { field: item.display_name }));
            return;
          }
        }
      }

      const numVal = val.value_numeric;
      const textVal = val.value_text;
      const boolVal = val.value_boolean;

      toSave.push({
        catalog_id: item.id,
        value_numeric:
          numVal !== undefined && numVal !== null && !isNaN(Number(numVal)) ? Number(numVal) : null,
        value_text:
          textVal !== undefined && textVal !== null && String(textVal).trim() !== ""
            ? String(textVal)
            : null,
        value_boolean: boolVal !== undefined && boolVal !== null ? Boolean(boolVal) : null,
      });
    }

    try {
      await saveMutation.mutateAsync(toSave);
      toast.success(t("nfIndicatorsForm.savedSuccess"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("nfIndicatorsForm.savedError"));
    }
  };

  if (isLoadingCatalog || isLoadingEntries) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t("nfIndicatorsForm.loading")}
      </div>
    );
  }

  if (!catalog || catalog.length === 0) {
    return (
      <div className="text-center p-8 border rounded-xl bg-muted/20">
        <HelpCircle className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
        <p className="text-sm font-medium">{t("nfIndicatorsForm.noCatalog")}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {t("nfIndicatorsForm.noCatalogDesc", { type: profile?.institution_type || t("nfIndicatorsForm.yourCoopType") })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">{t("nfIndicatorsForm.title")}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t("nfIndicatorsForm.subtitle")}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <Card>
          <div className="divide-y divide-border/60">
            {catalog.map((item) => {
              const val = formValues[item.id] || {};
              const isFieldRequired = item.is_required;

              return (
                <div
                  key={item.id}
                  className="py-5 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-start justify-between gap-6"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {item.display_name}
                      </span>
                      {isFieldRequired && (
                        <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                          {t("nfIndicatorsForm.required")}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="w-full md:w-72 shrink-0">
                    {item.data_type === "Number" && (
                      <Input
                        type="number"
                        step="any"
                        placeholder={t("nfIndicatorsForm.enterNumber")}
                        value={val.value_numeric !== undefined ? val.value_numeric : ""}
                        disabled={isReadOnly}
                        onChange={(e) => {
                          const num =
                            e.target.value === "" ? undefined : parseFloat(e.target.value);
                          handleChange(item.id, "value_numeric", num);
                        }}
                        className="w-full transition-colors focus-visible:ring-1 text-sm h-9"
                      />
                    )}

                    {item.data_type === "Text" && (
                      <Textarea
                        placeholder={t("nfIndicatorsForm.enterDetails")}
                        value={val.value_text || ""}
                        disabled={isReadOnly}
                        rows={2}
                        onChange={(e) => handleChange(item.id, "value_text", e.target.value)}
                        className="w-full transition-colors focus-visible:ring-1 text-sm resize-none"
                      />
                    )}

                    {item.data_type === "Boolean" && (
                      <div className="flex items-center gap-3 h-9">
                        <Switch
                          id={`switch-${item.id}`}
                          checked={val.value_boolean || false}
                          disabled={isReadOnly}
                          onCheckedChange={(checked) =>
                            handleChange(item.id, "value_boolean", checked)
                          }
                          className="data-[state=checked]:bg-primary"
                        />
                        <Label
                          htmlFor={`switch-${item.id}`}
                          className="text-xs text-muted-foreground font-medium cursor-pointer select-none"
                        >
                          {val.value_boolean ? t("nfIndicatorsForm.yes") : t("nfIndicatorsForm.no")}
                        </Label>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {!isReadOnly && (
          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={saveMutation.isPending || !isFormValid()}
              className="px-6 flex items-center gap-2 hover:opacity-90 shadow-sm"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("nfIndicatorsForm.saving")}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {t("nfIndicatorsForm.saveButton")}
                </>
              )}
            </Button>
          </div>
        )}

        {isReadOnly && (
          <Alert className="bg-muted/40 border border-muted-foreground/10 mt-4">
            <Info className="h-4 w-4 text-muted-foreground" />
            <AlertDescription className="text-xs text-muted-foreground">
              {t("nfIndicatorsForm.readOnlyNotice")}
            </AlertDescription>
          </Alert>
        )}
      </form>
    </div>
  );
};
