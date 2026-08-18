import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

const SEVEN_DAYS_MS = 1000 * 60 * 60 * 24 * 7;
const FIVE_MINUTES_MS = 1000 * 60 * 5;

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Serve from cache immediately, even when offline.
        // TanStack Query will also pause retries when the network is gone.
        networkMode: "offlineFirst",
        // Keep cache alive for 7 days — matches the persister maxAge.
        // Without this, TanStack GC removes data before the persister can save it.
        gcTime: SEVEN_DAYS_MS,
        // Data is considered fresh for 5 minutes, then refetched in the background.
        staleTime: FIVE_MINUTES_MS,
      },
      mutations: {
        // Pause mutations when offline; resume automatically on reconnect.
        networkMode: "offlineFirst",
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
