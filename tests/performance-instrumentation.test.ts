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
  it("preserves synchronous, Promise and callback pg errors without duplicate counts", async () => {
    const original = Object.assign(
      new Error("NX79_CANARY_ERROR_MESSAGE_FIXTURE_20261006"),
      {
        detail: "NX79_CANARY_DRIVER_FIXTURE_20261006",
        cause: "NX79_CANARY_CAUSE_FIXTURE_20261006",
      },
    );
    const samples: RequestPerformanceSample[] = [];
    for (const query of [
      () => {
        throw original;
      },
      () => Promise.reject(original),
    ]) {
      const client = instrumentPgClient({ query });
      await expect(
        measureRequest(
          "client-admin.page",
          () => client.query() as Promise<unknown>,
          (sample) => samples.push(sample),
        ),
      ).rejects.toBe(original);
    }
    const client = instrumentPgClient({
      query: (...arguments_: unknown[]) => {
        (arguments_.at(-1) as (error: Error) => void)(original);
      },
    });
    await expect(
      measureRequest(
        "client-admin.page",
        async () => {
          client.query("NX79_CANARY_SQL_FIXTURE_20261006", () => {
            throw original;
          });
        },
        (sample) => samples.push(sample),
      ),
    ).rejects.toBe(original);
    expect(samples).toHaveLength(3);
    expect(
      samples.every(
        (sample) => sample.queryCount === 1 && sample.outcome === "error",
      ),
    ).toBe(true);
  });

  it("isolates concurrent and nested query aggregates", async () => {
    const samples: RequestPerformanceSample[] = [];
    const client = instrumentPgClient({ query: async () => ({ rowCount: 2 }) });
    await Promise.all(
      [1, 3].map((count) =>
        measureRequest(
          "client-admin.page",
          async () => {
            for (let index = 0; index < count; index++) await client.query();
            await measureRequest(
              "people-admin.page",
              async () => {
                await client.query();
              },
              (sample) => samples.push(sample),
            );
          },
          (sample) => samples.push(sample),
        ),
      ),
    );
    const outer = samples.filter(
      (sample) => sample.operation === "client-admin.page",
    );
    expect(outer.map((sample) => sample.queryCount).sort()).toEqual([1, 3]);
    expect(outer.map((sample) => sample.rowsReturned).sort()).toEqual([2, 6]);
    expect(
      samples
        .filter((sample) => sample.operation === "people-admin.page")
        .every((sample) => sample.queryCount === 1),
    ).toBe(true);
  });

  it("omits hostile row-count getters while returning the original driver result", async () => {
    const getter = vi.fn(() => {
      throw new Error("synthetic hostile row count");
    });
    const result = Object.defineProperty({}, "rowCount", { get: getter });
    const client = instrumentPgClient({ query: async () => result });
    const observer = vi.fn();
    expect(
      await measureRequest("client-admin.page", () => client.query(), observer),
    ).toBe(result);
    expect(observer.mock.calls[0]?.[0]).toMatchObject({
      queryCount: 1,
      rowsReturned: 0,
    });
    expect(getter).not.toHaveBeenCalled();
  });
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
