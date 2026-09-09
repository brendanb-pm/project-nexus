import { expect, test } from "@playwright/test";

test("walks Guard home and report choices through the rendered navigation", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as Guard A" }).click();
  await page.getByRole("link", { name: "Home" }).click();
  await expect(
    page.getByRole("heading", { name: "Your next operational action" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Guard navigation" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Report", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Report", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Activity / DAR" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Incident" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Guard navigation" })
    .getByRole("link", { name: "More", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Timecard" })).toBeVisible();
});

test("keeps the priority operations order and scorecard now/next states visible", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page
    .getByRole("button", { name: "Sign in as Operations Manager B" })
    .click();
  await page.getByRole("link", { name: "Open Operations Center" }).click();
  const headings = await page.getByRole("heading").allTextContents();
  expect(headings.indexOf("Needs Attention")).toBeLessThan(
    headings.indexOf("Review Queue"),
  );
  expect(headings.indexOf("Review Queue")).toBeLessThan(
    headings.indexOf("Site / Post operational scorecards"),
  );
  await expect(page.getByText("Now", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Next", { exact: true }).first()).toBeVisible();
});
