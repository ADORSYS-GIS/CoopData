import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SortableHeader } from "@/components/ui/data-table";
import { Check, X, Pencil, Trash2 } from "lucide-react";
import type { FarmCoopResponse } from "@/types/non-financial";
import { useTranslation } from "react-i18next";

interface FarmCoopActions {
  onEdit?: (fc: FarmCoopResponse) => void;
  onDelete?: (id: string) => void;
}

function BoolIcon({ value }: { value: boolean }) {
  return value ? (
    <Check className="size-3.5 text-success" />
  ) : (
    <X className="size-3.5 text-muted-foreground/50" />
  );
}

export function useFarmCoopColumns(actions?: FarmCoopActions): ColumnDef<FarmCoopResponse>[] {
  const { t } = useTranslation();
  return [
    {
      accessorKey: "cooperative_type",
      header: ({ column }) => <SortableHeader column={column}>{t("columns.type")}</SortableHeader>,
      cell: ({ row }) => <span className="text-xs">{row.getValue("cooperative_type")}</span>,
    },
    {
      accessorKey: "primary_activities",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.participation")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("primary_activities")}</span>,
    },
    {
      accessorKey: "year_of_establishment",
      header: ({ column }) => <SortableHeader column={column}>{t("columns.est")}</SortableHeader>,
      cell: ({ row }) => {
        const val = row.getValue("year_of_establishment") as number | null;
        return <span className="text-xs font-mono">{val ?? "—"}</span>;
      },
    },
    {
      accessorKey: "operational_status",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.status")}</SortableHeader>
      ),
      cell: ({ row }) => {
        const status = row.getValue("operational_status") as string;
        return <Badge variant={status === "Active" ? "default" : "secondary"}>{status}</Badge>;
      },
    },
    {
      accessorKey: "active_producer_flag",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.activeProducer")}</SortableHeader>
      ),
      cell: ({ row }) => <BoolIcon value={row.getValue("active_producer_flag") as boolean} />,
    },
    {
      accessorKey: "production_type",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.production")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("production_type")}</span>,
    },
    {
      accessorKey: "participation_frequency",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.participation")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("participation_frequency")}</span>,
    },
    {
      accessorKey: "delivery_compliance",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.delivery")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("delivery_compliance")}</span>,
    },
    {
      accessorKey: "production_cycle_type",
      header: ({ column }) => <SortableHeader column={column}>{t("columns.cycle")}</SortableHeader>,
      cell: ({ row }) => <span className="text-xs">{row.getValue("production_cycle_type")}</span>,
    },
    {
      accessorKey: "use_of_production_planning",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.planning")}</SortableHeader>
      ),
      cell: ({ row }) => <BoolIcon value={row.getValue("use_of_production_planning") as boolean} />,
    },
    {
      accessorKey: "use_of_shared_inputs",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.sharedInputs")}</SortableHeader>
      ),
      cell: ({ row }) => <BoolIcon value={row.getValue("use_of_shared_inputs") as boolean} />,
    },
    {
      accessorKey: "quality_compliance_flag",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.qualityCompliance")}</SortableHeader>
      ),
      cell: ({ row }) => <BoolIcon value={row.getValue("quality_compliance_flag") as boolean} />,
    },
    {
      accessorKey: "market_channel_type",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.marketChannel")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("market_channel_type")}</span>,
    },
    {
      accessorKey: "formal_offtake_agreement",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.offtakeAgreement")}</SortableHeader>
      ),
      cell: ({ row }) => <BoolIcon value={row.getValue("formal_offtake_agreement") as boolean} />,
    },
    {
      accessorKey: "buyer_concentration_flag",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.buyerConcentration")}</SortableHeader>
      ),
      cell: ({ row }) => <BoolIcon value={row.getValue("buyer_concentration_flag") as boolean} />,
    },
    {
      accessorKey: "price_predictability_category",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.pricePredictability")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-xs">{row.getValue("price_predictability_category")}</span>
      ),
    },
    {
      accessorKey: "access_to_storage",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.storage")}</SortableHeader>
      ),
      cell: ({ row }) => <BoolIcon value={row.getValue("access_to_storage") as boolean} />,
    },
    {
      accessorKey: "access_to_processing_facilities",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.processing")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <BoolIcon value={row.getValue("access_to_processing_facilities") as boolean} />
      ),
    },
    {
      accessorKey: "transport_coordination",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.transport")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("transport_coordination")}</span>,
    },
    {
      accessorKey: "climate_exposure_type",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.climateExposure")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("climate_exposure_type")}</span>,
    },
    {
      accessorKey: "irrigation_access",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.irrigation")}</SortableHeader>
      ),
      cell: ({ row }) => <BoolIcon value={row.getValue("irrigation_access") as boolean} />,
    },
    {
      accessorKey: "climate_mitigation_practices",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.climateMitigation")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-xs">{row.getValue("climate_mitigation_practices")}</span>
      ),
    },
    ...(actions
      ? [
          {
            id: "actions",
            header: t("columns.actions"),
            cell: ({ row }: { row: { original: FarmCoopResponse } }) => (
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => actions.onEdit?.(row.original)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 hover:text-destructive"
                  onClick={() => actions.onDelete?.(row.original.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ] as ColumnDef<FarmCoopResponse>[];
}
