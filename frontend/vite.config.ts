import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { VitePWA } from "vite-plugin-pwa";
import { e2eMockAuth } from "./e2e-mock-auth";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isProd = mode === "production";

  const apiBaseUrl =
    isProd && (!env.VITE_API_BASE_URL || env.VITE_API_BASE_URL.includes("localhost"))
      ? ""
      : env.VITE_API_BASE_URL || "";

  const keycloakUrl =
    isProd && (!env.VITE_KEYCLOAK_URL || env.VITE_KEYCLOAK_URL.includes("localhost"))
      ? ""
      : env.VITE_KEYCLOAK_URL || "";

  return {
    define: {
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify(apiBaseUrl),
      "import.meta.env.VITE_KEYCLOAK_URL": JSON.stringify(keycloakUrl),
    },
    build: {
      outDir: "dist-pwa",
    },
    plugins: [
      TanStackRouterVite({ autoCodeSplitting: true }),
      react(),
      tailwindcss(),
      tsConfigPaths(),
      e2eMockAuth(),
      VitePWA({
        outDir: "dist-pwa",
        registerType: "autoUpdate",
        injectRegister: "auto",
        // Use generateSW strategy: Workbox creates the SW from the manifest
        strategies: "generateSW",
        workbox: {
          // Pre-cache all JS, CSS, HTML, fonts, and icons
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2,webp}"],
          // CRITICAL: silent-check-sso.html MUST be cached so the Keycloak
          // iframe check doesn't fail when offline (which would trigger a logout)
          additionalManifestEntries: [{ url: "/silent-check-sso.html", revision: null }],
          // SPA fallback: all navigation requests return index.html
          // This ensures the app loads from cache on any route when offline
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [
            // Don't intercept API or Keycloak auth requests
            /^\/api\//,
            /^\/auth\//,
          ],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts",
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
          // Skip waiting and claim clients immediately
          skipWaiting: true,
          clientsClaim: true,
        },
        manifest: {
          name: "CoopData",
          short_name: "CoopData",
          description: "Cooperative Financial Data Management Platform",
          start_url: "/app/dashboard",
          display: "standalone",
          background_color: "#0f172a",
          theme_color: "#0f172a",
          icons: [
            {
              src: "/coopdatalogo.png",
              sizes: "any",
              type: "image/png",
              purpose: "maskable any",
            },
          ],
        },
        devOptions: {
          // Enable SW in dev so we can test offline behaviour locally
          enabled: true,
          type: "module",
        },
      }),
    ],
    resolve: {
      dedupe: [
        "react",
        "react-dom",
        "react-i18next",
        "i18next",
        "@radix-ui/react-dismissable-layer",
        "@radix-ui/react-focus-scope",
        "@radix-ui/react-portal",
        "@radix-ui/react-use-controllable-state",
        "@radix-ui/react-primitive",
      ],
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: true,
      watch: {
        usePolling: true,
        interval: 1000,
      },
      proxy: {
        "/api": {
          target: process.env.VITE_PROXY_TARGET || "http://localhost:3000",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
