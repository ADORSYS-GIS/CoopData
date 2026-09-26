import type { FC } from "react";

import type { QuestionnaireReportProps } from "@/pages/shared/print/components/questionnaire/types";
import { rateNote } from "@/lib/basic-dashboard";
import { analyseQuestionnaire } from "@/pages/shared/print/quest/data";
import { executivePage, membershipPage } from "@/pages/shared/print/quest/pages1";
import { liquidityCapitalPage, portfolioPage, riskPage } from "@/pages/shared/print/quest/pages2";
import {
  annexAPages,
  annexBPages,
  assetTrendPage,
  findingsPage,
  structurePage,
} from "@/pages/shared/print/quest/pages3";
import { TplDocument, type PageSpec } from "@/pages/shared/print/tpl/TplDocument";

interface Props extends QuestionnaireReportProps {
  apexName?: string | null;
  status?: string;
}

const issued = () =>
  new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const capitalize = (text: string): string =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : text;

/** Report for a cooperative that answered the questionnaire, in the supervisory template. */
export const QuestionnaireTplReport: FC<Props> = ({ apexName, status, ...props }) => {
  const a = analyseQuestionnaire(props);
  const { scope } = props.dashboard;
  const { coopName } = props;
  const date = issued();
  const state = status ? capitalize(status) : "Approved";
  const currency = rateNote(scope) ? `${scope.currency} (${rateNote(scope)})` : scope.currency;

  let n = 0;
  const next = () => String(++n);
  const optional = (build: (no: string) => PageSpec | null): PageSpec[] => {
    const spec = build(String(n + 1));
    if (spec) n += 1;
    return spec ? [spec] : [];
  };
  const pages: PageSpec[] = [
    executivePage(a, next()),
    membershipPage(a, next()),
    portfolioPage(a, next()),
    riskPage(a, next()),
    liquidityCapitalPage(a, next()),
    structurePage(a, next()),
    ...optional((no) => assetTrendPage(a, no)),
    findingsPage(a, next()),
    ...annexAPages(a, "A"),
    ...annexBPages(a, "B"),
  ];

  return (
    <TplDocument
      frame={{
        headLeft: "COOP DATA · QUESTIONNAIRE ASSESSMENT",
        headRight: `${coopName.toUpperCase()} · ${a.period.toUpperCase()}`,
        footLeft: "RESTRICTED — For supervisory use only",
        footMid: `Ref. ${a.ref}`,
      }}
      cover={{
        kicker: "Questionnaire-based Assessment",
        title: ["Cooperative Supervisory", `Report — ${a.period}`],
        entity: coopName,
        entityNote: apexName ? `Affiliated to ${apexName}` : "Cooperative",
        badge: "RESTRICTED",
        meta: [
          { label: "Reporting period", value: a.period },
          { label: "Submission ref.", value: a.ref },
          { label: "Date of issue", value: date },
          { label: "Reporting currency", value: scope.currency },
        ],
        footLeft: "Prepared by Coop Data · Unified Cooperative Financial Intelligence & Compliance",
        footRight: "Figures as answered by the cooperative",
      }}
      front={{
        particulars: [
          ["Cooperative", coopName, "Apex organisation", apexName ?? "—"],
          ["Reporting period", a.period, "Submission ref.", a.ref],
          ["Date of issue", date, "Submission status", state],
          ["Reporting currency", currency, "Data collection", "Questionnaire (basic tier)"],
          ["Benchmark framework", "WOCCU PEARLS (adapted)", "Version", "1.0"],
        ],
        basis:
          "This assessment is compiled from the questionnaire the cooperative answered through the Coop Data platform. It is not based on financial statements. Some indicators are estimated from grouped answers and some cannot be computed when a question was left unanswered; both are listed in Annex A. Liquidity is measured against member savings and institutional capital against total assets, as defined in Annex B. Figures have not been independently audited.",
      }}
      pages={pages}
    />
  );
};
