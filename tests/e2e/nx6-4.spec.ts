import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, persona: "Leadership A" | "Admin A") {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: `Sign in as ${persona}` }).click();
  await expect(page).toHaveURL(/\/leadership$/);
}

test("does not expose leadership analytics to an unauthenticated request", async ({
  page,
}) => {
  await page.goto("/leadership").catch(() => undefined);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Leadership Operations" }),
  ).toHaveCount(0);
});

test("renders the authorized-scope Leadership operational dashboard", async ({
  page,
}) => {
  await signIn(page, "Leadership A");
  await page.goto("/operations");
  await page.getByRole("link", { name: "Open Leadership Operations" }).click();
  await expect(
    page.getByRole("heading", { name: "Leadership Operations" }),
  ).toBeVisible();
  await expect(
    page.getByText("Authorized portfolio", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Operational Health" }),
  ).toBeVisible();
  await expect(page.getByText("Current gaps", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Submitted-or-later incidents", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Compliance Risk" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Financial performance is unavailable until canonical billing and payroll foundations are implemented.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Guard A", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Evidence on file", { exact: true })).toHaveCount(
    0,
  );
});

test("allows Admin and rejects Operations from leadership analytics", async ({
  page,
}) => {
  await signIn(page, "Admin A");
  await expect(
    page.getByRole("heading", { name: "Leadership Operations" }),
  ).toBeVisible();

  await page.goto("/sign-in");
  await page
    .getByRole("button", { name: "Sign in as Operations Manager B" })
    .click();
  await page.goto("/leadership").catch(() => undefined);
  await expect(page).toHaveURL(/\/reporting$/);
  await expect(
    page.getByRole("heading", { name: "Operational Health" }),
  ).toHaveCount(0);
});
