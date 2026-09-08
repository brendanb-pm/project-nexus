import { expect, test, type Page } from "@playwright/test";

async function assertNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("keeps the Guard EOSR and incoming passdown usable at 390 by 844", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as Guard A" }).click();
  await page.getByRole("link", { name: "Open reporting" }).click();
  await page.getByRole("link", { name: "Open end-of-shift report" }).click();
  await expect(
    page.getByRole("group", { name: "Passdown for the incoming Guard" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit end-of-shift report" }),
  ).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Sign out of local demo" }).click();

  await page.goto("/sign-in");
  await page
    .getByRole("button", { name: "Sign in as Incoming Guard B" })
    .click();
  const passdown = page.getByRole("region", {
    name: "Incoming passdown for Cedar Plaza North North Lobby",
  });
  await expect(passdown).toBeVisible();
  const dismiss = passdown.getByRole("button", { name: "Dismiss passdown" });
  await expect(dismiss).toBeVisible();
  expect((await dismiss.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await dismiss.click();
  const reopen = passdown.getByRole("button", { name: "Reopen passdown" });
  await expect(reopen).toBeVisible();
  expect((await reopen.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await reopen.click();
  await expect(passdown).toContainText("Door closer service remains pending.");
  await assertNoHorizontalOverflow(page);
});
