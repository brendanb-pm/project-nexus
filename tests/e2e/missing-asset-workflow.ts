import { expect, type Page } from "@playwright/test";

export async function missingAssetWorkflow(page: Page) {
  const reportReason = `Missing during inventory check ${page.viewportSize()?.width}`;
  const recoveryReason = `Found; returned for inspection ${page.viewportSize()?.width}`;
  await page.goto("/sign-in");
  await page
    .getByRole("button", { name: "Sign in as Operations Manager B" })
    .click();
  await page.getByRole("link", { name: "Open Operations Center" }).click();
  await page.getByRole("link", { name: "Open Asset inventory" }).click();
  await page.getByRole("link", { name: /RADIO-001/ }).click();
  const form = page
    .getByRole("heading", { name: "Current custody" })
    .locator("..");
  await form.getByLabel("Action").selectOption("REPORT_MISSING");
  await form.getByRole("button", { name: "Record custody action" }).click();
  await expect(
    form
      .getByLabel("Reason")
      .evaluate((input: HTMLTextAreaElement) => input.validity.valueMissing),
  ).resolves.toBe(true);
  await form.getByLabel("Reason").fill(reportReason);
  await form.getByRole("button", { name: "Record custody action" }).click();
  await expect(form.getByText(/Missing — last known custody:/)).toBeVisible();
  await expect(form.getByLabel("Action")).toHaveValue("RECOVER");
  await expect(form.getByRole("option", { name: "Check out" })).toHaveCount(0);
  await form.getByLabel("Return site").evaluate((select: HTMLSelectElement) => {
    select.add(
      new Option(
        "Unauthorized destination",
        "00000000-0000-4000-8000-999999999999",
      ),
    );
  });
  await form
    .getByLabel("Return site")
    .selectOption("00000000-0000-4000-8000-999999999999");
  await form.getByLabel("Reason").fill("Try invalid recovery");
  await form.getByRole("button", { name: "Record custody action" }).click();
  await expect(form.getByRole("status")).toContainText(
    "could not be confirmed",
  );
  await page.reload();
  await expect(form.getByText(/Missing — last known custody:/)).toBeVisible();
  await expect(page.getByText(/Try invalid recovery ·/)).toHaveCount(0);
  await form.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `test-results/missing-${page.viewportSize()?.width}.png`,
    fullPage: true,
  });
  await form
    .getByLabel("Return site")
    .selectOption({ label: "Cedar Plaza — Cedar Plaza North" });
  await form.getByLabel("Condition").selectOption("poor");
  await form.getByLabel("Reason").fill(recoveryReason);
  await form.getByRole("button", { name: "Record custody action" }).click();
  await expect(
    form.getByText("In inventory at Cedar Plaza North"),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Status", exact: true }).last(),
  ).toHaveValue("maintenance");
  await expect(
    page.getByText(`${reportReason} ·`, { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText(`${recoveryReason} ·`, { exact: false }),
  ).toBeVisible();
  await expect(
    page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).resolves.toBe(true);
  // Restore this shared demo asset through the existing audited administration flow.
  const edit = page
    .getByRole("heading", { name: "Edit RADIO-001" })
    .locator("..");
  await expect(
    edit.getByRole("combobox", { name: "Condition", exact: true }),
  ).toHaveValue("poor");
  await edit
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("active");
  await edit.getByLabel("Condition").selectOption("good");
  await edit.getByRole("button", { name: "Save inventory changes" }).click();
  await expect(
    edit.getByRole("combobox", { name: "Status", exact: true }),
  ).toHaveValue("active");
}
