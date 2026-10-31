import { useState } from "react";
import { CheckCircle2, Search, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSearchMambuBranches, type MambuBranchPreview } from "@/hooks/mambu/useMambuScoped";

interface Props {
  /** The Mambu branch ID. Typing a name only searches; choosing a result fills the ID. */
  value: string;
  onChange: (value: string) => void;
  /** Cooperative the branch is for, so its current link shows as available. */
  cooperativeId?: string;
  disabled?: boolean;
}

/**
 * Finds the Mambu branch of a SACCO by its ID or by part of its name. Only free
 * branches are listed, a few at a time, so the apex confirms the right SACCO by
 * name without being able to browse every branch.
 */
export const MambuBranchField: React.FC<Props> = ({ value, onChange, cooperativeId, disabled }) => {
  const { t } = useTranslation();
  const search = useSearchMambuBranches();
  const [selected, setSelected] = useState<MambuBranchPreview | null>(null);

  const choose = (branch: MambuBranchPreview) => {
    setSelected(branch);
    onChange(branch.id);
  };

  const run = () => {
    const query = value.trim();
    if (!query) return;
    setSelected(null);
    search.mutate(
      { query, cooperativeId },
      {
        onSuccess: (found) => {
          const exact = found.filter((b) => b.id.toLowerCase() === query.toLowerCase());
          if (exact.length === 1) choose(exact[0]);
        },
      },
    );
  };

  const results = !selected ? (search.data ?? []) : [];

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={value}
          disabled={disabled}
          placeholder={t("mambu.branchSearchPlaceholder", {
            defaultValue: "Search by SACCO name or Mambu ID",
          })}
          aria-label={t("mambu.branchId", { defaultValue: "Mambu branch" })}
          onChange={(e) => {
            onChange(e.target.value);
            setSelected(null);
            search.reset();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              run();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !value.trim() || search.isPending}
          onClick={run}
        >
          <Search className="mr-2 h-4 w-4" />
          {t("mambu.searchBranch", { defaultValue: "Search" })}
        </Button>
      </div>
      {results.length > 0 && (
        <ul className="divide-y rounded-md border text-sm">
          {results.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted"
                onClick={() => choose(b)}
              >
                <span>{b.name}</span>
                <span className="text-xs text-muted-foreground">{b.id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {search.isSuccess && !selected && results.length === 0 && (
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <XCircle className="h-4 w-4" />
          {t("mambu.noBranchFound", {
            defaultValue: "No free Mambu branch matches. It may already be linked.",
          })}
        </p>
      )}
      {selected && (
        <p className="flex items-center gap-1 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          {t("mambu.branchFound", {
            defaultValue: "Selected: {{name}} ({{id}}). Make sure this is the right SACCO.",
            name: selected.name ?? selected.id,
            id: selected.id,
          })}
        </p>
      )}
      {search.error && (
        <p className="flex items-center gap-1 text-sm text-destructive">
          <XCircle className="h-4 w-4" />
          {search.error.message}
        </p>
      )}
    </div>
  );
};
