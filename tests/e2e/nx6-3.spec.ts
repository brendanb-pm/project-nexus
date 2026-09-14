import { expect, test, type Page } from "@playwright/test";
import { missingAssetWorkflow } from "./missing-asset-workflow";

test("reports missing and recovers with persisted history on desktop", async ({
  page,
}) => {
  await missingAssetWorkflow(page);
});

async function openAsset(page: Page, identifier: string) {
  await page.goto("/sign-in");
  await page
    .getByRole("button", { name: "Sign in as Operations Manager B" })
    .click();
  await page.getByRole("link", { name: "Open Operations Center" }).click();
  await page.getByRole("link", { name: "Open Asset inventory" }).click();
  await page.getByRole("link", { name: new RegExp(identifier) }).click();
}

test("walks checkout, transfer, and check-in through immutable custody history", async ({
  page,
}) => {
  await openAsset(page, "RADIO-001");
  const form = page
    .getByRole("heading", { name: "Current custody" })
    .locator("..");

  await form
    .getByLabel("Destination employee")
    .selectOption({ label: "Guard A" });
  await form.getByLabel("Reason").fill("Issue for north lobby shift");
  await form.getByRole("button", { name: "Record custody action" }).click();
  await expect(page.getByText("Checked out to Guard A")).toBeVisible();

  await form.getByLabel("Action").selectOption("TRANSFER");
  await form
    .getByLabel("Destination employee")
    .selectOption({ label: "Incoming Guard B" });
  await form.getByLabel("Reason").fill("Shift relief transfer");
  await form.getByRole("button", { name: "Record custody action" }).click();
  await expect(page.getByText("Checked out to Incoming Guard B")).toBeVisible();

  await form.getByLabel("Action").selectOption("CHECKIN");
  await form
    .getByLabel("Return site")
    .selectOption({ label: "Cedar Plaza — Cedar Plaza North" });
  await form.getByLabel("Condition").selectOption("poor");
  await form.getByLabel("Reason").fill("Returned damaged after shift");
  await form.getByRole("button", { name: "Record custody action" }).click();

  await expect(
    page.getByText("In inventory at Cedar Plaza North"),
  ).toBeVisible();
  await expect(page.getByText(/Issue for north lobby shift/)).toBeVisible();
  await expect(page.getByText(/Shift relief transfer/)).toBeVisible();
  await expect(page.getByText(/Returned damaged after shift/)).toBeVisible();
  await expect(
    page.getByText(/Returned damaged after shift/).locator(".."),
  ).toContainText("poor");
});
