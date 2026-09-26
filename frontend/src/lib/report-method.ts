export type ReportMethod = "standard" | "questionnaire";

interface MethodSubmission {
  submission_method?: string | null;
}

export interface MethodCounts {
  standard: number;
  questionnaire: number;
}

export const countByMethod = (submissions: readonly MethodSubmission[]): MethodCounts => {
  const counts: MethodCounts = { standard: 0, questionnaire: 0 };
  for (const submission of submissions) {
    if (submission.submission_method === "questionnaire") counts.questionnaire += 1;
    else counts.standard += 1;
  }
  return counts;
};

/** The methods that have data, standard first. */
export const methodsWithData = (counts: MethodCounts): ReportMethod[] => [
  ...(counts.standard > 0 ? (["standard"] as const) : []),
  ...(counts.questionnaire > 0 ? (["questionnaire"] as const) : []),
];

/**
 * The method to export. The user's choice wins; otherwise the only method with
 * data; otherwise nothing, so the user must choose.
 */
export const resolveMethod = (
  chosen: ReportMethod | "",
  available: readonly ReportMethod[],
): ReportMethod | "" => {
  if (chosen && available.includes(chosen)) return chosen;
  return available.length === 1 ? (available[0] ?? "") : "";
};
