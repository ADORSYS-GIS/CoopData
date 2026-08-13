import { get, set, del } from "idb-keyval";
import { Outlet, Link, createRootRouteWithContext, useRouter } from "@tanstack/react-router";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import type { QueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { KeycloakAuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../lib/theme";
import { useTranslation } from "react-i18next";
import { OfflineStatusBanner } from "@/components/shared/OfflineStatusBanner";
import { getUserProfile } from "@/services/shared/authService";

import { flushSyncQueue } from "@/services/shared/syncQueueService";

const IDB_QUERY_CACHE_KEY = "coopdata_query_cache";
const SEVEN_DAYS_MS = 1000 * 60 * 60 * 24 * 7;

/** Persists the entire TanStack Query cache to IndexedDB via idb-keyval. */
function createIDBPersister(idbKey: string = IDB_QUERY_CACHE_KEY): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      await set(idbKey, client);
    },
    restoreClient: async (): Promise<PersistedClient | undefined> => {
      return await get<PersistedClient>(idbKey);
    },
    removeClient: async () => {
      await del(idbKey);
    },
  };
}

const persister = createIDBPersister();

function NotFoundComponent() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">CoopData</p>
        <h1 className="mt-3 text-7xl font-heading font-bold tracking-tight text-foreground">404</h1>
        <h2 className="mt-3 text-xl font-heading font-semibold text-foreground">
          {t("root.notFound.title")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {t("root.notFound.desc")}
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("root.notFound.returnHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useTranslation();
  console.error("[root] Uncaught error:", error);
  const router = useRouter();

  // Check if we are on an authenticated app route — if so, "go home" should stay within the app
  const isAppRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/app");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-heading font-semibold tracking-tight text-foreground">
          {t("root.error.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t("root.error.desc")}</p>
        {import.meta.env.DEV && (
          <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-muted px-3 py-2 text-left text-[11px] text-destructive">
            {error?.message ?? String(error)}
          </pre>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("root.error.tryAgain")}
          </button>
          <a
            href={isAppRoute ? "/app/dashboard" : "/"}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {t("root.error.goHome")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <ThemeProvider>
      <KeycloakAuthProvider>
        {/*
          PersistQueryClientProvider replaces QueryClientProvider.
          It automatically saves the entire query cache to IndexedDB on every
          mutation, and restores it on app startup. This gives every existing
          hook offline read access for free — no per-hook changes needed.

          onSuccess fires after the cache is restored from IDB.
          resumePausedMutations() re-runs any writes that were paused while offline.
        */}
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            maxAge: SEVEN_DAYS_MS,
            // Bust the cache when app version OR logged-in user changes.
            // This prevents a ministry user from loading federation-role queries
            // from a previous session, which would cause 403 errors on re-fetch.
            buster: `${import.meta.env.VITE_APP_VERSION ?? "v1"}_${getUserProfile()?.id ?? "anon"}_${getUserProfile()?.role ?? "none"}`,
            // Never persist queries that errored (avoids persisting 403 forbidden results)
            dehydrateOptions: {
              shouldDehydrateQuery: (query) => query.state.status !== "error",
            },
          }}
          onSuccess={() => {
            void queryClient.resumePausedMutations();
            void flushSyncQueue();
          }}
        >
          <OfflineStatusBanner />
          <Outlet />
          <Toaster position="top-right" richColors closeButton duration={4000} />
        </PersistQueryClientProvider>
      </KeycloakAuthProvider>
    </ThemeProvider>
  );
}
