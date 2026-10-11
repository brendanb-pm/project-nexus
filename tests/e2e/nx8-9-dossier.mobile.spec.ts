import { expect, test } from "@playwright/test";

test("Operations can inspect the exception dossier at 390 by 844", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page
    .getByRole("button", { name: "Sign in as Operations Manager B" })
    .click();
  await page.waitForURL((url) => !url.pathname.endsWith("/sign-in"));
  await page.goto("/operations/reporting-exceptions");
  await page
    .getByRole("link", { name: "Review evidence and history" })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Reporting exception evidence" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Immutable lifecycle history" }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
