import { expect, test } from "@playwright/test";

test("Continue with Google creates an account and returns to the page you wanted", async ({ page }) => {
  await page.goto("/practice/reading");
  await expect(page).toHaveURL(/\/login\?from=/);
  await page.getByRole("link", { name: "Continue with Google" }).click();
  await page.waitForURL("http://localhost:4601/auth**");
  await page.getByRole("link", { name: "Sign in as google.student@example.com" }).click();
  await page.waitForURL("**/practice/reading");
  await expect(page.getByRole("heading", { name: "Academic Reading" })).toBeVisible();
});

test("cancelling at Google shows a friendly message", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Continue with Google" }).click();
  await page.getByRole("link", { name: "Cancel" }).click();
  await page.waitForURL("**/login?error=google_cancelled");
  await expect(page.getByText("Google sign-in was cancelled.")).toBeVisible();
});

test("the register page offers Google sign-up", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("link", { name: "Sign up with Google" })).toBeVisible();
});
