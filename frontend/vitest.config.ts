import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**"],
      exclude: [
        "node_modules/",
        "src/test/",
        "src/routeTree.gen.ts",
        "src/main.tsx",
        "src/router.tsx",
        "**/*.d.ts",
        "**/*.config.*",
        "src/components/ui/**",
        "src/i18n/**",
        "src/openapi-client/**",
      ],
      // Thresholds set just below the measured baseline (lines: 11.15%, functions: 69.55%,
      // branches: 47.78%). Raise these incrementally as coverage grows toward 80%.
      // perFile: false ensures thresholds apply to the global aggregate only,
      // so untested files don't block the build.
      thresholds: {
        lines: 10,
        functions: 40,
        branches: 45,
        statements: 10,
        perFile: false,
      },
    },
  },
});
