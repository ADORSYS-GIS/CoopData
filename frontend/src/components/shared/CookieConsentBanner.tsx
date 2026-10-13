import React, { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Cookie, X } from "lucide-react";

import {
  getCookieConsentChoice,
  OPEN_COOKIE_SETTINGS_EVENT,
  setCookieConsentChoice,
} from "@/lib/cookieConsent";

export const CookieConsentBanner: React.FC = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!getCookieConsentChoice()) {
      setVisible(true);
    }

    const onOpen = () => setVisible(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, onOpen);
  }, []);

  const handleAccept = () => {
    setCookieConsentChoice("accepted");
    setVisible(false);
  };

  const handleReject = () => {
    setCookieConsentChoice("rejected");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] p-3 sm:p-4">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-surface shadow-[var(--shadow-elev-3)]">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="flex items-start gap-3 sm:items-center">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
              <Cookie className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-sm font-semibold text-foreground">
                {t("cookie.title", "We value your privacy")}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {t(
                  "cookie.body",
                  "CoopData only uses essential cookies and browser storage to keep you signed in, secure and able to work offline. We do not use analytics or advertising cookies. You can choose now whether to allow optional technologies, should any be added later.",
                )}{" "}
                <Link
                  to="/legal"
                  search={{ doc: "cookies" }}
                  className="font-medium text-accent hover:underline"
                >
                  {t("cookie.readPolicy", "Read our Cookie Policy")}
                </Link>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:flex-col lg:flex-row">
            <button
              onClick={handleReject}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
            >
              {t("cookie.reject", "Essential only")}
            </button>
            <button
              onClick={handleAccept}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t("cookie.accept", "Accept all")}
            </button>
            <button
              onClick={() => setVisible(false)}
              aria-label={t("cookie.close", "Close")}
              className="ml-auto grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:ml-0"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
