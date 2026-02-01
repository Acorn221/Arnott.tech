import { defineConfig } from "vitest/config";
import * as path from "path";

export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", "dist"],
    coverage: {
      reporter: ["text", "html"],
      exclude: ["node_modules/", "src/**/*.test.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
