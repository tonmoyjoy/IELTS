import { expect, test } from "@playwright/test";
import { STORAGE_STATE } from "./constants";

test.use({ storageState: STORAGE_STATE });

test("cancelling at the gateway leaves the account on Free", async ({ page }) => {
  await page.goto("/billing");
  await expect(page.getByRole("heading", { name: "Upgrade to Pro" })).toBeVisible();
  await page.getByLabel("Full name").fill("Rahim Uddin");
  await page.getByLabel("Mobile number").fill("01712345678");
  await page.getByRole("button", { name: /Pay ৳600/ }).click();

  await page.waitForURL("http://localhost:4600/pay/**");
  await page.getByRole("button", { name: "Cancel payment" }).click();
  await page.waitForURL("**/billing?payment=cancelled");
  await expect(page.getByText("Payment cancelled. You weren't charged.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Upgrade" })).toBeVisible();
});

test("phone numbers are validated before contacting the gateway", async ({ page }) => {
  await page.goto("/billing?plan=pro-1m");
  await page.getByLabel("Full name").fill("Rahim Uddin");
  await page.getByLabel("Mobile number").fill("12345");
  await page.getByRole("button", { name: /Pay ৳300/ }).click();
  await expect(page.getByText(/valid Bangladeshi mobile number/)).toBeVisible();
  await expect(page).toHaveURL(/\/billing/);
});

test("paying with bKash activates Pro after server-side validation", async ({ page }) => {
  await page.goto("/billing?plan=pro-1m");
  await page.getByLabel("Full name").fill("Rahim Uddin");
  await page.getByLabel("Mobile number").fill("+880 1712-345678");
  await page.getByRole("button", { name: /Pay ৳300/ }).click();

  await page.waitForURL("http://localhost:4600/pay/**");
  await expect(page.getByText("Amount: 300.00 BDT")).toBeVisible();
  await page.getByRole("button", { name: "Pay with bKash" }).click();

  await page.waitForURL("**/billing?payment=success");
  await expect(page.getByText("Payment received — Pro is now active.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "You're on Pro" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Pro · until/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: "BKash", exact: true })).toBeVisible();
  await expect(page.getByText("0 / 30 used").first()).toBeVisible(); // Pro limits now apply
});

test("comfort settings switch to dark mode and remember it", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Display and comfort settings" }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Display and comfort settings" }).click();
  await page.getByRole("button", { name: "Large text", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-text", "lg");
  await page.getByRole("button", { name: "Auto", exact: true }).click();
  await page.getByRole("button", { name: "Normal text", exact: true }).click();
});
