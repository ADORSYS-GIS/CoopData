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
import { longDate, tr } from "@/pages/shared/print/tpl/i18n";

const issuerOf = (tier: Tier): string => tr(`cons.issuer.${tier}`);

const buildSections = (input: ConsInput): PageSpec[] => {
  const a = analyse(input);
  const pages: PageSpec[] = [];
  let n = 0;
  const next = () => String(++n);

  pages.push(executivePage(a, next()));
  pages.push(financialPage(a, next()));
  const trend = trendOf(input.trend);
  const scopeText = input.tier === "Apex" ? input.entityName : tr("trend.scope_sector");
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
  const subject = tier === "Ministry" ? tr("cons.report.national_overview") : entityName;
  const apexCount = new Set(data.cooperatives.map((c) => c.apex_id).filter(Boolean)).size;
  const issuer = issuerOf(tier);
  const scope =
    tier === "Apex"
      ? tr("cons.report.scope_apex", { issuer, total })
      : tr("cons.report.scope_apexes", { issuer, total, count: apexCount });
  const issued = longDate(new Date());
  const ofTotal = tr("cons.report.of", { filed, total });

  return (
    <TplDocument
      frame={{
        headLeft: tr(`cons.head.${tier}`).toUpperCase(),
        headRight: tr("cons.report.head_right", { subject: subject.toUpperCase(), year }),
        footLeft: tr("cons.report.official_foot"),
        footMid: issuer,
      }}
      cover={{
        kicker: tr("cons.report.kicker"),
        title: [tr(`cons.title_1.${tier}`), tr(`cons.title_2.${tier}`)],
        entity: `${subject}`,
        entityNote: scope,
        badge: tr("cons.report.badge"),
        meta: [
          { label: tr("common.reporting_year"), value: String(year) },
          { label: tr("cons.report.supervised"), value: String(total) },
          { label: tr("cons.report.submission_rate"), value: ofTotal },
          { label: tr("common.date_of_issue"), value: issued },
        ],
        footLeft: tr("common.prepared_by"),
        footRight: tr("cons.report.foot_right"),
      }}
      front={{
        particulars: [
          [tr("cons.report.issuing_authority"), issuer, tr("cons.report.scope"), subject],
          [
            tr("cons.report.report_type"),
            tr("cons.report.report_type_value"),
            tr("common.reporting_year"),
            tr("cons.report.year_comparative", { year }),
          ],
          [
            tr("cons.report.covered"),
            `${total}`,
            tier === "Apex" ? tr("cons.report.entity") : tr("cons.report.apex_organisations"),
            tier === "Apex" ? entityName : String(apexCount),
          ],
          [tr("cons.report.returns_submitted"), ofTotal, tr("common.date_of_issue"), issued],
          [
            tr("common.reporting_currency"),
            tr("cons.report.currency_value"),
            tr("common.classification"),
            tr("cons.report.classification_value"),
          ],
          [
            tr("common.benchmark_framework"),
            tr("common.pearls_adapted"),
            tr("common.version"),
            "1.0",
          ],
        ],
        basisTitle: tr("cons.report.basis_title"),
        basis: tr("cons.report.basis", { audience: tr(`cons.report.audience.${tier}`) }),
      }}
      pages={buildSections(input)}
    />
  );
};
