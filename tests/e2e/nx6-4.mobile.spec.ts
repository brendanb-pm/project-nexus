import { expect, test } from "@playwright/test";

test("keeps Leadership operational health and exceptions usable at mobile width", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as Leadership A" }).click();
  await expect(
    page.getByRole("heading", { name: "Leadership Operations" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Staffing & Coverage Exceptions" }),
  ).toBeVisible();
  await expect(page.getByLabel("Client")).toBeVisible();
  await expect(page.getByLabel("Site")).toBeVisible();
  await expect(
    page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).resolves.toBe(true);
});
