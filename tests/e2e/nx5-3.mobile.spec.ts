import { expect, test } from "@playwright/test";

test("keeps the compliance queue readable at mobile width", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page
    .getByRole("button", { name: "Sign in as Operations Manager B" })
    .click();
  await page.getByRole("link", { name: "Open Operations Center" }).click();
  await page.getByRole("link", { name: "Open Compliance workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Compliance workspace" }),
  ).toBeVisible();
  await expect(page.getByText("Compliance queue")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Review credential" }).first(),
  ).toBeVisible();
  const scrollWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});
