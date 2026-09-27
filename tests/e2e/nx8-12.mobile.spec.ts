import { expect, test } from "@playwright/test";

test("client publication and internal composition reflow at 390×844", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page
    .getByRole("button", { name: "Sign in as Operations Manager B" })
    .click();
  await expect(page).not.toHaveURL(/\/sign-in(?:\?|$)/);
  await page.goto("/operations/client-reports");
  await expect(
    page.getByRole("heading", { name: "Compose, review, and publish" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as Client User A" }).click();
  await expect(page).toHaveURL(/\/portal$/);
  await expect(
    page.getByRole("heading", { name: "Published site reports" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
