import { expect, test } from "@playwright/test";

test("keeps published report access usable at mobile width", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as Client User A" }).click();
  await expect(
    page.getByRole("heading", { name: "Published site reports" }),
  ).toBeVisible();
  await expect(page.getByText(/No published client reports/)).toBeVisible();
  const scrollWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});
