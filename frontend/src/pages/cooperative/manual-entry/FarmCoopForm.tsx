import type { WizardFarmCoop } from "./types";

interface FarmCoopFormProps {
  data: WizardFarmCoop;
  onChange: (field: keyof WizardFarmCoop, value: any) => void;
}

export function FarmCoopForm({ data, onChange }: FarmCoopFormProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* General Settings */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          General Profile
        </h4>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground block">Cooperative Type</label>
          <input
            value={data.cooperativeType}
            onChange={(e) => onChange("cooperativeType", e.target.value)}
            className="w-full text-sm bg-muted/20 border border-border rounded-xl px-3 py-2 text-foreground"
            placeholder="e.g. Farm, Multipurpose"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground block">Primary Activities</label>
          <input
            value={data.primaryActivities}
            onChange={(e) => onChange("primaryActivities", e.target.value)}
            className="w-full text-sm bg-muted/20 border border-border rounded-xl px-3 py-2 text-foreground"
            placeholder="e.g. Maize Farming, Input Supply"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground block">Establishment Year</label>
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
          Production & Mitigation
        </h4>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground block">Production Type</label>
          <select
            value={data.productionType}
            onChange={(e) => onChange("productionType", e.target.value)}
            className="w-full text-sm bg-muted/20 border border-border rounded-xl px-3 py-2 text-foreground"
          >
            <option value="Crop">Crop Farming</option>
            <option value="Livestock">Livestock</option>
            <option value="Dairy">Dairy</option>
            <option value="Mixed">Mixed</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground block">
            Climate Exposure Type
          </label>
          <select
            value={data.climateExposureType}
            onChange={(e) => onChange("climateExposureType", e.target.value)}
            className="w-full text-sm bg-muted/20 border border-border rounded-xl px-3 py-2 text-foreground"
          >
            <option value="Low">Low Exposure</option>
            <option value="Medium">Medium Exposure</option>
            <option value="High">High Exposure</option>
          </select>
        </div>
        <div className="space-y-2 flex items-center justify-between py-1.5 font-sans">
          <div>
            <label className="text-xs font-semibold text-foreground block">
              Active Producer Status
            </label>
            <span className="text-[10px] text-muted-foreground">
              Are members actively producing?
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
            <label className="text-xs font-semibold text-foreground block">Irrigation Access</label>
            <span className="text-[10px] text-muted-foreground">
              Do members have access to irrigation?
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
