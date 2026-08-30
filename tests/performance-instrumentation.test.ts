import { afterEach, describe, expect, it, vi } from "vitest";
import {
  instrumentPgClient,
  measureRequest,
  type QueryableClient,
  type RequestPerformanceSample,
} from "@/server/performance/telemetry";
import {
  percentile,
  summarizeOperations,
} from "@/server/performance/statistics";

const originalTelemetrySetting = process.env.NEXUS_PERFORMANCE_TELEMETRY;

afterEach(() => {
  if (originalTelemetrySetting === undefined) {
    delete process.env.NEXUS_PERFORMANCE_TELEMETRY;
  } else {
    process.env.NEXUS_PERFORMANCE_TELEMETRY = originalTelemetrySetting;
  }
  vi.restoreAllMocks();
});

describe("performance instrumentation", () => {
  it("collects request, query, row, and payload aggregates without query values", async () => {
    const samples: RequestPerformanceSample[] = [];
    const client: QueryableClient = {
      query: async () => ({ rowCount: 3 }),
    };
    instrumentPgClient(client);

    await measureRequest(
      "client-admin.page",
      async () => {
        await client.query("select", ["sensitive-value"]);
        await client.query("select", ["another-sensitive-value"]);
        return { items: ["one", "two"] };
      },
      (sample) => samples.push(sample),
    );

    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({
      operation: "client-admin.page",
      queryCount: 2,
      rowsReturned: 6,
      outcome: "success",
    });
    expect(samples[0]?.databaseDurationMs).toBeGreaterThanOrEqual(0);
    expect(samples[0]?.slowestQueryDurationMs).toBeGreaterThanOrEqual(0);
    expect(samples[0]?.payloadBytes).toBeGreaterThan(0);
  });

  it("emits only aggregate telemetry when explicitly enabled", async () => {
    process.env.NEXUS_PERFORMANCE_TELEMETRY = "true";
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await measureRequest("people-admin.page", async () => ({
      email: "operator@example.test",
      token: "must-not-appear",
    }));

    const event = String(log.mock.calls[0]?.[0]);
    expect(event).toContain("nexus.performance");
    expect(event).not.toContain("operator@example.test");
    expect(event).not.toContain("must-not-appear");
    expect(event).not.toContain("tenant");
  });

  it("counts pooled reads once when the pool delegates to an instrumented client", async () => {
    const samples: RequestPerformanceSample[] = [];
    const client: QueryableClient = {
      query: async () => ({ rowCount: 1 }),
    };
    const pool: QueryableClient = {
      query: async (...arguments_) => client.query(...arguments_),
    };
    instrumentPgClient(client);
    instrumentPgClient(pool, { delegatesQueries: true });

    await measureRequest(
      "organization-admin.read",
      () => pool.query("select") as Promise<unknown>,
      (sample) => samples.push(sample),
    );

    expect(samples[0]).toMatchObject({ queryCount: 1, rowsReturned: 1 });
  });

  it("retains both independent pooled reads in one request", async () => {
    const samples: RequestPerformanceSample[] = [];
    const client: QueryableClient = {
      query: async () => ({ rowCount: 1 }),
    };
    const pool: QueryableClient = {
      query: async (...arguments_) => client.query(...arguments_),
    };
    instrumentPgClient(client);
    instrumentPgClient(pool, { delegatesQueries: true });

    await measureRequest(
      "organization-admin.read",
      async () => Promise.all([pool.query("first"), pool.query("second")]),
      (sample) => samples.push(sample),
    );

    expect(samples[0]).toMatchObject({ queryCount: 2, rowsReturned: 2 });
  });

  it("summarizes repeatable p50 and p95 measurements by operation", () => {
    expect(percentile([1, 2, 3, 4], 0.95)).toBe(4);
    expect(
      summarizeOperations([
        {
          operation: "site-admin.page",
          requestDurationMs: 100,
          databaseDurationMs: 25,
          queryCount: 3,
          slowestQueryDurationMs: 12,
          rowsReturned: 25,
        },
        {
          operation: "site-admin.page",
          requestDurationMs: 200,
          databaseDurationMs: 35,
          queryCount: 3,
          slowestQueryDurationMs: 15,
          rowsReturned: 25,
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        operation: "site-admin.page",
        samples: 2,
        requestP50Ms: 100,
        requestP95Ms: 200,
        maxQueryCount: 3,
      }),
    ]);
  });
});
