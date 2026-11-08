import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run the real production build (`next start`) against a
 * real MongoDB. No AI key is configured, so AI routes exercise their
 * "unavailable" path; a separate test mocks the AI response in the browser to
 * check the results UI.
 *
 *   E2E_MONGODB_URI=mongodb://127.0.0.1:27017/ielts_e2e npm run build && npm run test:e2e
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;
export const E2E_MONGODB_URI = process.env.E2E_MONGODB_URI ?? "mongodb://127.0.0.1:27017/ielts_e2e";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
      },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    {
      command: "node tests/support/fake-sslcommerz.mjs",
      url: "http://localhost:4600/health",
      reuseExistingServer: !process.env.CI,
      env: { PORT: "4600" },
    },
    {
    command: `npx next start --port ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: "production",
      MONGODB_URI: E2E_MONGODB_URI,
      JWT_SECRET: "e2e-only-secret-that-is-long-enough-000000",
      APP_URL: BASE_URL,
      EMAIL_TRANSPORT: "console",
      GEMINI_API_KEY: "",
      SSLCOMMERZ_STORE_ID: "teststore",
      SSLCOMMERZ_STORE_PASSWORD: "teststore@ssl",
      SSLCOMMERZ_BASE_URL: "http://localhost:4600",
    },
    },
  ],
});
