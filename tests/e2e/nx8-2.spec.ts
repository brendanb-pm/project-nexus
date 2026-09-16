import { Pool } from "pg";
import { expect, test, type Page } from "@playwright/test";

const createdNarrative = "Verified the north lobby egress path was clear.";

test.afterEach(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const url = new URL(databaseUrl);
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.pathname !== "/nexus_demo"
  )
    throw new Error("NX-8.2 E2E cleanup requires the local demo database.");
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query(
      "DELETE FROM activity_entries WHERE description ->> 'narrative' = $1",
      [createdNarrative],
    );
  } finally {
    await pool.end();
  }
});

async function signInToReporting(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as Guard A" }).click();
  await page.getByRole("link", { name: "Open reporting" }).click();
}

test("records an activity in the unified active Shift Report", async ({
  page,
}) => {
  await signInToReporting(page);

  await expect(
    page.getByRole("heading", { name: "Your active Shift Report" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Active assignment context" }),
  ).toContainText("Cedar Plaza North");
  await expect(
    page
      .getByRole("region", { name: "Today’s timeline" })
      .getByText("Routine north lobby access-control patrol completed."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View INC-DEMO-0001" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Add activity/ }).click();
  await page.getByLabel("Activity category").selectOption("SAFETY_CHECK");
  await page.getByLabel("What happened").first().fill(createdNarrative);
  await page.getByLabel("Location or context").fill("North lobby");
  await page.getByLabel("Action taken").fill("Completed the safety check.");
  await page.getByRole("button", { name: "Save activity" }).click();

  await expect(page.getByText(/Activity confirmed and added/)).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Today’s timeline" })
      .getByText(createdNarrative),
  ).toBeVisible();
  await expect(page.getByText("Completed the safety check.")).toBeVisible();
  await expect(page.getByText(/Activity \/ DAR/)).toHaveCount(0);
  await expect(page.getByText(/EOSR/)).toHaveCount(0);
});

test("adapts the authorized workspace at tablet and desktop viewports", async ({
  page,
}) => {
  await signInToReporting(page);
  for (const { width, height, split } of [
    { width: 768, height: 1024, split: false },
    { width: 1024, height: 768, split: true },
    { width: 1440, height: 900, split: true },
  ]) {
    await page.setViewportSize({ width, height });
    await page.reload();
    const timeline = page.getByRole("region", { name: "Today’s timeline" });
    const incident = page
      .getByRole("heading", { name: "Security Incident Report" })
      .locator("xpath=ancestor::section[1]");
    await expect(timeline).toBeVisible();
    await expect(incident).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const timelineBox = await timeline.boundingBox();
    const incidentBox = await incident.boundingBox();
    expect(timelineBox).not.toBeNull();
    expect(incidentBox).not.toBeNull();
    if (split) expect(incidentBox!.x).toBeGreaterThan(timelineBox!.x);
    else expect(incidentBox!.y).toBeGreaterThan(timelineBox!.y);
  }
});
