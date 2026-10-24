import { expect, test } from "@playwright/test";

test("keeps published report access usable at mobile width", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as Client User A" }).click();
  await expect(
    page.getByRole("heading", { name: "Published site reports" }),
  ).toBeVisible();
  // Desktop acceptance may already have published a version in the shared
  // isolated database; both the empty and published client states are valid.
  await expect(
    page
      .getByText(/No published client reports/)
      .or(page.getByRole("link", { name: "Open published version" }).first()),
  ).toBeVisible();
  const scrollWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});
