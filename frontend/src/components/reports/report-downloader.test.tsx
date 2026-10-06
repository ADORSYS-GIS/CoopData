import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { ReportDownloader } from "./report-downloader";
import type { ReportStatus } from "@/hooks/reports/useReportExport";

const prepare = vi.fn();
const download = vi.fn();
const finishInBackground = vi.fn();
let current: { data?: ReportStatus; isLoading: boolean; isError: boolean };

vi.mock("@/hooks/reports/useReportExport", () => ({
  useReportStatus: () => current,
  usePrepareReport: () => ({ mutate: prepare, isPending: false }),
  useDownloadReport: () => ({ mutate: download, isPending: false }),
  isPreparing: (s?: ReportStatus) => !!s?.languages.some((l) => l.state === "preparing"),
}));

vi.mock("@/services/reports/reportWatcher", () => ({
  finishInBackground: (...args: unknown[]) => finishInBackground(...args),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "ss", resolvedLanguage: "ss" },
  }),
}));

const withStates = (languages: Record<string, "preparing" | "ready" | "failed">) => {
  current = {
    isLoading: false,
    isError: false,
    data: {
      available_languages: ["en", "fr", "pt", "ss"],
      languages: Object.entries(languages).map(([lang, state]) => ({
        lang,
        state,
        updated_at: "2026-10-02T10:00:00Z",
      })),
    },
  };
};

const ui = () => (
  <ReportDownloader
    reportRef={{ kind: "submission", submissionId: "sub-1" }}
    filename={(lang) => `report_${lang}.pdf`}
  />
);

const clickDownload = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /reportExport.status.download/ }));
  });
};

describe("ReportDownloader", () => {
  beforeEach(() => {
    prepare.mockClear();
    download.mockClear();
    finishInBackground.mockClear();
  });

  it("downloads a ready report in the user's language straight away", async () => {
    withStates({ en: "ready", ss: "ready" });
    render(ui());

    await clickDownload();

    expect(download).toHaveBeenCalledWith(
      { lang: "ss", filename: "report_ss.pdf" },
      expect.anything(),
    );
    expect(prepare).not.toHaveBeenCalled();
  });

  it("prepares a missing language behind the button, then downloads it by itself", async () => {
    withStates({ en: "ready" });
    const { rerender } = render(ui());

    await clickDownload();

    expect(prepare).toHaveBeenCalledWith({ lang: "ss" }, expect.anything());
    expect(screen.getByText("reportExport.status.preparing")).toBeInTheDocument();
    expect(download).not.toHaveBeenCalled();

    withStates({ en: "ready", ss: "ready" });
    await act(async () => rerender(ui()));

    expect(download).toHaveBeenCalledWith(
      { lang: "ss", filename: "report_ss.pdf" },
      expect.anything(),
    );
    expect(screen.getByText("reportExport.status.download")).toBeInTheDocument();
  });

  it("shows only a generic message when preparation fails", async () => {
    withStates({ en: "ready" });
    const { rerender } = render(ui());
    await clickDownload();

    withStates({ en: "ready", ss: "failed" });
    await act(async () => rerender(ui()));

    expect(screen.getByRole("alert")).toHaveTextContent("reportExport.status.failed");
    expect(download).not.toHaveBeenCalled();
  });

  it("keeps preparing in the background when closed while waiting", async () => {
    withStates({ en: "preparing" });
    const { unmount } = render(ui());
    await clickDownload();

    unmount();

    expect(finishInBackground).toHaveBeenCalledWith(
      { kind: "submission", submissionId: "sub-1" },
      "ss",
      "report_ss.pdf",
      expect.objectContaining({ download: "reportExport.status.download" }),
    );
  });
});
