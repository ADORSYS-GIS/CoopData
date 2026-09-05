import { WifiOff, Wifi } from "lucide-react";
import { useNetworkStatus } from "@/hooks/shared/useNetworkStatus";
import { useTranslation } from "react-i18next";

/**
 * Small, unobtrusive network-status indicator shown in the bottom-right corner.
 * Displays a compact pill with a status dot — online or offline — plus a
 * pending-sync badge when there are queued offline changes.
 */
export function OfflineStatusBanner() {
  const { isOnline, wasOffline, pendingSyncCount } = useNetworkStatus();
  const { t } = useTranslation();

  // Always show a subtle indicator so the user knows their connectivity state.
  return (
    <div
      id="offline-status-banner"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-md select-none transition-all duration-300"
      style={{
        backgroundColor: isOnline ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.14)",
        borderColor: isOnline ? "rgba(16,185,129,0.35)" : "rgba(245,158,11,0.4)",
        color: isOnline ? "#059669" : "#b45309",
      }}
    >
      <span className="relative flex size-2" aria-hidden="true">
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
            isOnline ? "animate-ping bg-success/100" : "bg-warning"
          }`}
        />
        <span
          className={`relative inline-flex size-2 rounded-full ${
            isOnline ? "bg-success/100" : "bg-warning"
          }`}
        />
      </span>

      {isOnline ? (
        <Wifi className="size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />
      )}

      <span className="hidden sm:inline">
        {isOnline
          ? wasOffline
            ? t("offline.backOnline")
            : t("offline.online")
          : t("offline.banner")}
      </span>

      {pendingSyncCount > 0 && (
        <span
          className="ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
          style={{
            backgroundColor: isOnline ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)",
          }}
        >
          {pendingSyncCount}
        </span>
      )}
    </div>
  );
}
