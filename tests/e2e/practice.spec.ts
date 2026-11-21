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

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

test("reading: computer-test screen marks answers on the server and saves to history", async ({ page }) => {
  await page.goto("/practice/reading/urban-green-spaces");
  await expect(page.getByText("Instructions to candidates")).toBeVisible();
  await page.getByRole("button", { name: /Practice mode/ }).click();
  await expect(page.getByRole("heading", { name: "Green infrastructure in the modern city" })).toBeVisible();

  const q1 = page.getByRole("group", { name: /reduced spending on parks first/ });
  await q1.getByLabel("TRUE").check();
  await page.getByRole("textbox", { name: /cooler on summer/ }).fill("afternoons");
  await page.getByRole("textbox", { name: /rain/ }).fill("rain gardens"); // over the one-word limit
  await expect(page.getByRole("button", { name: "Question 1, answered" })).toBeVisible();

  await page.getByRole("button", { name: "Submit", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Submit your answers?" });
  await expect(dialog).toContainText("You have answered 3 of 12 questions");
  await dialog.getByRole("button", { name: "Submit" }).click();

  await expect(page.getByText("2 / 12")).toBeVisible();
  await expect(page.getByText("over the word limit").first()).toBeVisible();
  await expect(page.getByText(/Paragraph A: parks were/).first()).toBeVisible();

  await page.getByRole("link", { name: "Saved to history" }).click();
  await expect(page.getByRole("heading", { name: "Urban Green Spaces" })).toBeVisible();
  await expect(page.getByText("2/12 correct (estimated band)")).toBeVisible();
});

test("reading: exam mode has a countdown, highlighting and flags, and survives a reload", async ({ page }) => {
  await page.goto("/practice/reading/food-waste");
  await page.getByRole("button", { name: /Exam mode/ }).click();
  await expect(page.getByText(/\d+:\d\d left/)).toBeVisible();

  // Highlight the first words of paragraph A.
  const paragraph = page.locator("[data-hl$=':0']").first();
  await paragraph.evaluate((el) => {
    const range = document.createRange();
    const text = el.querySelector("span")!.firstChild!;
    range.setStart(text, 0);
    range.setEnd(text, 12);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Highlight" }).click();
  await expect(paragraph.locator("mark")).toHaveCount(1);

  await page.getByRole("button", { name: "Flag question 1 for review" }).click();
  await expect(page.getByRole("button", { name: /Question 1, flagged/ })).toBeVisible();
  await page.getByRole("textbox", { name: /lack cool/ }).fill("storage");

  await page.reload();
  await expect(page.getByRole("textbox", { name: /lack cool/ })).toHaveValue("storage");
  await expect(paragraph.locator("mark")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /Question 1, flagged/ })).toBeVisible();
});

test("reading: the full test numbers questions across all passages", async ({ page }) => {
  await page.goto("/practice/reading/full");
  await page.getByRole("button", { name: /Practice mode/ }).click();
  await page.getByRole("button", { name: "Passage 3" }).click();
  await expect(page.getByRole("button", { name: "Question 36", exact: true })).toBeVisible();
  await expect(page.getByText(/Questions 2[5-9]/).first()).toBeVisible();
});

test("listening: exam mode plays once with no controls; practice mode has controls", async ({ page }) => {
  await page.goto("/practice/listening/sports-centre");
  const audio = page.waitForResponse((res) => res.url().endsWith("/listening/sports-centre.mp3"));
  await page.getByRole("button", { name: /Exam mode/ }).click();
  const response = await audio;
  expect(response.status()).toBeLessThan(400);
  expect(response.headers()["content-type"]).toContain("audio/mpeg");
  await expect(page.getByRole("button", { name: "Start the recording" })).toBeEnabled();
  await expect(page.locator("audio")).toHaveJSProperty("controls", false);

  await page.evaluate(() => window.localStorage.clear());
  await page.goto("/practice/listening/sports-centre");
  await page.getByRole("button", { name: /Practice mode/ }).click();
  await expect(page.locator("audio")).toHaveJSProperty("controls", true);
});

test("listening: transcript is revealed only after submitting", async ({ page }) => {
  await page.goto("/practice/listening/library-tour");
  await page.getByRole("button", { name: /Practice mode/ }).click();
  await expect(page.getByText(/welcome to the Hartley Library tour/i)).toHaveCount(0);
  await page.getByRole("textbox", { name: /next to the/ }).fill("cafe");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
  await page.getByText("Transcript", { exact: true }).click();
  await expect(page.getByText(/welcome to the Hartley Library tour/i)).toBeVisible();
});

test("writing: Task 1 shows its chart and the AI outage is handled gracefully", async ({ page }) => {
  await page.goto("/practice/writing/task1-home-heating");
  await page.getByRole("button", { name: /Practice mode/ }).click();
  await expect(page.getByText("Households by main heating source (%)", { exact: true })).toBeVisible();
  await page.getByText("Show data as a table").click();
  await expect(page.getByRole("table")).toContainText("Solar");

  await page.getByLabel("Your answer to Task 1").fill(words(80));
  await expect(page.getByText("Word count: 80")).toBeVisible();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Submit your writing?" });
  await expect(dialog).toContainText("80 words (below 150)");
  await dialog.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText(/AI scoring is temporarily unavailable/)).toBeVisible();
  // Nothing was lost.
  await expect(page.getByLabel("Your answer to Task 1")).toHaveValue(words(80));
});

const writingReply = (wordCount: number) =>
  JSON.stringify({
    attempt: { id: "000000000000000000000000" },
    latencyMs: 10,
    evaluation: {
      bandScore: 6.5,
      criteria: { taskResponse: 6, coherenceCohesion: 7, lexicalResource: 6.5, grammaticalRange: 6.5 },
      summary: "A clear, relevant answer with a consistent position.",
      strengths: ["Clear position throughout"],
      improvements: ["Support each main idea with a specific example"],
      wordCount,
      underLength: false,
    },
  });

test("writing: results render criteria and feedback", async ({ page }) => {
  await page.route("**/api/writing/evaluate", (route) => route.fulfill({ status: 201, contentType: "application/json", body: writingReply(262) }));
  await page.goto("/practice/writing/task2-community-service");
  await page.getByRole("button", { name: /Practice mode/ }).click();
  await page.getByLabel("Your answer to Task 2").fill(words(262));
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("heading", { name: "Task 2 feedback" })).toBeVisible();
  await expect(page.getByText("Task Response")).toBeVisible();
  await expect(page.getByText("Support each main idea with a specific example")).toBeVisible();
});

test("writing: the full test has both tasks and a combined band", async ({ page }) => {
  await page.route("**/api/writing/evaluate", (route) => route.fulfill({ status: 201, contentType: "application/json", body: writingReply(200) }));
  await page.goto("/practice/writing/full?t1=task1-home-heating&t2=task2-community-service");
  await page.getByRole("button", { name: /Exam mode/ }).click();
  await expect(page.getByText(/(59|60):\d\d left/)).toBeVisible();
  await page.getByLabel("Your answer to Task 1").fill(words(160));
  await page.getByRole("button", { name: /Task 2/ }).click();
  await page.getByLabel("Your answer to Task 2").fill(words(260));
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Writing band")).toBeVisible();
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

test("speaking: the talking examiner runs the test and records only the candidate", async ({ browser }) => {
  const context = await browser.newContext({ storageState: STORAGE_STATE, permissions: ["microphone"] });
  const page = await context.newPage();
  await page.goto("/practice/speaking?set=skills-and-learning");
  await page.getByRole("link", { name: "Start the test" }).click();
  await page.getByRole("button", { name: "Allow microphone" }).click();
  await expect(page.getByRole("meter", { name: "Microphone level" })).toBeVisible();
  await page.getByRole("button", { name: "Start the test" }).click();
  await expect(page.getByText("Part 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Recording your answer")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Next question" }).click();
  await page.getByRole("button", { name: "End test now" }).click();
  await expect(page.getByRole("heading", { name: "Test complete" })).toBeVisible();
  await expect(page.getByLabel("Your recording")).toBeVisible();
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
