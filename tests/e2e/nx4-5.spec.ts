import { expect, test, type Page } from "@playwright/test";

const incidentId = "00000000-0000-4000-8000-000000000092";

async function signIn(page: Page, name: string) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: `Sign in as ${name}` }).click();
}

test("walks Operations review queue and history into canonical records", async ({
  page,
}) => {
  await signIn(page, "Operations Manager B");
  await page.getByRole("link", { name: "Open Operations Center" }).click();

  const attention = page
    .getByRole("heading", { name: "Needs Attention" })
    .locator("..");
  await expect(
    page.getByRole("heading", { name: "Review Queue" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "History / Recent Activity" }),
  ).toBeVisible();
  await expect(attention).not.toContainText("Incident awaiting review");
  await expect(
    page.getByRole("link", { name: /open canonical activity \/ dar record/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /open canonical incident record/i }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: /open canonical incident record/i })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/operations/records/incident/${incidentId}$`),
  );
  await expect(
    page.getByRole("heading", { name: "Original record" }),
  ).toBeVisible();
  await expect(page.getByText("INC-DEMO-0001", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Acknowledge record" }).click();
  await expect(page.getByRole("status")).toContainText(
    "now appears in History",
  );
  await page.getByRole("link", { name: "Operations" }).click();

  await expect(
    page.getByRole("link", { name: /open canonical incident record/i }),
  ).toContainText("Resolved");
  await page
    .getByRole("link", { name: /open canonical activity \/ dar record/i })
    .click();
  await page.getByLabel("Amendment reason").fill("Clarifies patrol result");
  await page
    .getByLabel("Corrected detail")
    .fill("Routine patrol completed; north entrance verified.");
  await page.getByRole("button", { name: "Record amendment" }).click();
  await expect(page.getByRole("status")).toContainText(
    "original submission remains unchanged",
  );
  await expect(page.getByText("Revision 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Reason: Clarifies patrol result")).toBeVisible();
  await page.getByRole("link", { name: "Operations" }).click();

  await page
    .getByRole("link", { name: /open canonical historical handoff record/i })
    .click();
  await expect(
    page.getByRole("heading", { name: "Original record" }),
  ).toBeVisible();
  await expect(
    page.getByText("Review synthetic access-control concern."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Operations" }).click();

  await page.getByRole("link", { name: /open canonical eosr record/i }).click();
  await expect(
    page.getByRole("heading", { name: "Original record" }),
  ).toBeVisible();
  await expect(page.getByText("North Lobby shift completed.")).toBeVisible();
  await expect(
    page.getByText(/informational.*No pending review action/i),
  ).toBeVisible();

  await page.goto(
    "/operations/records/incident/00000000-0000-4000-8000-000000000099",
  );
  await expect(
    page.getByRole("heading", { name: "Record unavailable" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out of local demo" }).click();

  await signIn(page, "Guard A");
  await expect(page).toHaveURL(/\/schedule$/);
  await page.goto(`/operations/records/incident/${incidentId}`);
  await expect(
    page.getByRole("heading", { name: "Record unavailable" }),
  ).toBeVisible();
});
