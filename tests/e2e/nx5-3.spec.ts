import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page
    .getByRole("button", { name: "Sign in as Operations Manager B" })
    .click();
  await page.getByRole("link", { name: "Open Operations Center" }).click();
}

test("walks Operations from the center into prioritized compliance work", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Open Compliance workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Compliance workspace" }),
  ).toBeVisible();
  await expect(
    page.getByText("Blocking upcoming assignment").first(),
  ).toBeVisible();
  await expect(page.getByText(/awaiting verification/i)).toBeVisible();
  await expect(page.getByText(/expires in \d+ days/i)).toBeVisible();
  await expect(page.getByText(/is revoked/i)).toBeVisible();
  await expect(
    page.getByText(/required CPR certification is missing/i).first(),
  ).toBeVisible();
  await expect(page.getByText(/Affected assignment:/).first()).toBeVisible();
  await page.getByRole("link", { name: "Review credential" }).first().click();
  await expect(page).toHaveURL(/\/operations\/compliance\?employee=/);
  await expect(
    page.getByText(/Focused employee credential context/i),
  ).toBeVisible();
  await page.goBack();
  await page
    .getByRole("link", { name: "View affected assignment" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/admin\/scheduling\?assignmentId=/);
});

test("denies the workspace to Guard personas", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as Guard A" }).click();
  await page.goto("/operations/compliance").catch(() => undefined);
  await expect(page).toHaveURL(/\/schedule$/);
});
