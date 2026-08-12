import { WifiOff, Wifi } from "lucide-react";
import { useNetworkStatus } from "@/hooks/shared/useNetworkStatus";
import { useTranslation } from "react-i18next";

/**
 * A non-intrusive top-of-screen banner that reflects the current network state:
 *
 *  - Amber:   browser is offline — showing cached data
 *  - Green:   just came back online — syncing
 *  - Hidden:  online and nothing pending
 *
 * Mounted once in __root.tsx so it appears on every route.
 */
export function OfflineStatusBanner() {
  const { isOnline, wasOffline } = useNetworkStatus();
  const { t } = useTranslation();

  // Fully hidden when online and no recent transition
  if (isOnline && !wasOffline) return null;

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
        </>
      ) : (
        <>
          <Wifi className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{t("offline.backOnline")}</span>
        </>
      )}
    </div>
  );
}
