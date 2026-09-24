import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const evidenceRoot = process.env.NX88_SCREENSHOT_DIR;

async function capture(page: Page, name: string) {
  if (!evidenceRoot) return;
  mkdirSync(evidenceRoot, { recursive: true });
  await page.screenshot({
    path: join(evidenceRoot, `${name}.png`),
    fullPage: true,
  });
}

async function signIn(page: Page, persona: string) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: `Sign in as ${persona}` }).click();
}

async function assertNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("Guard task hierarchy, focus, reflow and rendered contrast at four viewports", async ({
  page,
}) => {
  await signIn(page, "Guard A");
  for (const [width, height] of [
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/home");
    await capture(page, `${width}x${height}-guard-home`);
    await expect(page.getByText("Activity / DAR")).toHaveCount(0);
    await page.goto("/reporting");
    await expect(
      page.getByRole("heading", { name: "Your active Shift Report" }),
    ).toBeVisible();
    await assertNoOverflow(page);
    await capture(page, `${width}x${height}-shift-report`);

    const add = page.getByRole("button", { name: "+ Add activity" });
    await expect(add).toBeVisible();
    expect(await add.count()).toBe(1);
    if (width === 390) {
      const box = await add.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThan(height - 48);
      const colors = await add.evaluate((element) => {
        const css = getComputedStyle(element);
        return { background: css.backgroundColor, foreground: css.color };
      });
      const luminance = (rgb: string) => {
        const channels = rgb
          .match(/\d+/g)!
          .slice(0, 3)
          .map(Number)
          .map((value) => {
            const normalized = value / 255;
            return normalized <= 0.04045
              ? normalized / 12.92
              : ((normalized + 0.055) / 1.055) ** 2.4;
          });
        return (
          channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
        );
      };
      const values = [
        luminance(colors.background),
        luminance(colors.foreground),
      ].sort((a, b) => b - a);
      expect((values[0]! + 0.05) / (values[1]! + 0.05)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
    await add.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Add activity" }),
    ).toBeFocused();
    await capture(page, `${width}x${height}-add-activity`);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(add).toBeFocused();

    await page.getByRole("button", { name: "File Security Incident" }).click();
    await expect(
      page.getByRole("heading", { name: "Security Incident Report" }),
    ).toBeFocused();
    await capture(page, `${width}x${height}-incident-participants`);
    await assertNoOverflow(page);
    await page
      .locator("#incident")
      .getByRole("button", { name: "Close task" })
      .click();
    await page.getByRole("button", { name: "Closeout Shift Report" }).click();
    await expect(
      page.getByRole("heading", { name: "Shift closeout" }),
    ).toBeFocused();
    await capture(page, `${width}x${height}-closeout`);
    await assertNoOverflow(page);
  }
});

test("client denial is neutral and role projections remain distinct", async ({
  browser,
}) => {
  const client = await browser.newPage();
  await signIn(client, "Client User A");
  await client.goto("/reporting");
  await expect(
    client.getByRole("heading", { name: "Page unavailable" }),
  ).toBeFocused();
  await expect(
    client.getByRole("navigation", { name: "Guard navigation" }),
  ).toHaveCount(0);
  await expect(client.getByText(/Guard operations/)).toHaveCount(0);
  await capture(client, "client-denial");
  await client.goto("/portal");
  await expect(client.getByText(/participant|draft/i)).toHaveCount(0);
  await capture(client, "client-portal");
  await client.close();

  const leadership = await browser.newPage();
  await signIn(leadership, "Leadership A");
  await leadership.goto("/leadership");
  await capture(leadership, "leadership");
  await leadership.close();

  const operations = await browser.newPage();
  await signIn(operations, "Operations Manager B");
  await operations.goto("/operations/reporting-exceptions");
  await capture(operations, "operations-exceptions");
  await operations.close();
});
