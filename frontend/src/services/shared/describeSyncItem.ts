import type { TFunction } from "i18next";
import type { SyncQueueItem } from "./offlineDb";

/** First matching endpoint pattern names the thing the change was about. */
const SUBJECTS: [RegExp, string][] = [
  [/\/sections\//, "section"],
  [/\/questionnaire(\?|$)/, "questionnaire"],
  [/financial-statement|line-items/, "financialStatement"],
  [/non-financial-indicators/, "indicators"],
  [/\/narratives/, "narratives"],
  [/non-financial\/members|manual-members|\/non-financial$/, "members"],
  [/non-financial\/savings/, "savings"],
  [/non-financial\/loans/, "loans"],
  [/non-financial\/fixed-deposits/, "fixedDeposits"],
  [/non-financial\/farm-coop/, "farmCoop"],
  [/\/submissions/, "submission"],
  [/\/invitations/, "invitation"],
  [/\/users/, "user"],
  [/\/organizations/, "organization"],
  [/\/federations/, "federation"],
  [/\/apexes/, "apex"],
  [/\/cooperatives|coop-profiles/, "cooperative"],
  [/custom-kpis/, "customKpi"],
  [/questionnaire-templates/, "questionnaireTemplate"],
  [/\/catalog/, "indicatorCatalog"],
];

const ACTIONS: Record<SyncQueueItem["method"], string> = {
  POST: "create",
  PUT: "update",
  PATCH: "update",
  DELETE: "delete",
};

/** "Update · Submission section" — what the user did, in their language. */
export function describeSyncItem(item: SyncQueueItem, t: TFunction): string {
  const subject = SUBJECTS.find(([pattern]) => pattern.test(item.endpoint))?.[1] ?? "change";
  return `${t(`sync.action.${ACTIONS[item.method]}`)} · ${t(`sync.subject.${subject}`)}`;
}

/** Why the server didn't take it: its own message, or a plain explanation. */
export function describeSyncFailure(item: SyncQueueItem, t: TFunction): string {
  if (item.lastStatus === undefined) return t("sync.reason.network");
  if (item.lastStatus === 401) return t("sync.reason.sessionExpired");
  if (item.lastStatus === 403) return t("sync.reason.forbidden");
  if (item.lastStatus === 404 || item.lastStatus === 410) return t("sync.reason.notFound");
  return item.lastError || t("sync.reason.server");
}
