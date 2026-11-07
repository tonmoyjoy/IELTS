import path from "node:path";
import { expect, test } from "@playwright/test";
import { STORAGE_STATE } from "./constants";

test.use({ storageState: STORAGE_STATE });

const fixture = (name: string) => path.join(process.cwd(), "tests/fixtures/audio", name);

test("dashboard shows progress, usage and navigation", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Your IELTS progress" })).toBeVisible();
  await expect(page.getByText("AI evaluations today")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Reading" })).toBeVisible();
});

test("signed-in users are sent from /login to the dashboard and open redirects are ignored", async ({ page }) => {
  await page.goto("/login?from=//evil.example/steal");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("reading: answers are marked on the server with explanations and saved to history", async ({ page }) => {
  await page.goto("/practice/reading/urban-green-spaces");
  await expect(page.getByRole("heading", { name: "Green infrastructure in the modern city" })).toBeVisible();

  const q1 = page.getByRole("group", { name: /reduced spending on parks first/ });
  await q1.getByLabel("TRUE").check();
  await page.getByRole("textbox", { name: /cooler on summer/ }).fill("afternoons");
  await page.getByRole("textbox", { name: /rain/ }).fill("rain gardens"); // over the one-word limit

  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByText(/You have answered 3 of 12 questions/)).toBeVisible();
  await page.getByRole("button", { name: "Submit anyway" }).click();

  await expect(page.getByText("2 / 12")).toBeVisible();
  await expect(page.getByText("over the word limit").first()).toBeVisible();
  await expect(page.getByText(/Paragraph A: parks were/).first()).toBeVisible();

  await page.getByRole("link", { name: "Saved to history" }).click();
  await expect(page.getByRole("heading", { name: "Urban Green Spaces" })).toBeVisible();
  await expect(page.getByText("2/12 correct (estimated band)")).toBeVisible();
});

test("reading drafts survive a reload", async ({ page }) => {
  await page.goto("/practice/reading/food-waste");
  await page.getByRole("textbox", { name: /lack cool/ }).fill("storage");
  await page.reload();
  await expect(page.getByRole("textbox", { name: /lack cool/ })).toHaveValue("storage");
});

test("listening: the recording loads and plays once in exam mode", async ({ page }) => {
  const audio = page.waitForResponse((res) => res.url().endsWith("/listening/sports-centre.mp3"));
  await page.goto("/practice/listening/sports-centre");
  const response = await audio;
  expect(response.status()).toBeLessThan(400);
  expect(response.headers()["content-type"]).toContain("audio/mpeg");
  await expect(page.getByRole("button", { name: "Play recording" })).toBeEnabled();
  await expect(page.locator("audio")).toHaveJSProperty("controls", false);
  await page.getByLabel("Practice mode").check();
  await expect(page.locator("audio")).toHaveJSProperty("controls", true);
});

test("listening: transcript is revealed only after submitting", async ({ page }) => {
  await page.goto("/practice/listening/library-tour");
  await expect(page.getByText(/welcome to the Hartley Library tour/i)).toHaveCount(0);
  await page.getByRole("textbox", { name: /next to the/ }).fill("cafe");
  await page.getByRole("button", { name: "Submit answers" }).click();
  await page.getByRole("button", { name: "Submit anyway" }).click();
  await expect(page.getByRole("heading", { name: "Transcript" })).toBeVisible();
  await expect(page.getByText(/welcome to the Hartley Library tour/i)).toBeVisible();
});

test("writing: Task 1 shows its chart and the AI outage is handled gracefully", async ({ page }) => {
  await page.goto("/practice/writing/task1-home-heating");
  await expect(page.getByText("Households by main heating source (%)", { exact: true })).toBeVisible();
  await page.getByText("Show data as a table").click();
  await expect(page.getByRole("table")).toContainText("Solar");

  await page.getByLabel("Your answer").fill(Array.from({ length: 80 }, (_, i) => `word${i}`).join(" "));
  await expect(page.getByText(/needs at least 150 words/)).toBeVisible();
  await page.getByRole("button", { name: "Submit for scoring" }).click();
  await expect(page.getByText("AI scoring is temporarily unavailable")).toBeVisible();
});

test("writing: results render criteria and feedback", async ({ page }) => {
  await page.route("**/api/writing/evaluate", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        attempt: { id: "000000000000000000000000" },
        latencyMs: 10,
        evaluation: {
          bandScore: 6.5,
          criteria: { taskResponse: 6, coherenceCohesion: 7, lexicalResource: 6.5, grammaticalRange: 6.5 },
          summary: "A clear, relevant answer with a consistent position.",
          strengths: ["Clear position throughout"],
          improvements: ["Support each main idea with a specific example"],
          wordCount: 262,
          underLength: false,
        },
      }),
    })
  );
  await page.goto("/practice/writing/task2-community-service");
  await page.getByLabel("Your answer").fill(Array.from({ length: 262 }, (_, i) => `word${i}`).join(" "));
  await page.getByRole("button", { name: "Submit for scoring" }).click();
  await expect(page.getByText("Band 6.5")).toBeVisible();
  await expect(page.getByText("Task Response")).toBeVisible();
  await expect(page.getByText("Support each main idea with a specific example")).toBeVisible();
});

test("speaking: uploads are length-checked in the browser and on the server", async ({ page }) => {
  await page.goto("/practice/speaking?set=cities-and-transport");
  await expect(page.getByText("Describe a journey you made that took longer than expected.").first()).toBeVisible();

  await page.getByText("Microphone not working? Upload a recording instead").click();
  await page.getByLabel(/MP3, M4A, WAV, OGG or WebM/).setInputFiles(fixture("short-3s.mp3"));
  await expect(page.getByText(/Record at least 30 seconds/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit for scoring" })).toBeDisabled();

  // A long-enough WebM whose length the browser cannot read: the server measures it.
  await page.getByLabel(/MP3, M4A, WAV, OGG or WebM/).setInputFiles(fixture("streamed-35s.webm"));
  await page.getByRole("button", { name: "Submit for scoring" }).click();
  await expect(page.getByText("AI scoring is temporarily unavailable")).toBeVisible();
});

test("speaking: the browser can record from the microphone", async ({ browser }) => {
  const context = await browser.newContext({ storageState: STORAGE_STATE, permissions: ["microphone"] });
  const page = await context.newPage();
  await page.goto("/practice/speaking");
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByRole("button", { name: "Stop recording" })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Stop recording" }).click();
  await expect(page.getByLabel("Your recording")).toBeVisible();
  await expect(page.getByText(/Record at least 30 seconds/)).toBeVisible();
  await context.close();
});

test("history lists attempts and filters by module", async ({ page }) => {
  await page.goto("/history?module=reading");
  await expect(page.getByRole("heading", { name: "Your attempts" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Urban Green Spaces/ }).first()).toBeVisible();
  await page.getByRole("link", { name: "Speaking", exact: true }).last().click();
  await expect(page).toHaveURL(/module=speaking/);
});

test("sign out ends the session", async ({ browser }) => {
  const context = await browser.newContext({ storageState: STORAGE_STATE });
  const page = await context.newPage();
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await context.close();
});
