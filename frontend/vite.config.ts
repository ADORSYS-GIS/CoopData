import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
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
    plugins: [
      TanStackRouterVite({ autoCodeSplitting: true }),
      react(),
      tailwindcss(),
      tsConfigPaths(),
      e2eMockAuth(),
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
