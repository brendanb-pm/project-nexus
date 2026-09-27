import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, persona: string) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: `Sign in as ${persona}` }).click();
  await expect(page).not.toHaveURL(/\/sign-in(?:\?|$)/);
}

test("Operations confirms immutable client-safe publication; Client sees only its printed version", async ({
  page,
}) => {
  test.setTimeout(120000);
  await signIn(page, "Operations Manager B");
  await page.goto("/operations/client-reports");
  await expect(
    page.getByRole("heading", { name: "Compose, review, and publish" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Client and site" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Executive summary" })
    .fill("Client-safe period summary for Cedar Plaza.");
  await page
    .getByRole("textbox", { name: "Completion summary" })
    .fill("Shift closeout evidence reviewed for this period.");
  await page
    .getByRole("textbox", { name: "Follow-ups (one per line)" })
    .fill("Confirm next visit with client.");
  const firstSource = page.locator('input[name="source"]').first();
  await expect(firstSource).toBeVisible();
  const sourceKey = await firstSource.inputValue();
  await firstSource.check();
  await page
    .locator(`input[name="summary:${sourceKey}"]`)
    .fill("Reviewed client-safe source evidence.");
  await page.getByRole("button", { name: "Save staged draft" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /Draft saved/ }),
  ).toBeVisible();
  const draftHref = await page
    .getByRole("link", { name: "Review or revise" })
    .first()
    .getAttribute("href");
  const publish = page
    .getByRole("button", { name: "Publish version 1" })
    .first();
  await expect(publish).toBeVisible();
  await publish.locator("xpath=../..").getByRole("checkbox").check();
  await publish.click();
  const firstVersion = page
    .getByRole("link", { name: /Cedar Plaza · version 1/ })
    .first();
  await expect(firstVersion).toBeVisible();
  const publishedHref = await firstVersion.getAttribute("href");
  expect(publishedHref).toMatch(/^\/portal\/reports\/[0-9a-f-]+$/);

  await signIn(page, "Client User A");
  await expect(
    page.getByRole("heading", { name: "Published site reports" }),
  ).toBeVisible();
  await expect(
    page.getByText("Client-safe period summary for Cedar Plaza."),
  ).toBeVisible();
  await expect(
    page.getByText("Routine north lobby access-control patrol completed."),
  ).toHaveCount(0);
  await page.goto(publishedHref!);
  await expect(
    page.getByRole("heading", { name: "Cedar Plaza" }),
  ).toBeVisible();
  await expect(
    page.getByText("Reviewed client-safe source evidence."),
  ).toBeVisible();
  await expect(page.getByText("Report ID")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Print / Save as PDF" }),
  ).toBeVisible();
  const pdf = await page.pdf({
    path: process.env.NX812_PRINT_PDF,
    format: "A4",
    printBackground: true,
  });
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  expect(pdf.byteLength).toBeGreaterThan(1000);
  await page.goto("/operations/client-reports");
  await expect(page.getByText(/404|not found/i).first()).toBeVisible();

  // A second confirmed version exercises draft revision, supersession, and
  // multi-page browser print without altering the first immutable snapshot.
  await signIn(page, "Operations Manager B");
  await page.goto(draftHref!);
  const paragraphs = Array.from(
    { length: 52 },
    (_, index) =>
      `Reviewed operational finding ${index + 1}: client-safe site service summary and follow-through.`,
  );
  await page
    .getByRole("textbox", { name: "Executive summary" })
    .fill(paragraphs.join("\n"));
  await page.getByRole("button", { name: "Save staged draft" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /Draft saved at revision 1/ }),
  ).toBeVisible();
  const publishSecond = page
    .getByRole("button", { name: "Publish superseding version" })
    .first();
  await publishSecond.locator("xpath=../..").getByRole("checkbox").check();
  await publishSecond.click();
  const secondVersion = page
    .getByRole("link", { name: /Cedar Plaza · version 2/ })
    .first();
  await expect(secondVersion).toBeVisible();
  const secondHref = await secondVersion.getAttribute("href");
  await signIn(page, "Client User A");
  await page.goto(secondHref!);
  await expect(page.getByText("Version status")).toBeVisible();
  await expect(page.getByText("Current", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Reviewed operational finding 52", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Supersedes")).toBeVisible();
  const longPdf = await page.pdf({
    path: process.env.NX812_PRINT_STRESS_PDF,
    format: "A4",
    printBackground: true,
  });
  expect(longPdf.byteLength).toBeGreaterThan(pdf.byteLength);
  await page.goto(publishedHref!);
  await expect(page.getByText("Superseded historical version")).toBeVisible();
});
