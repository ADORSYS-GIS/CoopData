import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { useFarmCoopColumns } from "./FarmCoopColumns";
import type { FarmCoopResponse } from "@/types/non-financial";
import { useTranslation } from "react-i18next";

interface FarmCoopGridProps {
  farmCoops: FarmCoopResponse[];
  isLoading?: boolean;
  isReadOnly?: boolean;
  errorRowIds?: string[];
  onEdit?: (fc: FarmCoopResponse) => void;
  onDelete?: (id: string) => void;
}

export function FarmCoopGrid({
  farmCoops,
  isLoading,
  isReadOnly,
  errorRowIds,
  onEdit,
  onDelete,
}: FarmCoopGridProps) {
  const { t } = useTranslation();
  const columns = useFarmCoopColumns(
    isReadOnly ? undefined : { onEdit: onEdit ?? (() => {}), onDelete: onDelete ?? (() => {}) },
  );

  const errorSet = new Set(errorRowIds ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {t("nf.farmCooperatives")}
          <Badge variant="secondary">{farmCoops.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={farmCoops}
          isLoading={isLoading}
          emptyMessage={t("nf.emptyFarmCoops")}
          pageSize={10}
          getRowClassName={(row) =>
            errorSet.has((row as FarmCoopResponse).id) ? "bg-destructive/5" : undefined
          }
        />
      </CardContent>
    </Card>
  );
}
