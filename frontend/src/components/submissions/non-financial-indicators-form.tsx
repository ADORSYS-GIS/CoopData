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

interface NonFinancialIndicatorsFormProps {
  submissionId: string;
  isReadOnly?: boolean;
}

export const NonFinancialIndicatorsForm: React.FC<NonFinancialIndicatorsFormProps> = ({
  submissionId,
  isReadOnly = false,
}) => {
  const { data: profile } = useMyCooperativeProfile();
  const { data: catalog, isLoading: isLoadingCatalog } = useIndicatorCatalog(
    profile?.institution_type || undefined
  );
  const { data: entries, isLoading: isLoadingEntries } = useSubmissionEntries(submissionId);
  const saveMutation = useSaveSubmissionEntries(submissionId);

  // Form state maps catalog ID to its corresponding value object
  const [formValues, setFormValues] = useState<
    Record<
      string,
      { value_numeric?: number; value_text?: string; value_boolean?: boolean }
    >
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
    val: any
  ) => {
    setFormValues((prev) => ({
      ...prev,
      [catalogId]: {
        ...prev[catalogId],
        [key]: val,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalog) return;

    // Validate required fields
    const toSave: SaveIndicatorEntry[] = [];
    for (const item of catalog) {
      const val = formValues[item.id] || {};
      if (item.is_required) {
        if (item.data_type === "Number" && val.value_numeric === undefined) {
          toast.error(`"${item.display_name}" is required and must be a number.`);
          return;
        }
        if (item.data_type === "Text" && (!val.value_text || val.value_text.trim() === "")) {
          toast.error(`"${item.display_name}" is required and must contain text.`);
          return;
        }
        if (item.data_type === "Boolean" && val.value_boolean === undefined) {
          toast.error(`"${item.display_name}" is required.`);
          return;
        }
      }

      toSave.push({
        catalog_id: item.id,
        value_numeric: val.value_numeric !== undefined ? val.value_numeric : null,
        value_text: val.value_text !== undefined ? val.value_text : null,
        value_boolean: val.value_boolean !== undefined ? val.value_boolean : null,
      });
    }

    try {
      await saveMutation.mutateAsync(toSave);
      toast.success("Non-financial indicators saved successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save indicators");
    }
  };

  if (isLoadingCatalog || isLoadingEntries) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading indicators...
      </div>
    );
  }

  if (!catalog || catalog.length === 0) {
    return (
      <div className="text-center p-8 border rounded-xl bg-muted/20">
        <HelpCircle className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
        <p className="text-sm font-medium">No custom indicators found for your cooperative type.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Ministry officials have not defined any periodic requirements for {profile?.institution_type || "your cooperative type"}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Non-Financial Periodic Indicators</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Complete the fields below as requested by the Ministry of Cooperatives.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {catalog.map((item) => {
            const val = formValues[item.id] || {};
            const isFieldRequired = item.is_required;

            return (
              <Card
                key={item.id}
                title={item.display_name}
                subtitle={item.description || "No description provided"}
                action={
                  isFieldRequired ? (
                    <span className="text-xs font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                      Required
                    </span>
                  ) : undefined
                }
                className="hover:shadow-md transition-shadow duration-200 border-l-4 border-l-primary/40"
              >
                <div className="mt-3">
                  {item.data_type === "Number" && (
                    <div className="space-y-1.5">
                      <Input
                        type="number"
                        step="any"
                        placeholder="Enter numerical value..."
                        value={val.value_numeric !== undefined ? val.value_numeric : ""}
                        disabled={isReadOnly}
                        onChange={(e) => {
                          const num = e.target.value === "" ? undefined : parseFloat(e.target.value);
                          handleChange(item.id, "value_numeric", num);
                        }}
                        className={cn(
                          "w-full transition-colors focus-visible:ring-1",
                          isFieldRequired && val.value_numeric === undefined && "border-warning"
                        )}
                      />
                    </div>
                  )}

                  {item.data_type === "Text" && (
                    <div className="space-y-1.5">
                      <Textarea
                        placeholder="Enter details..."
                        value={val.value_text || ""}
                        disabled={isReadOnly}
                        rows={2}
                        onChange={(e) => handleChange(item.id, "value_text", e.target.value)}
                        className={cn(
                          "w-full transition-colors focus-visible:ring-1 resize-none",
                          isFieldRequired && (!val.value_text || val.value_text.trim() === "") && "border-warning"
                        )}
                      />
                    </div>
                  )}

                  {item.data_type === "Boolean" && (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-dashed">
                      <Label htmlFor={`switch-${item.id}`} className="text-xs text-muted-foreground font-normal cursor-pointer">
                        {val.value_boolean ? "Yes / Confirmed" : "No / Unconfirmed"}
                      </Label>
                      <Switch
                        id={`switch-${item.id}`}
                        checked={val.value_boolean || false}
                        disabled={isReadOnly}
                        onCheckedChange={(checked) => handleChange(item.id, "value_boolean", checked)}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {!isReadOnly && (
          <div className="flex justify-end pt-4 border-t">
            <Button
              type="submit"
              disabled={saveMutation.isPending}
              className="px-6 flex items-center gap-2 hover:opacity-90 shadow-sm"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Indicators
                </>
              )}
            </Button>
          </div>
        )}

        {isReadOnly && (
          <Alert className="bg-muted/40 border border-muted-foreground/10 mt-4">
            <Info className="h-4 w-4 text-muted-foreground" />
            <AlertDescription className="text-xs text-muted-foreground">
              These indicator fields are read-only because the submission has already been finalized or you are accessing this from a supervisor role.
            </AlertDescription>
          </Alert>
        )}
      </form>
    </div>
  );
};
