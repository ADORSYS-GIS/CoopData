import { useTranslation } from "react-i18next";
import type { WizardFarmCoop } from "./types";

interface FarmCoopFormProps {
  data: WizardFarmCoop;
  onChange: (field: keyof WizardFarmCoop, value: unknown) => void;
}

export function FarmCoopForm({ data, onChange }: FarmCoopFormProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* General Settings */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {t("farmCoopForm.generalProfile")}
        </h4>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground block">
            {t("farmCoopForm.cooperativeType")}
          </label>
          <input
            value={data.cooperativeType}
            onChange={(e) => onChange("cooperativeType", e.target.value)}
            className="w-full text-sm bg-muted/20 border border-border rounded-xl px-3 py-2 text-foreground"
            placeholder={t("farmCoopForm.coopTypePlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground block">
            {t("farmCoopForm.primaryActivities")}
          </label>
          <input
            value={data.primaryActivities}
            onChange={(e) => onChange("primaryActivities", e.target.value)}
            className="w-full text-sm bg-muted/20 border border-border rounded-xl px-3 py-2 text-foreground"
            placeholder={t("farmCoopForm.activitiesPlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground block">
            {t("farmCoopForm.establishmentYear")}
          </label>
          <input
            type="number"
            value={data.yearOfEstablishment}
            onChange={(e) => onChange("yearOfEstablishment", Number(e.target.value))}
            className="w-full text-sm bg-muted/20 border border-border rounded-xl px-3 py-2 text-foreground font-mono"
          />
        </div>
      </div>

      {/* Production Details */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {t("farmCoopForm.productionMitigation")}
        </h4>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground block">
            {t("farmCoopForm.productionType")}
          </label>
          <select
            value={data.productionType}
            onChange={(e) => onChange("productionType", e.target.value)}
            className="w-full text-sm bg-muted/20 border border-border rounded-xl px-3 py-2 text-foreground"
          >
            <option value="Crop">{t("farmCoopForm.productionTypes.Crop")}</option>
            <option value="Livestock">{t("farmCoopForm.productionTypes.Livestock")}</option>
            <option value="Dairy">{t("farmCoopForm.productionTypes.Dairy")}</option>
            <option value="Mixed">{t("farmCoopForm.productionTypes.Mixed")}</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground block">
            {t("farmCoopForm.climateExposure")}
          </label>
          <select
            value={data.climateExposureType}
            onChange={(e) => onChange("climateExposureType", e.target.value)}
            className="w-full text-sm bg-muted/20 border border-border rounded-xl px-3 py-2 text-foreground"
          >
            <option value="Low">{t("farmCoopForm.exposureTypes.Low")}</option>
            <option value="Medium">{t("farmCoopForm.exposureTypes.Medium")}</option>
            <option value="High">{t("farmCoopForm.exposureTypes.High")}</option>
          </select>
        </div>
        <div className="space-y-2 flex items-center justify-between py-1.5 font-sans">
          <div>
            <label className="text-xs font-semibold text-foreground block">
              {t("farmCoopForm.activeProducer")}
            </label>
            <span className="text-[10px] text-muted-foreground">
              {t("farmCoopForm.activeProducerDesc")}
            </span>
          </div>
          <input
            type="checkbox"
            checked={data.activeProducerFlag}
            onChange={(e) => onChange("activeProducerFlag", e.target.checked)}
            className="size-5 rounded accent-primary"
          />
        </div>
        <div className="space-y-2 flex items-center justify-between py-1.5 font-sans">
          <div>
            <label className="text-xs font-semibold text-foreground block">
              {t("farmCoopForm.irrigationAccess")}
            </label>
            <span className="text-[10px] text-muted-foreground">
              {t("farmCoopForm.irrigationAccessDesc")}
            </span>
          </div>
          <input
            type="checkbox"
            checked={data.irrigationAccess}
            onChange={(e) => onChange("irrigationAccess", e.target.checked)}
            className="size-5 rounded accent-primary"
          />
        </div>
      </div>
    </div>
  );
}
