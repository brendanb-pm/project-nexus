import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  migrate: vi.fn(),
  expireBatch: vi.fn(),
  end: vi.fn(),
}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("node:fs") & { default?: typeof import("node:fs") }
  >();
  const existsSync: typeof actual.existsSync = (path) =>
    path === ".env.local" ? false : actual.existsSync(path);
  return {
    ...actual,
    existsSync,
    default: { ...(actual.default ?? actual), existsSync },
  };
});
vi.mock("pg", () => ({
  Pool: class {
    end = mocks.end;
  },
}));
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: () => ({}) }));
vi.mock("drizzle-orm/node-postgres/migrator", () => ({
  migrate: mocks.migrate,
}));
vi.mock("../src/server/db/schema", () => ({}));
vi.mock("../src/features/reporting-drafts/postgres-repository", () => ({
  PostgresReportingDraftRepository: class {
    expireBatch = mocks.expireBatch;
  },
}));

const originalExitCode = process.exitCode;
afterEach(() => {
  process.exitCode = originalExitCode;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.resetModules();
});

it.each(["migration", "expiry"])(
  "projects %s errors and cleans up with nonzero exit",
  async (script) => {
    vi.stubEnv("DATABASE_URL", "NX79_CANARY_DATABASE_URL_FIXTURE_20261006");
    vi.stubEnv("NEXUS_REPORTING_DRAFT_EXPIRY_JOB", "true");
    vi.stubEnv("NEXUS_PERFORMANCE_TELEMETRY", "true");
    const error = Object.assign(
      new Error("NX79_CANARY_ERROR_MESSAGE_FIXTURE_20261006"),
      {
        code: "NX79_CANARY_ACCESS_TOKEN_FIXTURE_20261006",
        detail: "NX79_CANARY_DRIVER_FIXTURE_20261006",
        cause: "NX79_CANARY_CAUSE_FIXTURE_20261006",
      },
    );
    mocks.migrate.mockRejectedValue(error);
    mocks.expireBatch.mockRejectedValue(error);
    mocks.end.mockResolvedValue(undefined);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    if (script === "migration") await import("../scripts/db-migrate");
    else await import("../scripts/expire-reporting-drafts");
    await vi.waitFor(() => expect(log).toHaveBeenCalledOnce());
    expect(mocks.end).toHaveBeenCalledOnce();
    expect(process.exitCode).toBe(1);
    const record = JSON.parse(String(log.mock.calls[0]?.[0]));
    expect(record.errorCode).toBe("UNKNOWN_ERROR");
    expect(record.outcome).toBe("error");
    expect(JSON.stringify(record)).not.toContain("NX79_CANARY_");
  },
);

it("keeps nonzero exit and cleanup when the CLI sink fails", async () => {
  vi.stubEnv("DATABASE_URL", "synthetic");
  vi.stubEnv("NEXUS_PERFORMANCE_TELEMETRY", "true");
  mocks.migrate.mockRejectedValue(new Error("synthetic"));
  mocks.end.mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {
    throw new Error("synthetic sink");
  });
  await import("../scripts/db-migrate");
  await vi.waitFor(() => expect(process.exitCode).toBe(1));
  expect(mocks.end).toHaveBeenCalledOnce();
});
