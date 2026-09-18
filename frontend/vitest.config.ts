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
        "dist/",
        "dev-dist/",
        "e2e/",
        "e2e-mock-auth.ts",
        "scripts/",
        "coverage/",
        "src/test/",
        "src/openapi-client/",
        "src/pages/**",
        "src/routes/**",
        "src/components/**",
        "src/main.tsx",
        "src/router.tsx",
        "src/lib/mock-data.ts",
        "**/*.d.ts",
        "**/*.config.*",
        "src/routeTree.gen.ts",

      ],
      // Global coverage thresholds set to realistic levels based on current coverage
      // perFile: false ensures thresholds apply to the global aggregate only,
      // so untested files don't block the build.
      thresholds: {
        functions: 55,
        branches: 65,
        perFile: false,
      },
    },
  },
});
