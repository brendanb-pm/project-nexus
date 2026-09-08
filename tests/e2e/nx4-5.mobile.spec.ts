import { expect, test } from "@playwright/test";

test("keeps Review Queue, History, and reached record details usable at 390x844", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page
    .getByRole("button", { name: "Sign in as Operations Manager B" })
    .click();
  await page.getByRole("link", { name: "Open Operations Center" }).click();
  await expect(
    page.getByRole("heading", { name: "Review Queue" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "History / Recent Activity" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);

  const activity = page.getByRole("link", {
    name: /open canonical activity \/ dar record/i,
  });
  await expect(activity).toBeVisible();
  const cardBox = await activity.boundingBox();
  expect(cardBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  await activity.click();
  await expect(
    page.getByRole("heading", { name: "Original record" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Acknowledge record" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});
