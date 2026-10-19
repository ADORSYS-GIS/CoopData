import type { FC } from "react";

import { rateNote } from "@/lib/basic-dashboard";
import { analyseQuestionnaire } from "@/pages/shared/print/quest/data";
import { membershipPage } from "@/pages/shared/print/quest/pages1";
import { resiliencePage, savingsLoanQualityPage } from "@/pages/shared/print/quest/pages2";
import {
  annexAPages,
  annexBPages,
  mpcFinancialRatiosPage,
  performancePage,
} from "@/pages/shared/print/quest/pages3";
import {
  cooperativePages,
  coveragePage,
  executivePage,
  findingsPage,
} from "@/pages/shared/print/questcons/pages";
import { longDate, tr } from "@/pages/shared/print/tpl/i18n";
import { TplDocument, type PageSpec } from "@/pages/shared/print/tpl/TplDocument";
import type { BasicDashboardResponse } from "@/types/basic-dashboard";

export type QuestionnaireTier = "Apex" | "Federation" | "Ministry";

interface Props {
  tier: QuestionnaireTier;
  entityName: string;
  year: number;
  dashboard: BasicDashboardResponse;
}

const tierLabel = (tier: QuestionnaireTier): string =>
  tier === "Apex"
    ? tr("quest.cons.tier_apex")
    : tier === "Federation"
      ? tr("quest.cons.tier_federation")
      : tr("quest.cons.tier_ministry");

const issuerOf = (tier: QuestionnaireTier): string =>
  tier === "Apex"
    ? tr("common.apex_organisation")
    : tier === "Federation"
      ? tr("quest.cons.tier_federation")
      : tr("quest.cons.issuer_ministry");

/** Consolidated report built from the questionnaire returns of the cooperatives in scope. */
export const QuestionnaireConsolidatedReport: FC<Props> = ({
  tier,
  entityName,
  year,
  dashboard,
}) => {
  const subject = tier === "Ministry" ? tr("quest.cons.national") : entityName;
  const base = analyseQuestionnaire({
    dashboard,
    submissionId: "",
    coopName: subject,
    narratives: null,
  });
  const ref = `QSC-${tier.slice(0, 3).toUpperCase()}-${year}`;
  const a = { ...base, ref };
  const { scope } = dashboard;
  const date = longDate(new Date());
  const currency = rateNote(scope) ? `${scope.currency} (${rateNote(scope)})` : scope.currency;
  const filed = tr("quest.cons.filed_of", {
    reporting: scope.cooperatives_reporting,
    inScope: scope.cooperatives_in_scope,
  });

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
    savingsLoanQualityPage(a, next()),
    resiliencePage(a, next()),
    performancePage(a, next()),
    ...optional((no) => mpcFinancialRatiosPage(a, no)),
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
        headLeft: tr("quest.cons.head", { tier: tierLabel(tier) }),
        headRight: `${subject.toUpperCase()} · ${a.period.toUpperCase()}`,
        footLeft: tr("quest.cons.foot_left"),
        footMid: tr("coop.report.ref", { ref }),
      }}
      cover={{
        kicker: tr("quest.cons.kicker"),
        title: [tr("quest.cons.title_1", { tier: tierLabel(tier) }), tr("quest.cons.title_2")],
        entity: subject,
        entityNote: tr("quest.cons.note", { issuer: issuerOf(tier), filed }),
        badge: tr("quest.cons.badge"),
        meta: [
          { label: tr("common.reporting_period"), value: a.period },
          { label: tr("quest.cons.meta_filed"), value: filed },
          { label: tr("common.reporting_currency"), value: scope.currency },
          { label: tr("common.date_of_issue"), value: date },
        ],
        footLeft: tr("common.prepared_by"),
        footRight: tr("quest.cons.foot_right"),
      }}
      front={{
        particulars: [
          [tr("quest.cons.issuing_authority"), issuerOf(tier), tr("quest.cons.scope"), subject],
          [
            tr("quest.cons.report_type"),
            tr("quest.cons.report_type_value"),
            tr("common.reporting_period"),
            a.period,
          ],
          [
            tr("quest.cons.in_scope"),
            String(scope.cooperatives_in_scope),
            tr("quest.cons.questionnaires_filed"),
            filed,
          ],
          [tr("common.reporting_currency"), currency, tr("common.date_of_issue"), date],
          [
            tr("common.benchmark_framework"),
            tr("common.pearls_adapted"),
            tr("quest.cons.reference"),
            ref,
          ],
        ],
        basisTitle: tr("quest.cons.basis_title"),
        basis: tr("quest.cons.basis"),
      }}
      pages={pages}
    />
  );
};
