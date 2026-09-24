import { expect, test } from "@playwright/test";

test("keeps Shift Report actions and bottom content usable at 390 by 844", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as Guard A" }).click();
  await page.getByRole("link", { name: "Open reporting" }).click();

  const add = page.getByRole("button", { name: /Add activity/ });
  const incident = page.getByRole("button", { name: "File Security Incident" });
  const closeout = page.getByRole("button", { name: "Closeout Shift Report" });
  for (const target of [add, incident, closeout]) {
    await expect(target).toBeVisible();
    expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(
      48,
    );
  }

  await add.click();
  const narrative = page.getByLabel("What happened").first();
  await narrative.fill(
    "Completed a detailed perimeter observation; all doors, gates, paths, and emergency access points remained clear and secure.",
  );
  await expect(narrative).toBeFocused();
  expect(
    (await page.getByRole("button", { name: "Save activity" }).boundingBox())
      ?.height ?? 0,
  ).toBeGreaterThanOrEqual(48);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  const lastIncident = page
    .getByRole("region", { name: "Security Incidents" })
    .getByText("Synthetic demo access-control concern for review.");
  await lastIncident.scrollIntoViewIfNeeded();
  const navigation = page.getByRole("navigation", { name: "Guard navigation" });
  const contentBox = await lastIncident.boundingBox();
  const navigationBox = await navigation.boundingBox();
  expect(contentBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(contentBox!.y + contentBox!.height).toBeLessThanOrEqual(
    navigationBox!.y,
  );
});
