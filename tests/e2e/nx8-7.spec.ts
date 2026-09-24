import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";

const ids = {
  shift: "87000000-0000-4000-8000-000000000001",
  assignment: "87000000-0000-4000-8000-000000000002",
  post: "00000000-0000-4000-8000-000000000040",
  employee: "00000000-0000-4000-8000-000000000060",
};
const created = {
  drafts: [] as string[],
  activities: [] as string[],
  incidents: [] as string[],
  closeouts: [] as string[],
  shift: false,
};

function database() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is required.");
  const url = new URL(value);
  if (
    process.env.NEXUS_ISOLATED_TEST_DATABASE !== "true" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    !/^\/nexus_[a-z0-9_]+_test$/.test(url.pathname)
  )
    throw new Error(
      "NX-8.7 acceptance requires an explicitly isolated local test database.",
    );
  return new Pool({ connectionString: value });
}

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as Guard A" }).click();
  await page.getByRole("link", { name: "Open reporting" }).click();
  await expect(
    page.getByRole("heading", { name: "Your active Shift Report" }),
  ).toBeVisible();
}

async function trackDraft(contentField: string, content: string) {
  const pool = database();
  try {
    const result = await pool.query<{ id: string }>(
      `SELECT id FROM reporting_drafts WHERE payload ->> $1 = $2 ORDER BY created_at DESC LIMIT 1`,
      [contentField, content],
    );
    const id = result.rows[0]?.id;
    expect(id).toBeTruthy();
    created.drafts.push(id!);
    return id!;
  } finally {
    await pool.end();
  }
}

async function trackCanonical(
  table: "activity_entries" | "incident_reports" | "end_of_shift_reports",
  column: "narrative" | "summary",
  value: string,
) {
  const pool = database();
  try {
    const expression =
      table === "activity_entries" ? "description ->> 'narrative'" : column;
    const result = await pool.query<{ id: string }>(
      `SELECT id FROM ${table} WHERE ${expression} = $1`,
      [value],
    );
    expect(result.rows).toHaveLength(1);
    const id = result.rows[0]!.id;
    if (table === "activity_entries") created.activities.push(id);
    else if (table === "incident_reports") created.incidents.push(id);
    else created.closeouts.push(id);
  } finally {
    await pool.end();
  }
}

test.afterEach(async () => {
  const pool = database();
  try {
    if (created.shift) {
      const closeout = await pool.query<{ id: string }>(
        "SELECT id FROM end_of_shift_reports WHERE shift_assignment_id = $1",
        [ids.assignment],
      );
      for (const row of closeout.rows)
        if (!created.closeouts.includes(row.id)) created.closeouts.push(row.id);
    }
    const all = [
      ...created.drafts,
      ...created.activities,
      ...created.incidents,
      ...created.closeouts,
    ];
    if (all.length)
      await pool.query(
        "DELETE FROM audit_events WHERE entity_id = ANY($1::uuid[])",
        [all],
      );
    if (created.drafts.length)
      await pool.query(
        "DELETE FROM reporting_drafts WHERE id = ANY($1::uuid[])",
        [created.drafts],
      );
    if (created.incidents.length) {
      await pool.query(
        "DELETE FROM incident_participants WHERE incident_report_id = ANY($1::uuid[])",
        [created.incidents],
      );
      await pool.query(
        "DELETE FROM incident_reports WHERE id = ANY($1::uuid[])",
        [created.incidents],
      );
    }
    if (created.activities.length)
      await pool.query(
        "DELETE FROM activity_entries WHERE id = ANY($1::uuid[])",
        [created.activities],
      );
    if (created.closeouts.length)
      await pool.query(
        "DELETE FROM end_of_shift_reports WHERE id = ANY($1::uuid[])",
        [created.closeouts],
      );
    if (created.shift) {
      await pool.query("DELETE FROM shift_assignments WHERE id = $1", [
        ids.assignment,
      ]);
      await pool.query("DELETE FROM shifts WHERE id = $1", [ids.shift]);
    }
  } finally {
    await pool.end();
    created.drafts.length = 0;
    created.activities.length = 0;
    created.incidents.length = 0;
    created.closeouts.length = 0;
    created.shift = false;
  }
});

test("ActivityEntry draft survives refresh and submits once", async ({
  page,
}) => {
  const narrative = "NX87 synthetic activity recovery note";
  await signIn(page);
  await page.getByRole("button", { name: "+ Add activity" }).click();
  const form = page
    .getByRole("heading", { name: "Add activity" })
    .locator("xpath=ancestor::section[1]");
  await form.getByLabel("What happened").fill(narrative);
  await expect(form.getByText(/Saved securely/)).toBeVisible();
  await trackDraft("narrative", narrative);
  await page.reload();
  await page.getByRole("button", { name: "+ Add activity" }).click();
  const restored = page
    .getByRole("heading", { name: "Add activity" })
    .locator("xpath=ancestor::section[1]");
  await restored.getByRole("button", { name: "Restore saved draft" }).click();
  await expect(restored.getByLabel("What happened")).toHaveValue(narrative);
  await restored.getByRole("button", { name: "Save activity" }).click();
  await expect(
    restored.getByText(/Activity confirmed and added/),
  ).toBeVisible();
  await trackCanonical("activity_entries", "narrative", narrative);
  await page.reload();
  await page.getByRole("button", { name: "+ Add activity" }).click();
  await expect(
    page.getByRole("button", { name: "Restore saved draft" }),
  ).toHaveCount(0);
});

test("Incident draft restores participants and excludes attachments", async ({
  page,
}) => {
  const narrative = "NX87 synthetic incident recovery note";
  await signIn(page);
  await page.getByRole("button", { name: "File Security Incident" }).click();
  const form = page
    .getByRole("heading", { name: "Security Incident Report" })
    .locator("xpath=ancestor::section[1]");
  await form.getByLabel("What happened").fill(narrative);
  await form.getByLabel("Immediate actions taken").fill("Secured the entry.");
  await form
    .getByLabel("Descriptive identifier")
    .fill("Unknown visitor in blue jacket");
  await form
    .getByLabel("Involvement summary")
    .fill("Attempted to enter the lobby.");
  await expect(form.getByText(/Saved securely/)).toBeVisible();
  await trackDraft("narrative", narrative);
  await page.reload();
  const recovered = page
    .getByRole("heading", { name: "Security Incident Report" })
    .locator("xpath=ancestor::section[1]");
  await recovered.getByRole("button", { name: "Restore saved draft" }).click();
  await expect(recovered.getByLabel("Descriptive identifier")).toHaveValue(
    "Unknown visitor in blue jacket",
  );
  await expect(recovered.getByLabel("Involvement summary")).toHaveValue(
    "Attempted to enter the lobby.",
  );
  await expect(recovered.getByText(/attachment/i)).toHaveCount(0);
  await recovered
    .getByRole("button", { name: "Submit Security Incident" })
    .click();
  await expect(recovered.getByText(/Security Incident INC-/)).toBeVisible();
  await trackCanonical("incident_reports", "narrative", narrative);
});

test("same-user recovery conflicts safely across devices and other roles see no draft", async ({
  page,
  browser,
}) => {
  const narrative = "NX87 private two-device draft note";
  await signIn(page);
  await page.getByRole("button", { name: "+ Add activity" }).click();
  const original = page
    .getByRole("heading", { name: "Add activity" })
    .locator("xpath=ancestor::section[1]");
  await original.getByLabel("What happened").fill(narrative);
  await expect(original.getByText(/Saved securely/)).toBeVisible();
  await trackDraft("narrative", narrative);

  const secondContext = await browser.newContext();
  const second = await secondContext.newPage();
  try {
    await signIn(second);
    await second.getByRole("button", { name: "+ Add activity" }).click();
    const recovered = second
      .getByRole("heading", { name: "Add activity" })
      .locator("xpath=ancestor::section[1]");
    await recovered
      .getByRole("button", { name: "Restore saved draft" })
      .click();
    await expect(recovered.getByLabel("What happened")).toHaveValue(narrative);
    await recovered
      .getByLabel("What happened")
      .fill("NX87 revised on second device");
    await expect(recovered.getByText(/Saved securely/)).toBeVisible();
    await original
      .getByLabel("What happened")
      .fill("NX87 stale first-device edit");
    await expect(
      original.getByText(/Saved draft changed elsewhere/),
    ).toBeVisible();
    await expect(original.getByLabel("What happened")).toHaveValue(
      "NX87 stale first-device edit",
    );
    for (const [persona, route] of [
      [
        "Incoming Guard B",
        "/reporting?assignmentId=00000000-0000-4000-8000-000000000090",
      ],
      ["Client User A", "/portal"],
      ["Leadership A", "/leadership"],
      ["Operations Manager B", "/reports"],
      ["Operations Manager B", "/operations/reporting-exceptions"],
    ] as const) {
      const outsiderContext = await browser.newContext();
      try {
        const outsider = await outsiderContext.newPage();
        await outsider.goto("/sign-in");
        await outsider
          .getByRole("button", { name: `Sign in as ${persona}` })
          .click();
        await expect(
          outsider.getByRole("button", { name: "Sign out of local demo" }),
        ).toBeVisible();
        await outsider.goto(route);
        await expect(outsider.getByText(narrative)).toHaveCount(0);
        await expect(
          outsider.getByText("NX87 revised on second device"),
        ).toHaveCount(0);
      } finally {
        await outsiderContext.close();
      }
    }
    second.once("dialog", (dialog) => void dialog.accept());
    await recovered.getByRole("button", { name: "Discard draft" }).click();
    await expect(recovered.getByText(/Draft discarded/)).toBeVisible();
    await second.reload();
    await second.getByRole("button", { name: "+ Add activity" }).click();
    await expect(
      second.getByRole("button", { name: "Restore saved draft" }),
    ).toHaveCount(0);
  } finally {
    await secondContext.close();
  }
});

test("390×844 draft save failure retries and discard removes recovery", async ({
  page,
}) => {
  const narrative = "NX87 mobile retry and discard note";
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.getByRole("button", { name: "+ Add activity" }).click();
  const form = page
    .getByRole("heading", { name: "Add activity" })
    .locator("xpath=ancestor::section[1]");
  await expect(form.getByText("Draft ready.")).toBeVisible();
  await page.route("**/reporting*", async (route) => {
    if (route.request().method() === "POST") await route.abort("failed");
    else await route.continue();
  });
  await form.getByLabel("What happened").fill(narrative);
  await expect(form.getByText(/Could not save this draft/)).toBeVisible();
  await expect(form.getByLabel("What happened")).toHaveValue(narrative);
  await page.unroute("**/reporting*");
  await form.getByRole("button", { name: "Save now / retry" }).click();
  await expect(form.getByText(/Saved securely/)).toBeVisible();
  await trackDraft("narrative", narrative);
  await page.reload();
  await page.getByRole("button", { name: "+ Add activity" }).click();
  const recovered = page
    .getByRole("heading", { name: "Add activity" })
    .locator("xpath=ancestor::section[1]");
  const restore = recovered.getByRole("button", {
    name: "Restore saved draft",
  });
  await expect(restore).toBeVisible();
  expect((await restore.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(48);
  await restore.click();
  await expect(recovered.getByLabel("What happened")).toHaveValue(narrative);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  page.once("dialog", (dialog) => void dialog.accept());
  await recovered.getByRole("button", { name: "Discard draft" }).click();
  await expect(recovered.getByText(/Draft discarded/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "+ Add activity" }).click();
  await expect(
    page.getByRole("button", { name: "Restore saved draft" }),
  ).toHaveCount(0);
});

test("EOSR draft survives navigation and reauthentication, then submits once", async ({
  page,
}) => {
  const pool = database();
  try {
    const now = Date.now();
    await pool.query(
      "INSERT INTO shifts (id, post_id, scheduled_start, scheduled_end, timezone, status) VALUES ($1, $2, $3, $4, 'UTC', 'PUBLISHED')",
      [
        ids.shift,
        ids.post,
        new Date(now - 30 * 60 * 1000),
        new Date(now + 2 * 60 * 60 * 1000),
      ],
    );
    await pool.query(
      "INSERT INTO shift_assignments (id, shift_id, employee_id, status, assigned_at) VALUES ($1, $2, $3, 'assigned', now())",
      [ids.assignment, ids.shift, ids.employee],
    );
    created.shift = true;
  } finally {
    await pool.end();
  }
  const summary = "NX87 synthetic closeout and passdown recovery";
  await signIn(page);
  await page.getByRole("button", { name: "Closeout Shift Report" }).click();
  const form = page.locator("#shift-closeout");
  await form.getByLabel("Shift summary").fill(summary);
  await form.getByLabel("Unresolved issues").fill("Door service pending.");
  await expect(form.getByText(/Saved securely/)).toBeVisible();
  await trackDraft("summary", summary);
  await page.getByRole("button", { name: "Sign out of local demo" }).click();
  await expect(page).toHaveURL(/sign-in/);
  await page.goto("/reporting");
  await expect(page.getByText(summary)).toHaveCount(0);
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in as Guard A" }).click();
  await page.getByRole("link", { name: "Open reporting" }).click();
  await page.getByRole("button", { name: "Closeout Shift Report" }).click();
  const recovered = page.locator("#shift-closeout");
  await recovered.getByRole("button", { name: "Restore saved draft" }).click();
  await expect(recovered.getByLabel("Shift summary")).toHaveValue(summary);
  await recovered
    .getByRole("button", { name: "Submit end-of-shift report" })
    .click();
  await expect(
    recovered.getByText(/End-of-shift report submitted/),
  ).toBeVisible();
  await trackCanonical("end_of_shift_reports", "summary", summary);
});
