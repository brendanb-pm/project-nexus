import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, persona: string) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: `Sign in as ${persona}` }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/sign-in"));
}

test("Operations reviews scoped evidence and history without altering the exception", async ({
  browser,
}) => {
  const operationsContext = await browser.newContext();
  const operations = await operationsContext.newPage();
  await signIn(operations, "Operations Manager B");
  await operations.goto("/operations/reporting-exceptions");
  const evidenceLink = operations
    .getByRole("link", { name: "Review evidence and history" })
    .first();
  await expect(evidenceLink).toBeVisible();
  const href = await evidenceLink.getAttribute("href");
  expect(href).toMatch(/^\/operations\/reporting-exceptions\/[0-9a-f-]+$/);
  await evidenceLink.click();
  await expect(
    operations.getByRole("heading", { name: "Reporting exception evidence" }),
  ).toBeVisible();
  await expect(
    operations.getByRole("heading", { name: "Assignment context" }),
  ).toBeVisible();
  await expect(
    operations.getByRole("heading", { name: "Assignment evidence" }),
  ).toBeVisible();
  await expect(
    operations.getByRole("heading", { name: "Immutable lifecycle history" }),
  ).toBeVisible();
  await operations.reload();
  await expect(
    operations.getByRole("heading", { name: "Immutable lifecycle history" }),
  ).toBeVisible();
  await operationsContext.close();

  const clientContext = await browser.newContext();
  const client = await clientContext.newPage();
  await signIn(client, "Client User A");
  const denied = await client.goto(href!);
  expect(denied?.status()).toBe(404);
  await expect(
    client.getByRole("heading", { name: "Reporting exception evidence" }),
  ).toHaveCount(0);
  await clientContext.close();
});
