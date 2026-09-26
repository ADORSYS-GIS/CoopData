import type { FC } from "react";

import { rateNote } from "@/lib/basic-dashboard";
import { analyseQuestionnaire } from "@/pages/shared/print/quest/data";
import { membershipPage } from "@/pages/shared/print/quest/pages1";
import { liquidityCapitalPage, portfolioPage, riskPage } from "@/pages/shared/print/quest/pages2";
import {
  annexAPages,
  annexBPages,
  assetTrendPage,
  structurePage,
} from "@/pages/shared/print/quest/pages3";
import {
  cooperativePages,
  coveragePage,
  executivePage,
  findingsPage,
} from "@/pages/shared/print/questcons/pages";
import { TplDocument, type PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import type { BasicDashboardResponse } from "@/types/basic-dashboard";

export type QuestionnaireTier = "Apex" | "Federation" | "Ministry";

interface Props {
  tier: QuestionnaireTier;
  entityName: string;
  year: number;
  dashboard: BasicDashboardResponse;
}

const ISSUER: Record<QuestionnaireTier, string> = {
  Apex: "Apex organisation",
  Federation: "Federation",
  Ministry: "Ministry of Commerce, Industry and Trade",
};

const issued = () =>
  new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** Consolidated report built from the questionnaire returns of the cooperatives in scope. */
export const QuestionnaireConsolidatedReport: FC<Props> = ({
  tier,
  entityName,
  year,
  dashboard,
}) => {
  const subject = tier === "Ministry" ? "National Cooperative Overview" : entityName;
  const base = analyseQuestionnaire({
    dashboard,
    submissionId: "",
    coopName: subject,
    narratives: null,
  });
  const ref = `QSC-${tier.slice(0, 3).toUpperCase()}-${year}`;
  const a = { ...base, ref };
  const { scope } = dashboard;
  const date = issued();
  const currency = rateNote(scope) ? `${scope.currency} (${rateNote(scope)})` : scope.currency;
  const filed = `${scope.cooperatives_reporting} of ${scope.cooperatives_in_scope}`;

  let n = 0;
  const next = () => String(++n);
  const optional = (build: (no: string) => PageSpec | null): PageSpec[] => {
    const spec = build(String(n + 1));
    if (spec) n += 1;
    return spec ? [spec] : [];
  };
  const pages: PageSpec[] = [
    executivePage(a, next()),
    coveragePage(a, next()),
    membershipPage(a, next()),
    portfolioPage(a, next()),
    riskPage(a, next()),
    liquidityCapitalPage(a, next()),
    structurePage(a, next()),
    ...optional((no) => assetTrendPage(a, no)),
  ];
  const overview = cooperativePages(a, String(n + 1));
  if (overview.length > 0) {
    n += 1;
    pages.push(...overview);
  }
  pages.push(findingsPage(a, next(), subject), ...annexAPages(a, "A"), ...annexBPages(a, "B"));

  return (
    <TplDocument
      frame={{
        headLeft: `COOP DATA · ${tier.toUpperCase()} QUESTIONNAIRE CONSOLIDATED REPORT`,
        headRight: `${subject.toUpperCase()} · ${a.period.toUpperCase()}`,
        footLeft: "OFFICIAL — Confidential",
        footMid: `Ref. ${ref}`,
      }}
      cover={{
        kicker: "Consolidated questionnaire returns",
        title: [`${tier} Questionnaire`, "Consolidated Report"],
        entity: subject,
        entityNote: `${ISSUER[tier]} · ${filed} cooperatives filed a questionnaire`,
        badge: "OFFICIAL · CONFIDENTIAL",
        meta: [
          { label: "Reporting period", value: a.period },
          { label: "Cooperatives filed", value: filed },
          { label: "Reporting currency", value: scope.currency },
          { label: "Date of issue", value: date },
        ],
        footLeft: "Prepared by Coop Data · Unified Cooperative Financial Intelligence & Compliance",
        footRight: "Figures as answered by the cooperatives",
      }}
      front={{
        particulars: [
          ["Issuing authority", ISSUER[tier], "Scope", subject],
          ["Report type", "Consolidated questionnaire report", "Reporting period", a.period],
          [
            "Cooperatives in scope",
            String(scope.cooperatives_in_scope),
            "Questionnaires filed",
            filed,
          ],
          ["Reporting currency", currency, "Date of issue", date],
          ["Benchmark framework", "WOCCU PEARLS (adapted)", "Reference", ref],
        ],
        basisTitle: "Purpose and basis of preparation",
        basis:
          "This report consolidates the questionnaires answered by the cooperatives in scope. Cooperatives that report with full financial statements are covered by the standard consolidated report. Amounts and counts are summed across the cooperatives that filed, and ratios are computed from those sums. Some indicators are estimated or cannot be computed; they are listed in Annex A. Where cooperatives answered for different periods, the latest period of the year is used. Figures have not been independently audited.",
      }}
      pages={pages}
    />
  );
};
