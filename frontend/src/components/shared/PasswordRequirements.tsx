import { Check, X } from "lucide-react";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import { validatePassword } from "@/lib/passwordPolicy";

interface PasswordRequirementsProps {
  password: string;
  username?: string;
}

export const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({
  password,
  username,
}) => {
  const { t } = useOrganizationLabelsContext();
  const rules = validatePassword(password, username);

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl border border-border bg-muted/30 p-3.5">
      {rules.map((rule) => (
        <li
          key={rule.key}
          className={`flex items-center gap-2 text-xs transition-colors ${
            rule.met ? "text-success" : "text-muted-foreground"
          }`}
        >
          {rule.met ? (
            <Check className="size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <X className="size-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>{t(`profile.passwordRule.${rule.key}`)}</span>
        </li>
      ))}
    </ul>
  );
};
