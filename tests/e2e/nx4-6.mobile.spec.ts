import { expect, test } from "@playwright/test";

test("keeps Site and Post scorecard drill-down usable at 390x844", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page
    .getByRole("button", { name: "Sign in as Operations Manager B" })
    .click();
  await page.getByRole("link", { name: "Open Operations Center" }).click();
  const site = page.getByTestId(
    "site-scorecard-00000000-0000-4000-8000-000000000030",
  );
  await expect(site).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Site / Post operational scorecards" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  const siteLink = site.getByRole("link", { name: "Inspect Site and Posts" });
  expect((await siteLink.boundingBox())?.height).toBeGreaterThanOrEqual(40);
  await siteLink.click();
  const south = page.getByTestId(
    "post-scorecard-00000000-0000-4000-8000-000000000041",
  );
  await expect(south).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await south.getByRole("link", { name: "Inspect Post scorecard" }).click();
  await expect(page.getByRole("heading", { name: "South Gate" })).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("link", { name: "Open canonical schedule" }),
  ).toBeVisible();
});
