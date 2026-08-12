import { WifiOff, Wifi } from "lucide-react";
import { useNetworkStatus } from "@/hooks/shared/useNetworkStatus";
import { useTranslation } from "react-i18next";

/**
 * Top-of-screen banner reflecting the current network and sync state.
 */
export function OfflineStatusBanner() {
  const { isOnline, wasOffline, pendingSyncCount } = useNetworkStatus();
  const { t } = useTranslation();

  if (isOnline && !wasOffline && pendingSyncCount === 0) return null;

  return (
    <div
      id="offline-status-banner"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={[
        "fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 py-1.5 text-xs font-semibold",
        "transition-all duration-300 backdrop-blur-sm select-none",
        !isOnline ? "bg-amber-500/90 text-amber-950" : "bg-emerald-500/90 text-emerald-950",
      ].join(" ")}
    >
      {!isOnline ? (
        <>
          <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{t("offline.banner")}</span>
          {pendingSyncCount > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-950/20 px-2 py-0.5 text-[10px] font-bold">
              {pendingSyncCount} pending
            </span>
          )}
        </>
      ) : (
        <>
          <Wifi className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{t("offline.backOnline")}</span>
          {pendingSyncCount > 0 && (
            <span className="ml-1.5 rounded-full bg-emerald-950/20 px-2 py-0.5 text-[10px] font-bold">
              {pendingSyncCount} syncing
            </span>
          )}
        </>
      )}
    </div>
  );
}
