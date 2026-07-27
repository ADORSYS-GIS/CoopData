import { KpiItemResponse, SubmissionLineItemsResponse } from "@/hooks/submissions/useCooperativeKpis";

export const findKpi = (kpiMap: Map<string, KpiItemResponse>, name: string) => kpiMap.get(name);

export const getLineItem = (lineItemsData: SubmissionLineItemsResponse | undefined, code: string | number, isPrior = false) => {
  if (!lineItemsData) return undefined;
  const list = isPrior ? lineItemsData.prior_year : lineItemsData.current_year;
  return list?.find((item) => item.account_code?.toString() === code.toString())?.value;
};

export const calculateYoY = (current?: number | null, prior?: number | null) => {
  if (current === undefined || current === null || prior === undefined || prior === null || prior === 0) return "—";
  const change = ((current - prior) / prior) * 100;
  return `${change > 0 ? "+" : ""}${change.toFixed(1)}%`;
};

export const formatCurrency = (val: number | undefined | null) => {
  if (val === undefined || val === null) return "—";
  return val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
