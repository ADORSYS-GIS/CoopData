import { useState } from "react";
import { Link2, Link2Off } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  useClearMambuLink,
  useCooperativeMambuLink,
  useSetMambuLink,
} from "@/hooks/mambu/useMambuScoped";
import { MambuBranchField } from "./MambuBranchField";

/** Shows and edits the Mambu branch of one cooperative. For apex and Ministry users. */
export const CooperativeMambuLink: React.FC<{ cooperativeId: string }> = ({ cooperativeId }) => {
  const { t } = useTranslation();
  const link = useCooperativeMambuLink(cooperativeId);
  const setLink = useSetMambuLink(cooperativeId);
  const clearLink = useClearMambuLink(cooperativeId);
  const [branchId, setBranchId] = useState("");

  const current = link.data?.mambu_branch_id ?? null;

  const save = () =>
    setLink.mutate(branchId, {
      onSuccess: () => {
        toast.success(t("mambu.linked", { defaultValue: "Cooperative linked to Mambu" }));
        setBranchId("");
      },
      onError: (e) => toast.error(e.message),
    });

  const remove = () =>
    clearLink.mutate(undefined, {
      onSuccess: () => toast.success(t("mambu.unlinked", { defaultValue: "Mambu link removed" })),
      onError: (e) => toast.error(e.message),
    });

  return (
    <Card
      title={t("mambu.linkTitle", { defaultValue: "Mambu link" })}
      subtitle={t("mambu.linkSubtitle", {
        defaultValue: "The Mambu branch this cooperative is read from.",
      })}
    >
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm">
          {current ? (
            <>
              <Link2 className="size-4 text-success" />
              {t("mambu.linkedTo", { defaultValue: "Linked to branch" })} <strong>{current}</strong>
            </>
          ) : (
            <>
              <Link2Off className="size-4 text-muted-foreground" />
              {t("mambu.notLinkedShort", { defaultValue: "Not linked to Mambu" })}
            </>
          )}
        </p>
        <MambuBranchField value={branchId} onChange={setBranchId} cooperativeId={cooperativeId} />
        <div className="flex gap-2">
          <Button size="sm" disabled={!branchId.trim() || setLink.isPending} onClick={save}>
            {current
              ? t("mambu.changeLink", { defaultValue: "Change link" })
              : t("mambu.link", { defaultValue: "Link" })}
          </Button>
          {current && (
            <Button size="sm" variant="outline" disabled={clearLink.isPending} onClick={remove}>
              {t("mambu.unlink", { defaultValue: "Remove link" })}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
