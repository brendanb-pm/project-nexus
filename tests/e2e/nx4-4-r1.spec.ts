import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, name: string) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: `Sign in as ${name}` }).click();
}

test("walks Guard EOSR, incoming passdown, and Operations history through local auth", async ({
  page,
}) => {
  await signIn(page, "Guard A");
  await expect(page).toHaveURL(/\/schedule$/);
  await page.getByRole("link", { name: "Open reporting" }).click();
  await expect(
    page.getByRole("link", { name: "Open end-of-shift report" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open end-of-shift report" }).click();
  await expect(
    page.getByRole("heading", { name: "End-of-shift report" }),
  ).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Passdown for the incoming Guard" }),
  ).toBeVisible();
  await page
    .getByLabel("Assignment")
    .selectOption({ label: "Cedar Plaza North · North Lobby" });
  await page.getByLabel("Shift summary").fill("North Lobby shift completed.");
  await page
    .getByLabel("Unresolved issues")
    .fill("Door closer service remains pending.");
  await page
    .getByLabel("Equipment or access status")
    .fill("Keys accounted for; radio charging.");
  await page.getByLabel("Follow-up items").fill("Confirm maintenance arrival.");
  await page
    .getByRole("button", { name: "Submit end-of-shift report" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "End-of-shift report submitted",
  );
  await page.getByRole("button", { name: "Sign out of local demo" }).click();

  await signIn(page, "Incoming Guard B");
  await expect(page).toHaveURL(/\/schedule$/);
  const passdown = page.getByRole("region", {
    name: "Incoming passdown for Cedar Plaza North North Lobby",
  });
  await expect(passdown).toContainText("North Lobby shift completed.");
  await expect(passdown).toContainText("Door closer service remains pending.");
  await passdown.getByRole("button", { name: "Dismiss passdown" }).click();
  await expect(passdown).toContainText("Passdown dismissed");
  await expect(passdown).not.toContainText(
    "Door closer service remains pending.",
  );
  await passdown.getByRole("button", { name: "Reopen passdown" }).click();
  await expect(passdown).toContainText("Door closer service remains pending.");
  await page.getByRole("button", { name: "Sign out of local demo" }).click();

  await signIn(page, "Operations Manager B");
  await expect(
    page.getByRole("heading", { name: "Supervisor / operations review" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open Operations Center" }).click();
  await expect(
    page.getByRole("heading", { name: "Needs Attention" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Shift close incomplete" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "History / Recent Activity" }),
  ).toBeVisible();
  await expect(page.getByText("North Lobby shift completed.")).toBeVisible();
  await page.getByRole("link", { name: /open canonical eosr record/i }).click();
  await expect(
    page.getByText(/Door closer service remains pending/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Operations" }).click();
  await expect(
    page.getByRole("link", {
      name: /open canonical historical handoff record/i,
    }),
  ).toBeVisible();
});
