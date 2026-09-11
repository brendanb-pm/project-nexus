import { expect, test } from "@playwright/test";
test("keeps asset inventory usable at mobile width", async ({ page }) => {
  await page.goto("/sign-in");
  await page
    .getByRole("button", { name: "Sign in as Operations Manager B" })
    .click();
  await page.getByRole("link", { name: "Open Operations Center" }).click();
  await page.getByRole("link", { name: "Open Asset inventory" }).click();
  await expect(
    page.getByRole("heading", { name: "Asset inventory" }),
  ).toBeVisible();
  await expect(page.getByLabel("Search assets")).toBeVisible();
  await page.getByRole("link", { name: "Add asset" }).click();
  await expect(
    page.getByRole("button", { name: "Create asset" }),
  ).toBeVisible();
  await expect(
    page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).resolves.toBe(true);
});
