import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page
    .getByRole("button", { name: "Sign in as Operations Manager B" })
    .click();
  await page.getByRole("link", { name: "Open Operations Center" }).click();
}

test("walks Operations through Site and Post scorecards into canonical workflows", async ({
  page,
}) => {
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "Site / Post operational scorecards" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Needs Attention" }),
  ).toBeVisible();
  const site = page.getByTestId(
    "site-scorecard-00000000-0000-4000-8000-000000000030",
  );
  await expect(site).toContainText("Cedar Plaza North");
  await expect(site).toContainText("CRITICAL");
  await expect(site).toContainText("CoverageRequirement");
  await expect(site).toContainText("current");
  await expect(site).toContainText("upcoming");
  await site.getByRole("link", { name: "Inspect Site and Posts" }).click();
  await expect(page).toHaveURL(
    /\/operations\/sites\/00000000-0000-4000-8000-000000000030$/,
  );

  const north = page.getByTestId(
    "post-scorecard-00000000-0000-4000-8000-000000000040",
  );
  const south = page.getByTestId(
    "post-scorecard-00000000-0000-4000-8000-000000000041",
  );
  await expect(north).toContainText("North Lobby");
  await expect(north).toContainText("0 current · 1 upcoming");
  await expect(north).toContainText("1 complete · 0 incomplete");
  await expect(south).toContainText("South Gate");
  await expect(south).toContainText("CRITICAL");
  await expect(south).toContainText("1 current");

  await south.getByRole("link", { name: "Inspect Post scorecard" }).click();
  await expect(page).toHaveURL(
    /\/posts\/00000000-0000-4000-8000-000000000041$/,
  );
  await expect(page.getByRole("heading", { name: "South Gate" })).toBeVisible();
  await page.getByRole("link", { name: "Open canonical schedule" }).click();
  await expect(page).toHaveURL(
    /\/admin\/scheduling\?postId=00000000-0000-4000-8000-000000000041$/,
  );
  await expect(page.getByLabel("Post")).toHaveValue(
    "00000000-0000-4000-8000-000000000041|America/Los_Angeles",
  );

  await page.getByRole("link", { name: "Return to Operations" }).click();
  await page.getByRole("link", { name: "Inspect Site and Posts" }).click();
  await north.getByRole("link", { name: "Inspect Post scorecard" }).click();
  await expect(
    page.getByText("1 incident in this scorecard window."),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Open latest canonical Incident" })
    .click();
  await expect(page).toHaveURL(
    /\/operations\/records\/incident\/00000000-0000-4000-8000-000000000092$/,
  );
  await expect(page.getByText("INC-DEMO-0001", { exact: true })).toBeVisible();
});

test("fails invalid and unauthorized scorecard identities safely", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/operations/sites/00000000-0000-4000-8000-000000000099");
  await expect(
    page.getByRole("heading", { name: "Operational scorecard unavailable" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out of local demo" }).click();
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as Guard A" }).click();
  await expect(page).toHaveURL(/\/schedule$/);
  await page.goto("/operations/sites/00000000-0000-4000-8000-000000000030");
  await expect(
    page.getByRole("heading", {
      name: /not authorized|forbidden|unavailable/i,
    }),
  ).toBeVisible();
});
