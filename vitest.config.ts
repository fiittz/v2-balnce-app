import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    environmentMatchGlobs: [
      ["src/**/*.dom.test.*", "jsdom"],
    ],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "supabase/functions/**/*.ts"],
      exclude: ["src/lib/mockData.ts", "src/lib/seedAccounts.ts", "src/lib/seedCategories.ts", "src/lib/utils.ts"],
      reporter: ["text", "text-summary", "html"],
    },
  },
});
