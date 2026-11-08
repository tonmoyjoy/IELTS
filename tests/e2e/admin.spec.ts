import { expect, test } from "@playwright/test";
import mongoose from "mongoose";
import { STORAGE_STATE } from "./constants";

const uri = process.env.E2E_MONGODB_URI ?? "mongodb://127.0.0.1:27017/ielts_e2e";
const CUSTOMER = "review.customer@example.com";
const TRAN = "IPSE2EREVIEW1";

test.beforeAll(async () => {
  await mongoose.connect(uri);
  const db = mongoose.connection.db!;
  await db.collection("payments").deleteMany({ tranId: TRAN });
  await db.collection("users").deleteMany({ email: CUSTOMER });
  const { insertedId } = await db.collection("users").insertOne({
    email: CUSTOMER, password: "x", emailVerified: true, tokenVersion: 0, plan: "free", targetBand: 7, createdAt: new Date(), updatedAt: new Date(),
  });
  await db.collection("payments").insertOne({
    user: insertedId, tranId: TRAN, optionId: "pro-3m", days: 90, amount: 600, currency: "BDT", status: "review",
    riskLevel: "1", cardType: "VISA-Dutch Bangla", createdAt: new Date(), updatedAt: new Date(),
  });
  await mongoose.disconnect();
});

test.describe("as an admin", () => {
  test.use({ storageState: STORAGE_STATE });

  test("approves a held payment and the customer becomes Pro", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Admin", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByText("Revenue today")).toBeVisible();

    const row = page.locator("div").filter({ hasText: TRAN }).filter({ has: page.getByRole("button", { name: "Approve" }) }).last();
    await row.getByRole("button", { name: "Approve" }).click();
    await page.getByPlaceholder("Note (optional)").fill("Confirmed in SSLCommerz panel");
    await page.getByRole("button", { name: "Confirm approve" }).click();
    await expect(page.getByText("Nothing to review")).toBeVisible();
    await expect(page.getByRole("cell", { name: "payment.approve" })).toBeVisible();

    await page.getByRole("link", { name: "Users" }).click();
    await page.getByLabel("Email starts with").fill("review.customer");
    await page.getByRole("button", { name: "Search" }).click();
    const userRow = page.getByRole("row").filter({ hasText: CUSTOMER });
    await expect(userRow.getByText("Pro", { exact: true })).toBeVisible();
  });

  test("gives and removes Pro manually", async ({ page }) => {
    await page.goto("/admin/users?q=review.customer");
    const row = page.getByRole("row").filter({ hasText: CUSTOMER });
    await row.getByRole("button", { name: "Remove Pro" }).click();
    await row.getByRole("button", { name: "Confirm remove" }).click();
    await expect(row.getByText("Free", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "Give Pro" }).click();
    await row.getByRole("combobox").selectOption("7");
    await row.getByRole("button", { name: "Give 7 days" }).click();
    await expect(row.getByText("Pro", { exact: true })).toBeVisible();
  });

  test("filters payments by status and searches by reference", async ({ page }) => {
    await page.goto("/admin/payments");
    await page.getByLabel("Search").fill(TRAN);
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("cell", { name: TRAN })).toBeVisible();
    await page.getByRole("link", { name: "Paid" }).click();
    await expect(page).toHaveURL(/status=paid/);
  });
});

test("non-admins get a 404 for the admin area", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Continue with Google" }).click();
  await page.getByRole("link", { name: "Sign in as google.student@example.com" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("link", { name: "Admin", exact: true })).toHaveCount(0);
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Page not found")).toBeVisible();
});
