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
  await expect(page).not.toHaveURL(/\/sign-in(?:\?|$)/);
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
  test.setTimeout(90000);
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
    await page.goto("/reports");
    await expect(
      page.getByRole("heading", { name: "Authorized reporting work" }),
    ).toBeVisible();
    await capture(page, `${width}x${height}-reporting-hub`);
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
    const closeoutAction = page.getByRole("button", {
      name: "Closeout Shift Report",
    });
    await closeoutAction.scrollIntoViewIfNeeded();
    if (width === 390) {
      const [actionBox, addBox, navBox] = await Promise.all([
        closeoutAction.boundingBox(),
        add.boundingBox(),
        page
          .getByRole("navigation", { name: "Guard navigation" })
          .boundingBox(),
      ]);
      expect(actionBox).not.toBeNull();
      expect(addBox).not.toBeNull();
      expect(navBox).not.toBeNull();
      expect(actionBox!.y + actionBox!.height).toBeLessThan(addBox!.y);
      expect(actionBox!.y + actionBox!.height).toBeLessThan(navBox!.y);
    }
    await closeoutAction.click();
    await expect(
      page.getByRole("heading", { name: "Closeout and passdown" }),
    ).toBeFocused();
    await capture(page, `${width}x${height}-closeout`);
    await assertNoOverflow(page);
    if (width === 390) {
      const submit = page.getByRole("button", {
        name: "Submit end-of-shift report",
      });
      await submit.scrollIntoViewIfNeeded();
      const [submitBox, navBox] = await Promise.all([
        submit.boundingBox(),
        page
          .getByRole("navigation", { name: "Guard navigation" })
          .boundingBox(),
      ]);
      expect(submitBox!.y + submitBox!.height).toBeLessThan(navBox!.y);
    }
  }
});

test("server-acknowledged draft recovery and retry states remain honest", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "Guard A");
  await page.goto("/reporting");
  await page.getByRole("button", { name: "+ Add activity" }).click();
  const form = page.getByRole("region", { name: "Add activity" });
  await form
    .getByLabel("What happened")
    .fill("NX88 synthetic draft presentation check");
  await expect(form.getByText(/Saved securely/)).toBeVisible();
  await capture(page, "390x844-draft-saved");
  await page.reload();
  await page.getByRole("button", { name: "+ Add activity" }).click();
  await expect(form.getByText(/Saved draft available/)).toBeVisible();
  await capture(page, "390x844-draft-available");
  await form.getByRole("button", { name: "Restore saved draft" }).click();
  await expect(form.getByLabel("What happened")).toHaveValue(
    "NX88 synthetic draft presentation check",
  );
  await capture(page, "390x844-draft-recovered");
  await page.route("**/reporting*", async (route) => {
    if (route.request().method() === "POST") await route.abort("failed");
    else await route.continue();
  });
  await form
    .getByLabel("What happened")
    .fill("NX88 synthetic draft retry check");
  await expect(
    form.getByText(/Save failed—your text is still here/),
  ).toBeVisible();
  await capture(page, "390x844-draft-retry");
  await page.unroute("**/reporting*");
  await form.getByRole("button", { name: "Save now / retry" }).click();
  await expect(form.getByText(/Saved securely/)).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await form.getByRole("button", { name: "Discard draft" }).click();
  await expect(form.getByText(/Draft discarded/)).toBeVisible();
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
