import { expect, test } from "@playwright/test";

async function signInAsClient(page: import("@playwright/test").Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as Client User A" }).click();
  await expect(page).toHaveURL(/\/portal$/);
}

test("shows only client-visible operational records within the authenticated client scope", async ({
  page,
}) => {
  await signInAsClient(page);
  await expect(
    page.getByRole("heading", { name: "Your operational visibility" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Current coverage" }),
  ).toBeVisible();
  await expect(
    page.getByText("Routine north lobby access-control patrol completed."),
  ).toBeVisible();
  await expect(page.getByText("INC-DEMO-0001")).toBeVisible();
  await expect(page.getByText(/employee|evidence|audit/i)).toHaveCount(0);

  await page.goto("/portal?clientId=forged-client&siteId=forged-site");
  await expect(
    page.getByText("Routine north lobby access-control patrol completed."),
  ).toBeVisible();

  await page.goto(
    "/operations/records/incident/00000000-0000-4000-8000-000000000092",
  );
  await expect(
    page.getByRole("heading", {
      name: /not authorized|unavailable|forbidden/i,
    }),
  ).toBeVisible();
});

test("does not grant the portal to a Guard through a direct URL", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as Guard A" }).click();
  await page.goto("/portal").catch(() => undefined);
  await expect(page).toHaveURL(/\/schedule$/);
});
