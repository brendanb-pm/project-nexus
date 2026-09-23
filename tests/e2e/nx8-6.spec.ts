import { expect, test, type Browser, type Page } from "@playwright/test";

async function signIn(page: Page, persona: string) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: `Sign in as ${persona}` }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/sign-in"));
  await page.goto("/reports");
  await expect(
    page.getByRole("heading", { name: "Authorized reporting work" }),
  ).toBeVisible();
}

async function verifyDestination(
  browser: Browser,
  persona: string,
  linkName: RegExp,
  href: string,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, persona);
  await expect(page.getByRole("link", { name: linkName })).toHaveAttribute(
    "href",
    href,
  );
  await context.close();
}

test("routes each role to its canonical reporting product without cross-role data", async ({
  browser,
}) => {
  await verifyDestination(
    browser,
    "Guard A",
    /Your Shift Report/i,
    "/reporting",
  );
  await verifyDestination(
    browser,
    "Client User A",
    /Client reporting/i,
    "/portal",
  );
  await verifyDestination(
    browser,
    "Leadership A",
    /Leadership operations/i,
    "/leadership",
  );
});

test("Operations and Supervisor receive a bounded authorized operational browse", async ({
  browser,
}) => {
  for (const persona of ["Operations Manager B", "Supervisor A"]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, persona);
    await expect(
      page.getByRole("heading", { name: "Operational reporting browse" }),
    ).toBeVisible();
    await expect(
      page.getByText(/bounded to 50 records per page/i),
    ).toBeVisible();
    await page.getByLabel("Record family").selectOption("exception");
    await page.getByLabel("Time range").selectOption("168");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/family=exception/);
    await expect(page).toHaveURL(/window=168/);
    await expect(
      page.getByRole("heading", { name: "Reporting records", exact: true }),
    ).toBeVisible();
    await context.close();
  }
});

test("fails closed without authentication and remains usable at 390 by 844", async ({
  browser,
}) => {
  const anonymous = await browser.newPage();
  await anonymous.goto("/reports");
  await expect(anonymous.locator("section[role='alert']")).toContainText(
    "Reporting Hub unavailable",
  );
  await expect(
    anonymous.getByRole("heading", { name: "Operational reporting browse" }),
  ).toHaveCount(0);
  await anonymous.close();

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const mobile = await mobileContext.newPage();
  await signIn(mobile, "Operations Manager B");
  await expect(mobile.getByLabel("Site")).toBeVisible();
  await expect(mobile.getByLabel("Record family")).toBeVisible();
  expect(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await mobileContext.close();
});
