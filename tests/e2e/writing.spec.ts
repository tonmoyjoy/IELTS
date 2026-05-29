import { expect, test } from "@playwright/test";
import { createTestAuthToken } from "./helpers/auth-token";

test("user can log in, submit writing, and see a band score", async ({ page }) => {
  const email = `e2e_${Date.now()}@example.com`;
  const password = "password12345";
  const token = await createTestAuthToken(email);

  await page.route("**/api/writing/evaluate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        attemptId: "mock-writing-attempt",
        latencyMs: 42,
        evaluation: {
          bandScore: 7,
          breakdown: {
            taskAchievement: 7,
            coherenceCohesion: 7,
            lexicalResource: 7,
            grammaticalRange: 7,
          },
          strengths: ["Clear position", "Good paragraph control"],
          improvements: ["Add more specific examples"],
          summary: "This is a clear IELTS Task 2 response with logical progression.",
        },
      }),
    });
  });

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

  await page.route("**/api/auth/register", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "set-cookie": `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax`,
      },
      body: JSON.stringify({
        ok: true,
        message: "Registration successful",
        user: { id: "mock-user-id", email, emailVerified: false },
      }),
    });
  });

  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByRole("heading", { name: "Exam preparation dashboard" })).toBeVisible();

  await page.getByRole("button", { name: "Writing" }).click();
  await page.getByPlaceholder("Write your answer here...").fill(
    Array.from({ length: 260 }, (_, index) =>
      index % 18 === 0
        ? "Universities"
        : "should balance practical employment skills with academic knowledge because students need adaptable thinking and workplace readiness."
    ).join(" ")
  );
  await page.getByRole("button", { name: "Score writing" }).click();

  await expect(page.getByText("Band 7")).toBeVisible();
  await expect(page.getByText("This is a clear IELTS Task 2 response")).toBeVisible();
});
