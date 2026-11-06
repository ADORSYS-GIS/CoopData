import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMambuProducts, useMambuStatus, useUpsertProductMapping } from "@/hooks/mambu/useMambu";

const DEPOSIT_TYPES: { value: string; label: string }[] = [
  { value: "Voluntary", label: "Voluntary savings" },
  { value: "Mandatory", label: "Mandatory savings" },
  { value: "Share", label: "Share capital" },
  { value: "FixedDeposit", label: "Fixed deposit" },
  { value: "Ignore", label: "Not reported" },
];
const LOAN_TYPES = ["Personal", "Business", "Agriculture", "Education", "Other"].map((v) => ({
  value: v,
  label: v,
}));
const MAX_ROWS = 100;

/** How each Mambu deposit and loan product is reported. The default is a guess from its name. */
export const MambuProductMappingPanel: React.FC = () => {
  const { t } = useTranslation();
  const status = useMambuStatus();
  const products = useMambuProducts(status.data?.configured ?? false);
  const upsert = useUpsertProductMapping();
  const [filter, setFilter] = useState("");

  const rows = useMemo(
    () =>
      (products.data ?? []).filter((p) =>
        `${p.id} ${p.name ?? ""}`.toLowerCase().includes(filter.toLowerCase()),
      ),
    [products.data, filter],
  );

  const save = (id: string, kind: string, type: string) =>
    upsert.mutate(
      { mambu_product_id: id, product_kind: kind, mapped_type: type },
      { onError: (e) => toast.error(e.message), onSuccess: () => toast.success("Mapping saved") },
    );

  return (
    <Card
      title={t("mambu.productMappingTitle", { defaultValue: "Product mapping" })}
      subtitle={t("mambu.productMappingSubtitle", {
        defaultValue:
          "Choose how each Mambu product is reported, for example a savings product that is really a fixed deposit. The next sync uses your choice.",
      })}
    >
      {products.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : products.error ? (
        <p className="text-sm text-destructive">{products.error.message}</p>
      ) : (
        <div className="space-y-3">
          <Input
            placeholder={t("mambu.filterProducts", { defaultValue: "Filter products" })}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-sm"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Reported as</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, MAX_ROWS).map((p) => {
                const options = p.product_kind === "deposit" ? DEPOSIT_TYPES : LOAN_TYPES;
                return (
                  <TableRow key={`${p.product_kind}-${p.id}`}>
                    <TableCell className="font-medium">
                      {p.name ?? p.id}
                      <div className="text-xs text-muted-foreground">{p.id}</div>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{p.product_kind}</TableCell>
                    <TableCell>
                      <Select
                        value={p.mapped_type ?? ""}
                        onValueChange={(v) => save(p.id, p.product_kind, v)}
                      >
                        <SelectTrigger className="w-60" aria-label={`Type of ${p.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {rows.length > MAX_ROWS && (
            <p className="text-xs text-muted-foreground">
              Showing the first {MAX_ROWS} products. Use the filter to find others.
            </p>
          )}
        </div>
      )}
    </Card>
  );
};
