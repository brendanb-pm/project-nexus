import { expect, test } from "@playwright/test";

test("keeps client-visible operational records usable at mobile width", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as Client User A" }).click();
  await expect(
    page.getByRole("heading", { name: "Your operational visibility" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Current coverage" }),
  ).toBeVisible();
  await expect(page.getByText("Recent reports")).toBeVisible();
  await expect(page.getByText("Recent incidents")).toBeVisible();
  const scrollWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});
