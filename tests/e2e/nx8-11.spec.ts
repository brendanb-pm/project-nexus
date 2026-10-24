import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, persona: string) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: `Sign in as ${persona}` }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/sign-in"));
  await page.goto("/reports/analytics");
}

test("authorized Operations and Leadership see scoped reporting analytics", async ({
  browser,
}) => {
  for (const persona of ["Operations Manager B", "Leadership A"]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, persona);
    await expect(
      page.getByRole("heading", { name: "Reporting analytics" }),
    ).toBeVisible();
    await expect(
      page.getByText("Submitted EOSR and required Activity Entry"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "On-time EOSR closeout" }),
    ).toBeVisible();
    await page.getByLabel("Period").selectOption("168");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/window=168/);
    await context.close();
  }
});

test("Client User and unauthenticated callers are denied analytics", async ({
  browser,
}) => {
  const client = await browser.newPage();
  await signIn(client, "Client User A");
  await expect(client.locator("main[role='alert']")).toContainText(
    "cannot view this operational analysis",
  );
  await client.close();
  const anonymous = await browser.newPage();
  await anonymous.goto("/reports/analytics");
  await expect(anonymous.locator("main[role='alert']")).toBeVisible();
  await anonymous.close();
});

test("Operations analytics remains usable at 390 by 844", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await signIn(page, "Operations Manager B");
  await expect(
    page.getByRole("combobox", { name: "Site", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Site comparison" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await context.close();
});
