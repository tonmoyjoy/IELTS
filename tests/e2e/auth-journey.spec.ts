import { expect, test } from "@playwright/test";
import { createTestAuthToken } from "./helpers/auth-token";

test("protected page redirects to login and logout revokes dashboard access", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForURL("**/login?from=%2Fdashboard");

  const email = `journey_${Date.now()}@example.com`;
  const password = "password12345";
  const token = await createTestAuthToken(email);

  await page.route("**/api/exam/results", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ tests: [] }),
    });
  });

  await page.route("**/api/practice/attempts", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        attempts: [],
        analytics: {
          moduleAverages: [],
          totalAttempts: 0,
          latestScore: null,
        },
      }),
    });
  });

  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "set-cookie": `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax`,
      },
      body: JSON.stringify({
        ok: true,
        user: { id: "mock-user-id", email, emailVerified: true },
      }),
    });
  });

  await page.route("**/api/auth/logout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "set-cookie": "auth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
      },
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto("/login?from=%2Fdashboard");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: "Exam preparation dashboard" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");

  await page.goto("/dashboard");
  await page.waitForURL("**/login?from=%2Fdashboard");
});
