import type { FC } from "react";

import { analyse, type ConsInput } from "@/pages/shared/print/cons/analysis";
import { executivePage, financialPage } from "@/pages/shared/print/cons/pagesA";
import { cooperativePages, sectorApexPages } from "@/pages/shared/print/cons/pagesB";
import { pearlsPages, socialPage } from "@/pages/shared/print/cons/pagesC";
import { indicatorsPage, portfolioStructurePage } from "@/pages/shared/print/cons/pagesE";
import { annexAPages, annexBPage, findingsPage } from "@/pages/shared/print/cons/pagesD";
import type { Tier } from "@/pages/shared/print/consolidated/stats";
import { TplDocument, type PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import { trendPage } from "@/pages/shared/print/tpl/TrendPage";
import { trendOf } from "@/pages/shared/print/tpl/trend";

const ISSUER: Record<Tier, string> = {
  Apex: "Apex organisation",
  Federation: "Federation",
  Ministry: "Ministry of Commerce, Industry and Trade",
};

const TITLE: Record<Tier, string[]> = {
  Apex: ["Apex Consolidated", "Report"],
  Federation: ["Federation Consolidated", "Report"],
  Ministry: ["Ministry Consolidated", "Report"],
};

const HEAD: Record<Tier, string> = {
  Apex: "COOP DATA · APEX CONSOLIDATED REPORT",
  Federation: "COOP DATA · FEDERATION CONSOLIDATED REPORT",
  Ministry: "COOP DATA · MINISTRY CONSOLIDATED REPORT",
};

const dateOfIssue = () =>
  new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const buildSections = (input: ConsInput): PageSpec[] => {
  const a = analyse(input);
  const pages: PageSpec[] = [];
  let n = 0;
  const next = () => String(++n);

  pages.push(executivePage(a, next()));
  pages.push(financialPage(a, next()));
  const trend = trendOf(input.trend);
  const scopeText = input.tier === "Apex" ? "the apex portfolio" : "the supervised sector";
  const series = trendPage({ rows: trend, no: String(n + 1), scope: scopeText });
  if (series) {
    n += 1;
    pages.push(series);
  }
  const structure = portfolioStructurePage(a, String(n + 1));
  if (structure) {
    n += 1;
    pages.push(structure);
  }
  pages.push(indicatorsPage(a, next(), trend));
  if (input.tier === "Apex") {
    pages.push(...cooperativePages(a, next()));
  } else {
    pages.push(...sectorApexPages(a, next()));
    pages.push(...pearlsPages(a, next()));
  }
  pages.push(socialPage(a, next()));
  pages.push(findingsPage(a, next()));
  pages.push(...annexAPages(a, "A"));
  pages.push(annexBPage("B"));
  return pages;
};

export const ConsolidatedTplReport: FC<ConsInput> = (input) => {
  const { tier, entityName, year, data } = input;
  const total = data.total_cooperatives || data.cooperatives.length;
  const filed = data.cooperatives.filter((c) => c.has_data).length;
  const subject = tier === "Ministry" ? "National Cooperative Overview" : entityName;
  const apexCount = new Set(data.cooperatives.map((c) => c.apex_id).filter(Boolean)).size;
  const scope =
    tier === "Apex"
      ? `${ISSUER[tier]} · ${total} cooperatives under supervision`
      : `${ISSUER[tier]} · ${total} cooperatives under supervision · ${apexCount} apex organisation${apexCount === 1 ? "" : "s"}`;
  const issued = dateOfIssue();

  return (
    <TplDocument
      frame={{
        headLeft: HEAD[tier],
        headRight: `${subject.toUpperCase()} · REPORTING YEAR ${year}`,
        footLeft: "OFFICIAL — Confidential",
        footMid: ISSUER[tier],
      }}
      cover={{
        kicker: "Consolidated sector performance",
        title: TITLE[tier],
        entity: `${subject}`,
        entityNote: scope,
        badge: "OFFICIAL · CONFIDENTIAL",
        meta: [
          { label: "Reporting year", value: String(year) },
          { label: "Supervised cooperatives", value: String(total) },
          { label: "Submission rate", value: `${filed} of ${total}` },
          { label: "Date of issue", value: issued },
        ],
        footLeft: "Prepared by Coop Data · Unified Cooperative Financial Intelligence & Compliance",
        footRight: "Figures as reported by the filing cooperatives",
      }}
      front={{
        particulars: [
          ["Issuing authority", ISSUER[tier], "Scope", subject],
          [
            "Report type",
            "Consolidated supervisory report",
            "Reporting year",
            `${year} (comparative: prior year)`,
          ],
          [
            "Cooperatives covered",
            `${total}`,
            tier === "Apex" ? "Entity" : "Apex organisations",
            tier === "Apex" ? entityName : String(apexCount),
          ],
          ["Returns submitted", `${filed} of ${total}`, "Date of issue", issued],
          [
            "Reporting currency",
            "As reported by the cooperatives",
            "Classification",
            "Official — confidential",
          ],
          ["Benchmark framework", "WOCCU PEARLS (adapted)", "Version", "1.0"],
        ],
        basisTitle: "Purpose and basis of preparation",
        basis: `This report shows ${tier === "Ministry" ? "Ministry leadership" : tier === "Federation" ? "federation leadership" : "the apex organisation"} the condition of the supervised cooperative sector. It is compiled from annual returns submitted through the Coop Data platform. "Average" indicators are simple averages of the cooperatives' ratios; where an aggregate ratio (the ratio of sector totals) can be derived, it is shown beside the average. Figures that could not be reconciled are flagged and explained in Annex A. Figures have not been independently audited.`,
      }}
      pages={buildSections(input)}
    />
  );
};
