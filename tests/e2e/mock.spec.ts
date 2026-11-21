import { expect, test } from "@playwright/test";
import { STORAGE_STATE } from "./constants";

test.use({ storageState: STORAGE_STATE });

async function submitEmpty(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
}

test("mock test: sections run in order with a server-kept clock", async ({ page }) => {
  await page.goto("/practice/mock");
  await page.getByRole("button", { name: "Start a new mock test" }).click();
  await expect(page).toHaveURL(/\/practice\/mock\/[a-f0-9]{24}$/);
  await expect(page.getByText("Section 1 of 4")).toBeVisible();

  await page.getByRole("button", { name: "Start Listening" }).click();
  await expect(page.getByRole("button", { name: "Start the recording" })).toBeVisible();
  // Reloading keeps the section running instead of restarting it.
  await page.reload();
  await expect(page.getByRole("button", { name: "Start the recording" })).toBeVisible();
  await submitEmpty(page);

  await expect(page.getByRole("button", { name: "Start Reading" })).toBeVisible();
  await page.getByRole("button", { name: "Start Reading" }).click();
  await expect(page.getByText(/\d+:\d\d left/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Passage 3" })).toBeVisible();
  await submitEmpty(page);

  await page.getByRole("button", { name: "Start Writing" }).click();
  await expect(page.getByLabel("Your answer to Task 1")).toBeVisible();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();

  await expect(page.getByRole("button", { name: "Start Speaking" })).toBeVisible();
  await page.goto("/practice/mock");
  await expect(page.getByText(/In progress · next: Speaking/).first()).toBeVisible();
});
