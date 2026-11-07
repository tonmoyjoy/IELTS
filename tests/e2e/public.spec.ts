import { expect, test } from "@playwright/test";

test.describe("signed out", () => {
  test("landing page renders with security headers", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Know your band before test day." })).toBeVisible();

    const headers = response!.headers();
    expect(headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("the page works under its CSP (no blocked scripts)", async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/Content Security Policy|Refused to/i.test(message.text())) violations.push(message.text());
    });
    await page.goto("/login");
    await page.getByLabel("Email").fill("someone@example.com");
    await expect(page.getByLabel("Email")).toHaveValue("someone@example.com");
    expect(violations).toEqual([]);
  });

  test("protected pages redirect to sign in and remember where to return", async ({ page }) => {
    await page.goto("/practice/reading/food-waste");
    await expect(page).toHaveURL(/\/login\?from=%2Fpractice%2Freading%2Ffood-waste/);
  });

  test("APIs reject anonymous access", async ({ request }) => {
    expect((await request.get("/api/practice/attempts")).status()).toBe(401);
    expect((await request.get("/api/auth/me")).status()).toBe(401);
  });

  test("health check reports the database", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", checks: { database: "up" } });
  });

  test("registration never shows a verification link in the page", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Email").fill(`new.${Date.now()}@example.com`);
    await page.getByLabel("Password").fill("a decent password");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Check your inbox")).toBeVisible();
    await expect(page.locator("a[href*='verify-email']")).toHaveCount(0);
  });

  test("an unverified account is told to verify and can resend", async ({ page }) => {
    const email = `unverified.${Date.now()}@example.com`;
    await page.goto("/register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("a decent password");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Check your inbox")).toBeVisible();

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("a decent password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Please verify your email address first")).toBeVisible();
    await page.getByRole("button", { name: "Resend verification email" }).click();
    await expect(page.getByText("we sent a new link")).toBeVisible();
  });

  test("cross-origin login attempts are blocked", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { email: "x@example.com", password: "whatever" },
      headers: { origin: "https://evil.example" },
    });
    expect(res.status()).toBe(403);
  });
});
