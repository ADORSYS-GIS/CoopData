import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Shield, Network, Building, Users, Save, Loader2 } from "lucide-react";
import { Card } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { LocalizedField, type FieldTranslations } from "@/components/shared/LocalizedField";
import {
  useOrganizationLabels,
  useUpdateOrganizationLabel,
  DEFAULT_ORGANIZATION_LABELS,
} from "@/hooks/settings/useOrganizationLabels";

const KEY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ministry: Shield,
  federation: Network,
  apex: Building,
  cooperative: Users,
};

export const TerminologySettingsManager: React.FC = () => {
  const { t } = useTranslation();
  const { data: labels, isLoading } = useOrganizationLabels();
  const updateMutation = useUpdateOrganizationLabel();

  const effectiveLabels = useMemo(
    () => (labels && labels.length > 0 ? labels : DEFAULT_ORGANIZATION_LABELS),
    [labels],
  );

  // Local editing state for each of the organization levels
  const [editingLabels, setEditingLabels] = useState<
    Record<
      string,
      {
        label: string;
        short_label: string;
        plural_label: string;
        description: string;
        translations: Record<string, Record<string, string>>;
      }
    >
  >({});

  // Sync state with fetched database data on load
  useEffect(() => {
    const initial: typeof editingLabels = {};
    for (const item of effectiveLabels) {
      initial[item.key] = {
        label: item.label,
        short_label: item.short_label,
        plural_label: item.plural_label,
        description: item.description || "",
        translations: (item.translations as Record<string, Record<string, string>>) || {},
      };
    }
    setEditingLabels(initial);
  }, [effectiveLabels]);

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-accent" />
      </div>
    );
  }

  const handleFieldChange = (
    key: string,
    field: "label" | "short_label" | "plural_label" | "description",
    value: string,
  ) => {
    setEditingLabels((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  };

  const handleTranslationsChange = (
    key: string,
    field: "label" | "short_label" | "plural_label" | "description",
    newFieldTr: FieldTranslations,
  ) => {
    setEditingLabels((prev) => {
      const current = prev[key] || { translations: {} };
      const currentTr = { ...(current.translations || {}) };

      // Update the translations object in a nested fashion:
      // translations: { [lang]: { label, short_label, plural_label, description } }
      const languages = ["pt", "ss", "fr"] as const;
      for (const lang of languages) {
        const val = newFieldTr[lang];
        if (val !== undefined) {
          const langObj = { ...(currentTr[lang] || {}) };
          if (val.trim() === "") {
            delete langObj[field];
          } else {
            langObj[field] = val;
          }

          if (Object.keys(langObj).length === 0) {
            delete currentTr[lang];
          } else {
            currentTr[lang] = langObj;
          }
        }
      }

      return {
        ...prev,
        [key]: {
          ...current,
          translations: currentTr,
        },
      };
    });
  };

  const extractTranslationsForField = (
    key: string,
    field: "label" | "short_label" | "plural_label" | "description",
  ): FieldTranslations => {
    const current = editingLabels[key];
    if (!current || !current.translations) return {};

    const acc: FieldTranslations = {};
    const languages = ["pt", "ss", "fr"] as const;
    for (const lang of languages) {
      const val = current.translations[lang]?.[field];
      if (typeof val === "string") {
        acc[lang] = val;
      }
    }
    return acc;
  };

  const handleSave = async (key: string) => {
    const data = editingLabels[key];
    const originalItem = effectiveLabels.find((l) => l.key === key);
    if (!data) return;

    if (!data.label.trim()) {
      toast.error(
        t("settings.terminology.errLabelRequired", { defaultValue: "Singular label is required" }),
      );
      return;
    }
    if (!data.short_label.trim()) {
      toast.error(
        t("settings.terminology.errShortLabelRequired", {
          defaultValue: "Short label is required",
        }),
      );
      return;
    }
    if (!data.plural_label.trim()) {
      toast.error(
        t("settings.terminology.errPluralLabelRequired", {
          defaultValue: "Plural label is required",
        }),
      );
      return;
    }

    try {
      await updateMutation.mutateAsync({
        key,
        label: data.label,
        short_label: data.short_label,
        plural_label: data.plural_label,
        description: data.description || null,
        icon: originalItem?.icon || "",
        translations: data.translations,
      });
      toast.success(
        t("settings.terminology.saveSuccess", {
          defaultValue: "Terminology settings updated successfully",
        }),
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      toast.error(
        errorMsg ||
          t("settings.terminology.saveError", {
            defaultValue: "Failed to update terminology settings",
          }),
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1.5 border-b border-border pb-4">
        <h3 className="text-lg font-heading font-semibold text-foreground">
          {t("settings.terminology.title", { defaultValue: "Role & Level Terminology" })}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("settings.terminology.desc", {
            defaultValue:
              "Customize dynamic display names and abbreviations for organizational levels inside the application.",
          })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {effectiveLabels.map((item) => {
          const Icon = KEY_ICONS[item.key] || Building;
          const current = editingLabels[item.key];
          if (!current) return null;

          const isMutating = updateMutation.isPending && updateMutation.variables?.key === item.key;

          return (
            <Card
              key={item.key}
              edge={
                item.key === "ministry" ? "accent" : item.key === "federation" ? "primary" : "none"
              }
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-accent/10 text-accent grid place-items-center shrink-0">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground capitalize">
                      {item.key} {t("settings.terminology.levelSuffix", { defaultValue: "Level" })}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("settings.terminology.defaultTitle", { defaultValue: "Default name" })}:{" "}
                      <span className="font-semibold text-foreground/80">{item.key}</span>
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => handleSave(item.key)}
                  disabled={isMutating}
                  size="sm"
                  className="w-full md:w-auto self-end md:self-auto flex items-center gap-1.5"
                >
                  {isMutating ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  {t("settings.terminology.saveBtn", { defaultValue: "Save changes" })}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <LocalizedField
                  id={`${item.key}-label`}
                  label={t("settings.terminology.singularLabel", { defaultValue: "Singular Name" })}
                  value={current.label}
                  onChange={(val) => handleFieldChange(item.key, "label", val)}
                  translations={extractTranslationsForField(item.key, "label")}
                  onTranslationsChange={(tr) => handleTranslationsChange(item.key, "label", tr)}
                  required
                />
                <LocalizedField
                  id={`${item.key}-plural-label`}
                  label={t("settings.terminology.pluralLabel", { defaultValue: "Plural Name" })}
                  value={current.plural_label}
                  onChange={(val) => handleFieldChange(item.key, "plural_label", val)}
                  translations={extractTranslationsForField(item.key, "plural_label")}
                  onTranslationsChange={(tr) =>
                    handleTranslationsChange(item.key, "plural_label", tr)
                  }
                  required
                />
                <LocalizedField
                  id={`${item.key}-short-label`}
                  label={t("settings.terminology.shortLabel", { defaultValue: "Abbreviation" })}
                  value={current.short_label}
                  onChange={(val) => handleFieldChange(item.key, "short_label", val)}
                  translations={extractTranslationsForField(item.key, "short_label")}
                  onTranslationsChange={(tr) =>
                    handleTranslationsChange(item.key, "short_label", tr)
                  }
                  required
                />
              </div>

              <div className="mt-6">
                <LocalizedField
                  id={`${item.key}-description`}
                  label={t("settings.terminology.levelDescription", {
                    defaultValue: "Level Description",
                  })}
                  value={current.description}
                  onChange={(val) => handleFieldChange(item.key, "description", val)}
                  translations={extractTranslationsForField(item.key, "description")}
                  onTranslationsChange={(tr) =>
                    handleTranslationsChange(item.key, "description", tr)
                  }
                  multiline
                />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
