import { expect, test } from "@playwright/test";

test("keeps authenticated session controls usable at 390x844", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as Guard A" }).click();
  await page.getByRole("link", { name: "More" }).click();

  const signOut = page.getByRole("button", {
    name: "Sign out of local demo",
  });
  await expect(signOut).toBeVisible();
  expect((await signOut.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  await signOut.click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
