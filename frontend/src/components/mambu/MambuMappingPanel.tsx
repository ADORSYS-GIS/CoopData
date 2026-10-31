import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
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
import {
  useCoopAccounts,
  useDeleteAccountMapping,
  useMambuGlAccounts,
  useMambuStatus,
  useUpsertAccountMapping,
} from "@/hooks/mambu/useMambu";

const MAX_ROWS = 150;

export const MambuMappingPanel: React.FC = () => {
  const { t } = useTranslation();
  const status = useMambuStatus();
  const gl = useMambuGlAccounts(status.data?.configured ?? false);
  const coa = useCoopAccounts();
  const upsert = useUpsertAccountMapping();
  const remove = useDeleteAccountMapping();
  const [filter, setFilter] = useState("");
  const [unmappedOnly, setUnmappedOnly] = useState(false);
  const [signs, setSigns] = useState<Record<string, number>>({});

  const rows = useMemo(
    () =>
      (gl.data ?? [])
        .filter((a) => (unmappedOnly ? a.mapped_to == null : true))
        .filter((a) => `${a.gl_code} ${a.name ?? ""}`.toLowerCase().includes(filter.toLowerCase())),
    [gl.data, filter, unmappedOnly],
  );

  const save = (glCode: string, coopCode: number, sign: number) =>
    upsert.mutate(
      { mambu_gl_code: glCode, coop_account_code: coopCode, sign },
      { onError: (e) => toast.error(e.message), onSuccess: () => toast.success("Mapping saved") },
    );

  return (
    <Card
      title={t("mambu.mappingTitle", { defaultValue: "Ledger mapping" })}
      subtitle={t("mambu.mappingSubtitle", {
        defaultValue:
          "Map each Mambu ledger account to a CoopData account. Several Mambu accounts can feed one CoopData account. Keep sign +1 unless a Mambu balance has the opposite sign to the CoopData account. Accumulated and current year surplus are computed from income and expense, so only map real equity accounts to them.",
      })}
    >
      {!status.data?.configured ? (
        <p className="text-sm text-destructive">
          {t("mambu.notConfigured", {
            defaultValue: "The Mambu integration is not configured on this server.",
          })}
        </p>
      ) : gl.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : gl.error ? (
        <p className="text-sm text-destructive">{gl.error.message}</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder={t("mambu.filterAccounts", { defaultValue: "Filter accounts" })}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-sm"
            />
            <Button size="sm" variant="outline" onClick={() => setUnmappedOnly((v) => !v)}>
              {unmappedOnly ? "Show all" : "Unmapped only"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {rows.length} / {gl.data?.length ?? 0}
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mambu account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>CoopData account</TableHead>
                <TableHead>Sign</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, MAX_ROWS).map((a) => {
                const sign = signs[a.gl_code] ?? 1;
                return (
                  <TableRow key={a.gl_code}>
                    <TableCell className="font-medium">
                      {a.gl_code}
                      <div className="text-xs text-muted-foreground">{a.name}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {a.account_type} {a.currency ? `· ${a.currency}` : ""}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={a.mapped_to != null ? String(a.mapped_to) : ""}
                        onValueChange={(v) => save(a.gl_code, Number(v), sign)}
                      >
                        <SelectTrigger className="w-72" aria-label={`Account for ${a.gl_code}`}>
                          <SelectValue placeholder="Not mapped" />
                        </SelectTrigger>
                        <SelectContent>
                          {(coa.data ?? []).map((c) => (
                            <SelectItem key={c.account_code} value={String(c.account_code)}>
                              {c.account_code} {c.account_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setSigns((s) => ({ ...s, [a.gl_code]: sign === 1 ? -1 : 1 }))
                        }
                      >
                        {sign === 1 ? "+1" : "-1"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      {a.mapped_to != null && (
                        <Button size="sm" variant="ghost" onClick={() => remove.mutate(a.gl_code)}>
                          Clear
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {rows.length > MAX_ROWS && (
            <p className="text-xs text-muted-foreground">
              Showing the first {MAX_ROWS} accounts. Use the filter to find others.
            </p>
          )}
        </div>
      )}
    </Card>
  );
};
