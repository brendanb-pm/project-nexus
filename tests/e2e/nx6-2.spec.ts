import { expect, test, type Page } from "@playwright/test";

async function signInOperations(page: Page) {
  await page.goto("/sign-in");
  await page
    .getByRole("button", { name: "Sign in as Operations Manager B" })
    .click();
  await page.getByRole("link", { name: "Open Operations Center" }).click();
}

test("walks authorized Operations inventory management", async ({ page }) => {
  await signInOperations(page);
  await page.getByRole("link", { name: "Open Asset inventory" }).click();
  await expect(
    page.getByRole("heading", { name: "Asset inventory" }),
  ).toBeVisible();
  await expect(page.getByText("VEH-001")).toBeVisible();
  await page.getByRole("link", { name: /RADIO-001/ }).click();
  await expect(
    page.getByRole("heading", { name: "Edit RADIO-001" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Administration history" }),
  ).toBeVisible();
  await page.getByLabel("Search assets").fill("MED-001");
  await expect(page.getByText("MED-001")).toBeVisible();
  await expect(page.getByText("VEH-001")).not.toBeVisible();
  await page.getByRole("link", { name: "Add asset" }).click();
  await page.getByLabel("Identifier").fill("RADIO-NEW");
  await page.getByRole("button", { name: "Create asset" }).click();
  await expect(page.getByText("RADIO-NEW")).toBeVisible();
});
