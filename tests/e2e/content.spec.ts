import { expect, test } from "@playwright/test";
import { STORAGE_STATE } from "./constants";

test.use({ storageState: STORAGE_STATE });

test("admin copies a built-in task, edits it, publishes it, and students can open it", async ({ page }) => {
  await page.goto("/admin/content");
  await expect(page.getByRole("heading", { name: "Practice content" })).toBeVisible();
  await page.getByLabel("Built-in set").selectOption({ label: "Task 2: Compulsory community service" });
  await page.getByRole("button", { name: "Copy as draft" }).click();
  await expect(page).toHaveURL(/\/admin\/content\/[a-f0-9]{24}$/);
  await expect(page.getByText("draft", { exact: true })).toBeVisible();

  // Rename it in the JSON editor; the preview follows.
  const editor = page.getByLabel("Content JSON");
  const json = JSON.parse(await editor.inputValue());
  json.payload.title = "Volunteering at school (E2E)";
  json.payload.question = "To what extent do you agree or disagree?";
  await editor.fill(JSON.stringify(json, null, 2));
  await expect(page.getByText("You have unsaved changes")).toBeVisible();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // Broken JSON is caught before it reaches the server.
  await editor.fill("{ not json");
  await expect(page.getByRole("button", { name: "Save draft" })).toBeDisabled();
  await page.reload();

  await page.getByRole("button", { name: "Publish" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published. Students can see it now.")).toBeVisible();

  await page.goto("/practice/writing");
  await page.getByRole("link", { name: /Volunteering at school \(E2E\)/ }).click();
  await page.getByRole("button", { name: /Practice mode/ }).click();
  await expect(page.getByText("To what extent do you agree or disagree?")).toBeVisible();
});
