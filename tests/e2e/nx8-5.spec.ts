import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, persona: string) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: `Sign in as ${persona}` }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/sign-in"));
}

async function openQueue(page: Page) {
  await page.getByRole("link", { name: "Open Operations Center" }).click();
  await page.getByRole("link", { name: "Open reporting exceptions" }).click();
  await expect(
    page.getByRole("heading", { name: "Missing and late reports" }),
  ).toBeVisible();
}

test("Operations and Supervisor manage only their authorized reporting lifecycle", async ({
  browser,
}) => {
  const operationsContext = await browser.newContext();
  const operations = await operationsContext.newPage();
  await signIn(operations, "Operations Manager B");
  await openQueue(operations);
  const exception = operations
    .locator("section")
    .filter({ hasText: "activity entry" })
    .first();
  await expect(
    exception.getByRole("link", { name: "Open canonical report" }),
  ).toBeVisible();
  await exception
    .getByPlaceholder("Reason for lifecycle action")
    .fill("Reviewed by Operations");
  await exception.getByRole("button", { name: "Update" }).click();
  await expect(operations.getByRole("status")).toContainText("updated");
  await operations.reload();
  await expect(
    operations.locator("section").filter({ hasText: "activity entry" }).first(),
  ).toContainText("acknowledged");
  await operationsContext.close();

  const supervisorContext = await browser.newContext();
  const supervisor = await supervisorContext.newPage();
  await signIn(supervisor, "Supervisor A");
  await openQueue(supervisor);
  await expect(supervisor.getByRole("option", { name: "Waive" })).toHaveCount(
    0,
  );
  await expect(
    supervisor.getByRole("option", { name: "Escalate" }),
  ).toHaveCount(0);
  const closeout = supervisor
    .locator("section")
    .filter({ hasText: "eosr" })
    .first();
  await closeout
    .getByPlaceholder("Reason for lifecycle action")
    .fill("Guard correction requested");
  await closeout.getByRole("combobox").selectOption("CORRECTION_REQUESTED");
  await closeout.getByRole("button", { name: "Update" }).click();
  await expect(supervisor.getByRole("status")).toContainText("updated");
  await supervisorContext.close();
});

test("Guard corrects only their own deficiency through the canonical report", async ({
  browser,
}) => {
  const guardContext = await browser.newContext();
  const guard = await guardContext.newPage();
  await signIn(guard, "Guard A");
  await guard.goto("/reporting");
  const corrections = guard.getByRole("region", {
    name: "Your reporting corrections",
  });
  await expect(corrections).toBeVisible();
  await corrections
    .getByRole("link")
    .filter({ hasText: "activity entry" })
    .click();
  await guard.getByRole("button", { name: /Add activity/ }).click();
  const activity = guard.getByRole("region", { name: "Add activity" });
  await activity.getByLabel("Activity category").selectOption("OBSERVATION");
  await activity
    .getByLabel("What happened")
    .fill("Completed delayed activity correction");
  await activity.getByRole("button", { name: "Save activity" }).click();
  await expect(
    guard.getByRole("status").filter({ hasText: "confirmed" }),
  ).toBeVisible();
  await guard.goto("/reporting");
  await expect(
    guard
      .getByRole("region", { name: "Your reporting corrections" })
      .getByText(/corrected pending review/i),
  ).toBeVisible();
  await guardContext.close();

  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await signIn(other, "Incoming Guard B");
  await other.goto("/reporting");
  await expect(
    other.getByRole("region", { name: "Your reporting corrections" }),
  ).toHaveCount(0);
  await otherContext.close();
});

test("blank reason is blocked before the lifecycle server action", async ({
  page,
}) => {
  await signIn(page, "Operations Manager B");
  await openQueue(page);
  const exception = page.locator("section").filter({ hasText: "eosr" }).first();
  const before = await exception.textContent();
  await exception.getByPlaceholder("Reason for lifecycle action").fill("   ");
  await exception.getByRole("button", { name: "Update" }).click();
  await expect(page.getByRole("status")).toContainText("reason is required");
  expect(await exception.textContent()).toBe(before);
});
