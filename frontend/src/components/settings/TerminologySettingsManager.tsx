import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Shield, Network, Building, Users, Save, RotateCcw } from "lucide-react";
import { Card } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { LocalizedField, type FieldTranslations } from "@/components/shared/LocalizedField";
import { Spinner } from "@/components/ui/spinner";
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

type EditableField = "label" | "short_label" | "plural_label" | "description";

interface EditingLabel {
  label: string;
  short_label: string;
  plural_label: string;
  description: string;
  translations: Record<string, Record<string, string>>;
}

/**
 * Order-independent deep comparison of translation maps ({ lang: { field: value }}).
 * JSON.stringify is not suitable here: objects rebuilt during editing carry a
 * different key insertion order than the server payload, so identical content
 * compared as different and falsely flagged rows as dirty.
 */
const translationsEqual = (
  a: Record<string, Record<string, string>> | undefined,
  b: Record<string, Record<string, string>> | undefined,
): boolean => {
  const mapA = a ?? {};
  const mapB = b ?? {};
  const langs = new Set([...Object.keys(mapA), ...Object.keys(mapB)]);
  for (const lang of langs) {
    const fieldsA = mapA[lang] ?? {};
    const fieldsB = mapB[lang] ?? {};
    const fields = new Set([...Object.keys(fieldsA), ...Object.keys(fieldsB)]);
    for (const field of fields) {
      // Missing and empty-string are equivalent: the editor deletes keys
      // instead of storing empty values.
      if ((fieldsA[field] ?? "") !== (fieldsB[field] ?? "")) return false;
    }
  }
  return true;
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
  const [editingLabels, setEditingLabels] = useState<Record<string, EditingLabel>>({});

  // Sync state with fetched database data on load
  useEffect(() => {
    const initial: Record<string, EditingLabel> = {};
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

  /**
   * Compute which keys have unsaved changes compared to the source-of-truth
   * (the database response, or the seed defaults if no DB data is available).
   * Used to enable/disable the single "Save all" button and to decide which
   * rows actually need a PUT request.
   */
  const dirtyKeys = useMemo(() => {
    const dirty = new Set<string>();
    for (const item of effectiveLabels) {
      const current = editingLabels[item.key];
      if (!current) continue;
      const baseTranslations = (item.translations as Record<string, Record<string, string>>) || {};
      const sameText =
        current.label === item.label &&
        current.short_label === item.short_label &&
        current.plural_label === item.plural_label &&
        (current.description || "") === (item.description || "");
      const sameTranslations = translationsEqual(current.translations, baseTranslations);
      if (!sameText || !sameTranslations) {
        dirty.add(item.key);
      }
    }
    return dirty;
  }, [editingLabels, effectiveLabels]);

  const isDirty = dirtyKeys.size > 0;

  const handleFieldChange = useCallback((key: string, field: EditableField, value: string) => {
    setEditingLabels((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      },
    }));
  }, []);

  const handleTranslationsChange = useCallback(
    (key: string, field: EditableField, newFieldTr: FieldTranslations) => {
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
    },
    [],
  );

  const extractTranslationsForField = useCallback(
    (key: string, field: EditableField): FieldTranslations => {
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
    },
    [editingLabels],
  );

  /**
   * Validate every dirty row before sending anything to the server.
   * Returns the list of keys that passed validation, or null if any failed
   * (in which case a toast has already been shown).
   */
  const validateAll = (): string[] | null => {
    const validKeys: string[] = [];
    for (const key of dirtyKeys) {
      const data = editingLabels[key];
      if (!data) continue;
      if (!data.label.trim()) {
        toast.error(
          `${key}: ${t("settings.terminology.errLabelRequired", {
            defaultValue: "Singular label is required",
          })}`,
        );
        return null;
      }
      if (!data.short_label.trim()) {
        toast.error(
          `${key}: ${t("settings.terminology.errShortLabelRequired", {
            defaultValue: "Short label is required",
          })}`,
        );
        return null;
      }
      if (!data.plural_label.trim()) {
        toast.error(
          `${key}: ${t("settings.terminology.errPluralLabelRequired", {
            defaultValue: "Plural label is required",
          })}`,
        );
        return null;
      }
      validKeys.push(key);
    }
    return validKeys;
  };

  const handleSaveAll = async () => {
    const keysToSave = validateAll();
    if (!keysToSave || keysToSave.length === 0) return;

    let successCount = 0;
    const failed: { key: string; error: string }[] = [];

    // Save sequentially so a failure on one row doesn't mask others, and so
    // the audit log + cache invalidation order matches the user's mental model.
    for (const key of keysToSave) {
      const data = editingLabels[key];
      const originalItem = effectiveLabels.find((l) => l.key === key);
      if (!data || !originalItem) continue;

      try {
        await updateMutation.mutateAsync({
          key,
          label: data.label,
          short_label: data.short_label,
          plural_label: data.plural_label,
          description: data.description || null,
          icon: originalItem.icon || "",
          translations: data.translations,
        });
        successCount += 1;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        failed.push({ key, error: errorMsg });
      }
    }

    if (failed.length === 0) {
      toast.success(
        t("settings.terminology.saveAllSuccess", {
          defaultValue: "All terminology settings updated successfully",
          count: successCount,
        }),
      );
    } else {
      toast.error(
        t("settings.terminology.saveAllPartial", {
          defaultValue: `Saved ${successCount}, failed ${failed.length}: ${failed
            .map((f) => f.key)
            .join(", ")}`,
          success: successCount,
          failed: failed.length,
          failedKeys: failed.map((f) => f.key).join(", "),
        }),
      );
    }
  };

  const handleReset = () => {
    const initial: Record<string, EditingLabel> = {};
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
    toast.info(
      t("settings.terminology.resetDone", {
        defaultValue: "Unsaved changes discarded",
      }),
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Spinner size="lg" className="text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + single save button */}
      <div className="flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-lg font-heading font-semibold text-foreground">
            {t("settings.terminology.title", { defaultValue: "Role & Level Terminology" })}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("settings.terminology.desc", {
              defaultValue:
                "Customize dynamic display names and abbreviations for organizational levels inside the application.",
            })}
          </p>
          {isDirty && (
            <p className="text-xs font-medium text-accent mt-1">
              {t("settings.terminology.unsavedCount", {
                defaultValue: `${dirtyKeys.size} unsaved change${dirtyKeys.size === 1 ? "" : "s"}`,
                count: dirtyKeys.size,
              })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!isDirty || updateMutation.isPending}
            className="flex items-center gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            {t("settings.terminology.resetBtn", { defaultValue: "Reset" })}
          </Button>
          <Button
            onClick={handleSaveAll}
            disabled={!isDirty || updateMutation.isPending}
            size="sm"
            className="flex items-center gap-1.5"
          >
            {updateMutation.isPending ? <Spinner size="sm" /> : <Save className="size-3.5" />}
            {t("settings.terminology.saveAllBtn", { defaultValue: "Save all changes" })}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {effectiveLabels.map((item) => {
          const Icon = KEY_ICONS[item.key] || Building;
          const current = editingLabels[item.key];
          if (!current) return null;

          const isRowDirty = dirtyKeys.has(item.key);

          return (
            <Card
              key={item.key}
              edge={
                item.key === "ministry" ? "accent" : item.key === "federation" ? "primary" : "none"
              }
              className={isRowDirty ? "ring-1 ring-inset ring-accent/40" : undefined}
            >
              <div className="flex items-center gap-3 mb-6">
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
                    {isRowDirty && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                        {t("settings.terminology.unsavedBadge", {
                          defaultValue: "Unsaved",
                        })}
                      </span>
                    )}
                  </p>
                </div>
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
