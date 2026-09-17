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
      // Global coverage thresholds set to realistic levels based on current coverage
      // perFile: false ensures thresholds apply to the global aggregate only,
      // so untested files don't block the build.
      thresholds: {
        lines: 14,
        functions: 55,
        branches: 65,
        statements: 14,
        perFile: false,
      },
    },
  },
});
