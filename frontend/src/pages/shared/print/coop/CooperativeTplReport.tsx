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

const issued = () =>
  new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const capitalize = (text: string): string =>
  text ? text.charAt(0).toUpperCase() + text.slice(1) : text;

/** Individual cooperative report in the supervisory report template. */
export const CooperativeTplReport: FC<ReportDataProps> = (props) => {
  const a = analyseCoop(props);
  const { submission, coopName } = props;
  const year = a.year;
  const date = issued();
  const status = capitalize(submission.status);

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
    ...optional((no) => trendPage({ rows: trendOf(props.trend), no, scope: "the cooperative" })),
    ...optional((no) => peerPage(a, no)),
    findingsPage(a, next()),
    ...annexAPages(a, "A"),
    annexBPage(a, "B"),
  ];

  return (
    <TplDocument
      frame={{
        headLeft: "COOP DATA · ANNUAL FINANCIAL & COMPLIANCE ASSESSMENT",
        headRight: `${coopName.toUpperCase()} · FY ${year}`,
        footLeft: "RESTRICTED — For supervisory use only",
        footMid: `Ref. ${a.ref}`,
      }}
      cover={{
        kicker: "Annual Financial & Compliance Assessment",
        title: ["Cooperative Supervisory", `Report — Financial Year ${year}`],
        entity: coopName,
        entityNote: submission.apex_name ? `Affiliated to ${submission.apex_name}` : "Cooperative",
        badge: "RESTRICTED",
        meta: [
          { label: "Reporting period", value: `1 Jan – 31 Dec ${year}` },
          { label: "Submission ref.", value: a.ref },
          { label: "Date of issue", value: date },
          { label: "Submission status", value: status },
        ],
        footLeft: "Prepared by Coop Data · Unified Cooperative Financial Intelligence & Compliance",
        footRight: "Figures as reported by the cooperative",
      }}
      front={{
        particulars: [
          ["Cooperative", coopName, "Apex organisation", submission.apex_name ?? "—"],
          ["Reporting period", `FY ${year} (comparative FY ${year - 1})`, "Submission ref.", a.ref],
          ["Date of issue", date, "Submission status", status],
          [
            "Reporting currency",
            "As reported by the cooperative",
            "Classification",
            "Restricted — supervisory use",
          ],
          ["Benchmark framework", "WOCCU PEARLS (adapted)", "Version", "1.0"],
        ],
        basis:
          "This assessment is compiled from the annual return submitted by the cooperative through the Coop Data platform. Ratios have been recomputed from the submitted statements of financial position and performance. Where a figure produced by the automated system could not be reconciled to the underlying statements, the reported figure is used in the body of this report and the difference is disclosed in Annex A. Figures have not been independently audited.",
      }}
      pages={pages}
    />
  );
};
