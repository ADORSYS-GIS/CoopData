import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Card, StatusPill } from "@/components/app-shell";
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
  useDeleteMambuLink,
  useMambuBranches,
  useMambuCooperatives,
  useMambuStatus,
  useUpsertMambuLink,
} from "@/hooks/mambu/useMambu";

export const MambuLinksPanel: React.FC = () => {
  const { t } = useTranslation();
  const status = useMambuStatus();
  const branches = useMambuBranches(status.data?.configured ?? false);
  const coops = useMambuCooperatives();
  const upsert = useUpsertMambuLink();
  const unlink = useDeleteMambuLink();
  const [filter, setFilter] = useState("");

  const coopName = useMemo(
    () => new Map((coops.data ?? []).map((c) => [c.id, c.name])),
    [coops.data],
  );
  const rows = (branches.data ?? []).filter((b) =>
    `${b.name} ${b.id}`.toLowerCase().includes(filter.toLowerCase()),
  );

  const link = (branchId: string, cooperativeId: string) =>
    upsert.mutate(
      { cooperative_id: cooperativeId, mambu_branch_id: branchId },
      {
        onSuccess: () => toast.success(t("mambu.linked", { defaultValue: "SACCO linked" })),
        onError: (e) => toast.error(e.message),
      },
    );

  const remove = (cooperativeId: string) =>
    unlink.mutate(cooperativeId, {
      onSuccess: () => toast.success(t("mambu.unlinked", { defaultValue: "Link removed" })),
      onError: (e) => toast.error(e.message),
    });

  return (
    <Card
      title={t("mambu.linksTitle", { defaultValue: "SACCO links" })}
      subtitle={t("mambu.linksSubtitle", {
        defaultValue:
          "Each SACCO is a Mambu branch. Link the branch to its CoopData cooperative once. Branches that are not SACCOs stay unlinked and are never synced.",
      })}
    >
      {!status.data?.configured ? (
        <p className="text-sm text-destructive">
          {t("mambu.notConfigured", {
            defaultValue: "The Mambu integration is not configured on this server.",
          })}
        </p>
      ) : branches.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : branches.error ? (
        <p className="text-sm text-destructive">{branches.error.message}</p>
      ) : (
        <div className="space-y-3">
          <Input
            placeholder={t("mambu.filterBranches", { defaultValue: "Filter branches" })}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-sm"
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mambu branch</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>State</TableHead>
                <TableHead>CoopData cooperative</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    {b.name}
                    <div className="text-xs text-muted-foreground">{b.id}</div>
                  </TableCell>
                  <TableCell>{b.region ?? "—"}</TableCell>
                  <TableCell>
                    <StatusPill tone={b.state === "ACTIVE" ? "success" : "neutral"}>
                      {b.state ?? "—"}
                    </StatusPill>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={b.linked_cooperative_id ?? ""}
                      onValueChange={(coopId) => link(b.id, coopId)}
                    >
                      <SelectTrigger className="w-64" aria-label={`Cooperative for ${b.name}`}>
                        <SelectValue
                          placeholder={t("mambu.notLinked", { defaultValue: "Not linked" })}
                        >
                          {b.linked_cooperative_id
                            ? coopName.get(b.linked_cooperative_id)
                            : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(coops.data ?? []).map((c) => (
                          <SelectItem
                            key={c.id}
                            value={c.id}
                            disabled={
                              !!c.linked_mambu_branch_id && c.id !== b.linked_cooperative_id
                            }
                          >
                            {c.name}
                            {c.institution_type ? ` (${c.institution_type})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {b.linked_cooperative_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(b.linked_cooperative_id as string)}
                      >
                        {t("mambu.unlink", { defaultValue: "Unlink" })}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
};
