import { expect, test as setup } from "@playwright/test";
import { E2E_USER, STORAGE_STATE } from "./constants";

setup("sign in once and save the session", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_USER.email);
  await page.getByLabel("Password").fill(E2E_USER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: "Your IELTS progress" })).toBeVisible();
  await page.context().storageState({ path: STORAGE_STATE });
});
