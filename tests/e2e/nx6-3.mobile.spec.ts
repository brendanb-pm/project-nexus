import { expect, test } from "@playwright/test";
import { missingAssetWorkflow } from "./missing-asset-workflow";

test("reports missing and recovers with persisted history at 390x844", async ({
  page,
}) => {
  await missingAssetWorkflow(page);
});

test("keeps custody state and actions usable at 390 by 844", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page
    .getByRole("button", { name: "Sign in as Operations Manager B" })
    .click();
  await page.getByRole("link", { name: "Open Operations Center" }).click();
  await page.getByRole("link", { name: "Open Asset inventory" }).click();
  await page.getByRole("link", { name: /RADIO-001/ }).click();

  await expect(
    page.getByRole("heading", { name: "Current custody" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Record custody action" }),
  ).toBeVisible();
  await expect(
    page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).resolves.toBe(true);
});
