import { expect, test } from "@playwright/test";

test("keeps Guard correction and Operations exception workflows usable on mobile", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as Guard A" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/sign-in"));
  await page.goto("/reporting");
  await expect(
    page.getByRole("region", { name: "Your reporting corrections" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);

  await page.getByRole("button", { name: "Sign out of local demo" }).click();
  await page.waitForURL(/\/sign-in$/);
  await page
    .getByRole("button", { name: "Sign in as Operations Manager B" })
    .click();
  await page.waitForURL((url) => !url.pathname.endsWith("/sign-in"));
  await page.getByRole("link", { name: "Open Operations Center" }).click();
  await page.getByRole("link", { name: "Open reporting exceptions" }).click();
  await expect(
    page.getByRole("heading", { name: "Missing and late reports" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
});
