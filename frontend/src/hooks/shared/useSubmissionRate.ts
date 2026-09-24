import { useReconciliationAudit } from "@/hooks/analytics/useReconciliationAudit";

export const useSubmissionRate = (submissionId: string | null | undefined) => {
  const { data } = useReconciliationAudit(submissionId);
  const rateUsed = data?.rate_used ?? null;
  return { rateUsed, rateToUsd: rateUsed?.rate_to_usd ?? null };
};
