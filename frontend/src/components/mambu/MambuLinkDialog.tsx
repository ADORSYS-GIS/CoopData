import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MambuApexCooperative } from "@/hooks/mambu/useMambu";
import { useClearMambuLink, useSetMambuLink } from "@/hooks/mambu/useMambuScoped";
import { MambuBranchField } from "./MambuBranchField";

interface Props {
  cooperative: MambuApexCooperative | null;
  onClose: () => void;
}

const LinkForm: React.FC<{ cooperative: MambuApexCooperative; onClose: () => void }> = ({
  cooperative,
  onClose,
}) => {
  const { t } = useTranslation();
  const [branchId, setBranchId] = useState("");
  const setLink = useSetMambuLink(cooperative.id);
  const clearLink = useClearMambuLink(cooperative.id);

  const save = () =>
    setLink.mutate(branchId, {
      onSuccess: () => {
        toast.success(t("mambu.linked", { defaultValue: "Cooperative linked to Mambu" }));
        onClose();
      },
      onError: (e) => toast.error(e.message),
    });

  const remove = () =>
    clearLink.mutate(undefined, {
      onSuccess: () => {
        toast.success(t("mambu.unlinked", { defaultValue: "Mambu link removed" }));
        onClose();
      },
      onError: (e) => toast.error(e.message),
    });

  if (cooperative.link_locked) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("mambu.linkLocked", {
          defaultValue:
            "This cooperative has already been synced from Mambu, so its link is fixed and cannot be changed or removed.",
        })}
      </p>
    );
  }

  return (
    <>
      <MambuBranchField value={branchId} onChange={setBranchId} cooperativeId={cooperative.id} />
      <DialogFooter className="gap-2 sm:justify-between">
        {cooperative.mambu_branch_id ? (
          <Button variant="outline" disabled={clearLink.isPending} onClick={remove}>
            {t("mambu.unlink", { defaultValue: "Remove link" })}
          </Button>
        ) : (
          <span />
        )}
        <Button disabled={!branchId.trim() || setLink.isPending} onClick={save}>
          {t("mambu.saveLink", { defaultValue: "Link this branch" })}
        </Button>
      </DialogFooter>
    </>
  );
};

/** Search a Mambu branch by name or ID, check it is the right SACCO, then link it. */
export const MambuLinkDialog: React.FC<Props> = ({ cooperative, onClose }) => {
  const { t } = useTranslation();
  return (
    <Dialog open={!!cooperative} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t("mambu.linkDialogTitle", {
              defaultValue: "Link {{name}} to Mambu",
              name: cooperative?.name,
            })}
          </DialogTitle>
          <DialogDescription>
            {cooperative?.mambu_branch_id
              ? t("mambu.linkDialogCurrent", {
                  defaultValue: "Currently linked to branch {{id}}. Search to change it.",
                  id: cooperative.mambu_branch_id,
                })
              : t("mambu.linkDialogHelp", {
                  defaultValue:
                    "Type part of the SACCO name or its Mambu ID, press Search, then choose the branch.",
                })}
          </DialogDescription>
        </DialogHeader>
        {cooperative && (
          <LinkForm key={cooperative.id} cooperative={cooperative} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
};
