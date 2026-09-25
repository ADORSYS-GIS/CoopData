import { useMemo } from "react";

import {
  useApexSubmissions,
  useCooperativeSubmissions,
  useFederationSubmissions,
  useMinistrySubmissions,
} from "@/hooks/submissions/useSubmissions";
import type { Role } from "@/lib/auth";
import { toPeriodOptions } from "@/lib/analytics-filters";

/** Periods with approved submissions inside the caller's scope. */
export const usePeriodOptions = (role: Role | null | undefined) => {
  const cooperative = useCooperativeSubmissions(role === "cooperative");
  const apex = useApexSubmissions(role === "apex");
  const federation = useFederationSubmissions({ enabled: role === "federation" });
  const ministry = useMinistrySubmissions(role === "ministry");

  const submissions =
    role === "cooperative"
      ? cooperative.data
      : role === "apex"
        ? apex.data
        : role === "federation"
          ? federation.data
          : ministry.data;

  return useMemo(() => toPeriodOptions(submissions ?? []), [submissions]);
};
