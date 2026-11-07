import path from "node:path";
import { defineConfig } from "vitest/config";

const root = path.dirname(new URL(import.meta.url).pathname);

export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(root, "src"),
      // `server-only` throws outside the React Server Components bundler; tests run in plain Node.
      "server-only": path.join(root, "tests/support/empty-module.ts"),
    },
  },
  test: {
    environment: "node",
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/server/**", "src/lib/**", "src/content/**"],
      reporter: ["text-summary", "html"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          // One database for the whole run; files run one after another.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
