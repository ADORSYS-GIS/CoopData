import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { ReportReadiness } from "./report-readiness";
import type { ReportStatus } from "@/hooks/reports/useReportExport";

const prepare = vi.fn(() => Promise.resolve());
const download = vi.fn(() => Promise.resolve());
let current: { data?: ReportStatus; isLoading: boolean; isError: boolean };

vi.mock("@/hooks/reports/useReportExport", () => ({
  useReportStatus: () => current,
  usePrepareReport: () => ({ mutateAsync: prepare, isPending: false }),
  useDownloadReport: () => ({ mutateAsync: download, isPending: false }),
  isPreparing: (s?: ReportStatus) => !!s?.languages.some((l) => l.state === "preparing"),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "ss", resolvedLanguage: "ss" },
  }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const AT = "2026-10-02T10:00:00Z";
const withStates = (languages: Record<string, "preparing" | "ready" | "failed">) => {
  current = {
    isLoading: false,
    isError: false,
    data: {
      available_languages: ["en", "fr", "pt", "ss"],
      languages: Object.entries(languages).map(([lang, state]) => ({
        lang,
        state,
        updated_at: AT,
      })),
    },
  };
};

const renderReadiness = () =>
  render(
    <ReportReadiness
      reportRef={{ kind: "submission", submissionId: "sub-1" }}
      filename={(lang) => `report_${lang}.pdf`}
    />,
  );

describe("ReportReadiness", () => {
  beforeEach(() => {
    prepare.mockClear();
    download.mockClear();
  });

  it("explains that the report is being prepared and offers no download yet", () => {
    withStates({ en: "preparing" });

    renderReadiness();

    expect(screen.getByText("reportExport.status.preparingEnglish")).toBeInTheDocument();
    expect(screen.queryByText("reportExport.status.download")).not.toBeInTheDocument();
    expect(screen.getAllByText("reportExport.status.locked")).toHaveLength(3);
    expect(screen.getByText("reportExport.status.lockedHint")).toBeInTheDocument();
  });

  it("downloads a ready language under its file name", async () => {
    withStates({ en: "ready" });

    renderReadiness();
    await act(async () => {
      fireEvent.click(screen.getByText("reportExport.status.download"));
    });

    expect(download).toHaveBeenCalledWith({ lang: "en", filename: "report_en.pdf" });
  });

  it("prepares another language on request, listing the user's own first", async () => {
    withStates({ en: "ready" });

    renderReadiness();
    const prepareButtons = screen.getAllByText("reportExport.status.prepare");
    await act(async () => {
      fireEvent.click(prepareButtons[0]);
    });

    expect(screen.getByText("SiSwati")).toBeInTheDocument();
    expect(screen.getByText("reportExport.status.yourLanguage")).toBeInTheDocument();
    expect(prepare).toHaveBeenCalledWith({ lang: "ss", regenerate: false });
  });

  it("shows only a generic message when preparation failed, with a retry", async () => {
    withStates({ en: "ready", fr: "failed" });

    renderReadiness();
    await act(async () => {
      fireEvent.click(screen.getByText("reportExport.status.tryAgain"));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("reportExport.status.failed");
    expect(prepare).toHaveBeenCalledWith({ lang: "fr", regenerate: false });
  });

  it("rebuilds the English report on update", async () => {
    withStates({ en: "ready" });

    renderReadiness();
    await act(async () => {
      fireEvent.click(screen.getByText("reportExport.status.update"));
    });

    expect(prepare).toHaveBeenCalledWith({ lang: "en", regenerate: true });
  });
});
