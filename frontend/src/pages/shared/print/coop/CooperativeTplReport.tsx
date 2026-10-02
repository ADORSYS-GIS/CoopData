import type { FC } from "react";

import type { ReportDataProps } from "@/pages/shared/print/components/types";
import { analyseCoop } from "@/pages/shared/print/coop/analysis";
import { executivePage, scorecardPage } from "@/pages/shared/print/coop/pages1";
import { performancePages, positionPages } from "@/pages/shared/print/coop/pages2";
import { loanQualityPage, membershipPage } from "@/pages/shared/print/coop/pages3";
import { peerPage } from "@/pages/shared/print/coop/pages5";
import { annexAPages, annexBPage, findingsPage } from "@/pages/shared/print/coop/pages4";
import { TplDocument, type PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { trendPage } from "@/pages/shared/print/tpl/TrendPage";
import { trendOf } from "@/pages/shared/print/tpl/trend";
import { longDate, tr } from "@/pages/shared/print/tpl/i18n";

const capitalize = (text: string): string =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : text;

const statusText = (status: string): string =>
  tr(`common.submission_status_values.${status.toLowerCase()}`, {
    defaultValue: capitalize(status),
  });

/** Individual cooperative report in the supervisory report template. */
export const CooperativeTplReport: FC<ReportDataProps> = (props) => {
  const a = analyseCoop(props);
  const { submission, coopName } = props;
  const year = a.year;
  const date = longDate(new Date());
  const status = statusText(submission.status);

  let n = 0;
  const next = () => String(++n);
  const optional = (build: (no: string) => PageSpec | null): PageSpec[] => {
    const spec = build(String(n + 1));
    if (spec) n += 1;
    return spec ? [spec] : [];
  };
  const pages: PageSpec[] = [
    executivePage(a, next()),
    scorecardPage(a, next()),
    ...positionPages(a, next()),
    ...performancePages(a, next()),
    loanQualityPage(a, next()),
    membershipPage(a, next()),
    ...optional((no) => trendPage({ rows: trendOf(props.trend), no, scope: coopName })),
    ...optional((no) => peerPage(a, no)),
    findingsPage(a, next()),
    ...annexAPages(a, "A"),
    annexBPage(a, "B"),
  ];

  return (
    <TplDocument
      frame={{
        headLeft: tr("coop.report.head"),
        headRight: `${coopName.toUpperCase()} · ${tr("common.fy", { year }).toUpperCase()}`,
        footLeft: tr("coop.report.restricted_foot"),
        footMid: tr("coop.report.ref", { ref: a.ref }),
      }}
      cover={{
        kicker: tr("coop.report.kicker"),
        title: [tr("coop.report.title_1"), tr("coop.report.title_2", { year })],
        entity: coopName,
        entityNote: submission.apex_name
          ? tr("coop.report.affiliated_to", { apexName: submission.apex_name })
          : tr("common.cooperative"),
        badge: tr("coop.report.badge"),
        meta: [
          { label: tr("common.reporting_period"), value: tr("coop.report.period_value", { year }) },
          { label: tr("common.submission_ref"), value: a.ref },
          { label: tr("common.date_of_issue"), value: date },
          { label: tr("common.submission_status"), value: status },
        ],
        footLeft: tr("common.prepared_by"),
        footRight: tr("coop.report.foot_right"),
      }}
      front={{
        particulars: [
          [
            tr("common.cooperative"),
            coopName,
            tr("common.apex_organisation"),
            submission.apex_name ?? "—",
          ],
          [
            tr("common.reporting_period"),
            tr("coop.report.period_comparative", { year, prior: year - 1 }),
            tr("common.submission_ref"),
            a.ref,
          ],
          [tr("common.date_of_issue"), date, tr("common.submission_status"), status],
          [
            tr("common.reporting_currency"),
            tr("coop.report.currency_value"),
            tr("common.classification"),
            tr("coop.report.classification_value"),
          ],
          [
            tr("common.benchmark_framework"),
            tr("common.pearls_adapted"),
            tr("common.version"),
            "1.0",
          ],
        ],
        basis: tr("coop.report.basis"),
      }}
      pages={pages}
    />
  );
};
