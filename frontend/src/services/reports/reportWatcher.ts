import { toast } from "sonner";

import { nextDownloadStep } from "@/lib/reportDownloadPlan";
import {
  downloadReport,
  fetchReportStatus,
  prepareReport,
  type ReportRef,
} from "@/services/reports/reportExportApi";

export interface WatchMessages {
  ready: string;
  failed: string;
  download: string;
}

const POLL_MS = 4000;
/** Longer than the backend's own job timeout, after which a lost job reports failure. */
const GIVE_UP_MS = 15 * 60 * 1000;

const watching = new Set<string>();

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * Keeps a requested report going after its window was closed: prepares what is
 * still missing and, once the PDF is ready, offers it in a notification. Browsers
 * may block a download that starts without a click, so the notification carries
 * the Download button.
 */
export function finishInBackground(
  ref: ReportRef,
  lang: string,
  filename: string,
  messages: WatchMessages,
): void {
  const key = JSON.stringify([ref, lang]);
  if (watching.has(key)) return;
  watching.add(key);

  void (async () => {
    const started = Date.now();
    const requested = new Set<string>();
    try {
      while (Date.now() - started < GIVE_UP_MS) {
        try {
          const step = nextDownloadStep(await fetchReportStatus(ref), lang, false);
          if (step.kind === "download") {
            toast.success(messages.ready, {
              duration: Infinity,
              action: {
                label: messages.download,
                onClick: () => {
                  downloadReport(ref, lang, filename).catch(() => toast.error(messages.failed));
                },
              },
            });
            return;
          }
          if (step.kind === "failed") {
            toast.error(messages.failed);
            return;
          }
          if (step.kind === "prepare" && !requested.has(step.lang)) {
            requested.add(step.lang);
            await prepareReport(ref, step.lang);
          }
        } catch {
          // A transient network error: keep waiting until the give-up time.
        }
        await sleep(POLL_MS);
      }
      toast.error(messages.failed);
    } finally {
      watching.delete(key);
    }
  })();
}
