import type { FC } from "react";

import type { QuestionnaireReportProps } from "@/pages/shared/print/components/questionnaire/types";
import { analyseQuestionnaire } from "@/pages/shared/print/quest/data";
import { executivePage, membershipPage } from "@/pages/shared/print/quest/pages1";
import { resiliencePage, savingsLoanQualityPage } from "@/pages/shared/print/quest/pages2";
import {
  annexAPages,
  annexBPages,
  findingsPage,
  mpcFinancialRatiosPage,
  performancePage,
} from "@/pages/shared/print/quest/pages3";
import { longDate, tr } from "@/pages/shared/print/tpl/i18n";
import { TplDocument, type PageSpec } from "@/pages/shared/print/tpl/TplDocument";

interface Props extends QuestionnaireReportProps {
  apexName?: string | null;
  status?: string;
}

const capitalize = (text: string): string =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : text;

const statusText = (status: string): string =>
  tr(`common.submission_status_values.${status.toLowerCase()}`, {
    defaultValue: capitalize(status),
  });

/** Report for a cooperative that answered the questionnaire, in the supervisory template. */
export const QuestionnaireTplReport: FC<Props> = ({ apexName, status, ...props }) => {
  const a = analyseQuestionnaire(props);
  const { scope } = props.dashboard;
  const { coopName } = props;
  const date = longDate(new Date());
  const state = statusText(status ?? "approved");

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
    savingsLoanQualityPage(a, next()),
    resiliencePage(a, next()),
    performancePage(a, next()),
    ...optional((no) => mpcFinancialRatiosPage(a, no)),
    findingsPage(a, next()),
    ...annexAPages(a, "A"),
    ...annexBPages(a, "B"),
  ];

  return (
    <TplDocument
      frame={{
        headLeft: tr("quest.report.head"),
        headRight: `${coopName.toUpperCase()} · ${a.period.toUpperCase()}`,
        footLeft: tr("coop.report.restricted_foot"),
        footMid: tr("coop.report.ref", { ref: a.ref }),
      }}
      cover={{
        kicker: tr("quest.report.kicker"),
        title: [tr("coop.report.title_1"), tr("quest.report.title_2", { period: a.period })],
        entity: coopName,
        entityNote: apexName
          ? tr("coop.report.affiliated_to", { apexName })
          : tr("common.cooperative"),
        badge: tr("coop.report.badge"),
        meta: [
          { label: tr("common.reporting_period"), value: a.period },
          { label: tr("common.submission_ref"), value: a.ref },
          { label: tr("common.date_of_issue"), value: date },
          { label: tr("common.reporting_currency"), value: scope.currency },
        ],
        footLeft: tr("common.prepared_by"),
        footRight: tr("coop.report.foot_right"),
      }}
      front={{
        particulars: [
          [tr("common.cooperative"), coopName, tr("common.apex_organisation"), apexName ?? "—"],
          [tr("common.reporting_period"), a.period, tr("common.submission_ref"), a.ref],
          [tr("common.date_of_issue"), date, tr("common.submission_status"), state],
          [
            tr("common.reporting_currency"),
            scope.currency,
            tr("quest.report.data_collection"),
            tr("quest.report.data_collection_value"),
          ],
          [
            tr("common.benchmark_framework"),
            tr("common.pearls_adapted"),
            tr("common.version"),
            "1.0",
          ],
        ],
        basis: tr("quest.report.basis"),
      }}
      pages={pages}
    />
  );
};
