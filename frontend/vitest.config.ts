import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    testTimeout: 15000,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: [
        "node_modules/",
        "dist/",
        "dev-dist/",
        "e2e/",
        "e2e-mock-auth.ts",
        "scripts/",
        "coverage/",
        "src/test/",
        "src/openapi-client/",
        // Pages and routes are covered by the Playwright e2e suite (frontend/e2e/),
        // not by unit tests, so they are excluded from unit coverage.
        "src/pages/**",
        "src/routes/**",
        "**/*.d.ts",
        "**/*.config.*",
        "src/routeTree.gen.ts",
      ],
    },
  },
});
