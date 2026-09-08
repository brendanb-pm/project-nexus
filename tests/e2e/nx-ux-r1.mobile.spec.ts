import { expect, test } from "@playwright/test";

test("keeps the Guard shell and Operations priority surfaces usable at 390x844", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as Guard A" }).click();
  await page.getByRole("link", { name: "Home" }).click({ force: true });
  await expect(
    page.getByRole("navigation", { name: "Guard navigation" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const report = page.getByRole("link", { name: "Report", exact: true });
  expect((await report.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);

  await page.goto("/sign-in");
  await page
    .getByRole("button", { name: "Sign in as Operations Manager B" })
    .click();
  await page.getByRole("link", { name: "Open Operations Center" }).click();
  await expect(page.getByText("Now", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Next", { exact: true }).first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
