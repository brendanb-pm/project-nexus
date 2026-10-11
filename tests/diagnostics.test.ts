import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DIAGNOSTIC_OPERATIONS,
  emitDiagnosticEvent,
  projectDiagnosticEvent,
  projectDiagnosticError,
} from "@/server/performance/diagnostics";
import {
  instrumentPgClient,
  measureRequest,
} from "@/server/performance/telemetry";
import * as errors from "@/server/request/errors";

const classes = [
  "TENANT",
  "ORG",
  "BRANCH",
  "SITE",
  "CLIENT",
  "EMPLOYEE",
  "USER",
  "ACTOR",
  "ASSIGNMENT",
  "REPORT",
  "INCIDENT",
  "SESSION",
  "EMAIL",
  "PHONE",
  "NAME",
  "IP",
  "AUTH_SUBJECT",
  "ACCESS_TOKEN",
  "REFRESH_TOKEN",
  "ID_TOKEN",
  "SECRET",
  "PASSWORD",
  "KEY",
  "DATABASE_URL",
  "COOKIE",
  "AUTHORIZATION",
  "REQUEST_BODY",
  "RESPONSE_BODY",
  "SQL",
  "SQL_PARAMETER",
  "ERROR_MESSAGE",
  "STACK",
  "CAUSE",
  "DRIVER",
  "SOURCE_REQUEST_ID",
  "TRACE_HEADER",
] as const;
const corpus = classes.map((name) => `NX79_CANARY_${name}_FIXTURE_20261006`);
const keys = [
  "event",
  "operation",
  "correlationToken",
  "requestDurationMs",
  "databaseDurationMs",
  "queryCount",
  "slowestQueryDurationMs",
  "rowsReturned",
  "payloadBytes",
  "outcome",
  "errorCode",
];

// Independent capture assertions: deliberately bypassing projection must fail.
function assertCapture(text: string) {
  const record = JSON.parse(text);
  expect(Object.keys(record).every((key) => keys.includes(key))).toBe(true);
  expect(DIAGNOSTIC_OPERATIONS).toContain(record.operation);
  expect(["nexus.performance", "nexus.diagnostic.error"]).toContain(
    record.event,
  );
  expect(["success", "error"]).toContain(record.outcome);
  expect(new TextEncoder().encode(text).byteLength).toBeLessThanOrEqual(2048);
  for (const canary of corpus) expect(text).not.toContain(canary);
  return record;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("safe diagnostic envelope", () => {
  it("rejects the whole synthetic corpus in fields, exceptions, SQL and parameters", async () => {
    vi.stubEnv("NEXUS_PERFORMANCE_TELEMETRY", "true");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const material = corpus.join(" ");
    const original = Object.assign(new Error(material), {
      stack: material,
      cause: material,
      code: material,
      detail: material,
      hint: material,
    });
    const source = Object.fromEntries(
      classes.map((name, index) => [name, corpus[index]]),
    );
    emitDiagnosticEvent(
      Object.assign(source, {
        event: "nexus.diagnostic.error" as const,
        operation: "db-migrate" as const,
        correlationToken: randomUUID(),
        outcome: "error" as const,
        errorCode: projectDiagnosticError(original),
      }),
    );
    await measureRequest("client-admin.page", async () => source);
    for (const work of [
      () => {
        throw original;
      },
      () => Promise.reject(original),
    ]) {
      await expect(measureRequest("client-admin.page", work)).rejects.toBe(
        original,
      );
      const client = instrumentPgClient({
        query: (...args: unknown[]) => {
          expect(args).toEqual([material, corpus]);
          return work();
        },
      });
      await expect(
        measureRequest(
          "client-admin.page",
          () => client.query(material, corpus) as Promise<unknown>,
        ),
      ).rejects.toBe(original);
    }
    const callbackClient = instrumentPgClient({
      query: (...args: unknown[]) => {
        (args.at(-1) as (error: Error) => void)(original);
      },
    });
    await measureRequest(
      "client-admin.page",
      () =>
        new Promise<void>((resolve) => {
          callbackClient.query(material, corpus, (error: Error) => {
            expect(error).toBe(original);
            resolve();
          });
        }),
    );
    [...info.mock.calls, ...errorLog.mock.calls].forEach((call) =>
      assertCapture(String(call[0])),
    );
  });
  it("projects own finite fields without invoking getters or toJSON", () => {
    const getter = vi.fn(() => {
      throw new Error(corpus[0]);
    });
    const source = {
      event: "nexus.performance",
      operation: "client-admin.page",
      correlationToken: randomUUID(),
      outcome: "success",
      queryCount: 1,
      requestDurationMs: 0,
      databaseDurationMs: Infinity,
      payloadBytes: -1,
      rowsReturned: 0.5,
    };
    Object.defineProperty(source, "extra", { get: getter });
    Object.defineProperty(source, "toJSON", { get: getter });
    const record = assertCapture(
      JSON.stringify(projectDiagnosticEvent(source)),
    );
    expect(record).toMatchObject({ queryCount: 1, requestDurationMs: 0 });
    expect(record).not.toHaveProperty("databaseDurationMs");
    expect(record).not.toHaveProperty("payloadBytes");
    expect(record).not.toHaveProperty("rowsReturned");
    expect(getter).not.toHaveBeenCalled();
    for (const bad of [null, 42, corpus[0], {}, { event: corpus[0] }]) {
      expect(projectDiagnosticEvent(bad)).toBeUndefined();
    }
    const hostile = new Proxy({}, { getOwnPropertyDescriptor: getter });
    expect(projectDiagnosticEvent(hostile)).toBeUndefined();
    expect(projectDiagnosticError(hostile)).toBe("UNKNOWN_ERROR");
  });

  it("bounds every operation and normalizes each prohibited identity class", async () => {
    vi.stubEnv("NEXUS_PERFORMANCE_TELEMETRY", "true");
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    for (const operation of [
      ...corpus,
      "x".repeat(10000),
      "bad\r\nlabel",
      "resource/1234",
      "route?token=synthetic",
    ]) {
      await measureRequest(operation, async () => ({ operation, corpus }));
    }
    for (const call of log.mock.calls) {
      expect(assertCapture(String(call[0])).operation).toBe(
        "UNKNOWN_OPERATION",
      );
    }
    expect(
      DIAGNOSTIC_OPERATIONS.every(
        (label) => label.length <= 64 && /^[\x20-\x7e]+$/.test(label),
      ),
    ).toBe(true);
    expect(() =>
      assertCapture(
        JSON.stringify({
          event: "nexus.performance",
          operation: "client-admin.page",
          outcome: "success",
          actor: corpus[0],
        }),
      ),
    ).toThrow();
    expect(() =>
      assertCapture(
        JSON.stringify({
          event: "nexus.performance",
          operation: corpus[0],
          outcome: "success",
        }),
      ),
    ).toThrow();
  });

  it("uses fixed typed errors and never trusts an arbitrary code", () => {
    const instances = [
      new errors.AuthenticationRequiredError(),
      new errors.PermissionDeniedError(),
      new errors.ResourceNotFoundError(corpus[0]),
      new errors.ValidationError({ synthetic: corpus }),
      new errors.StaleUpdateError(),
      new errors.DuplicateResourceError(corpus[0]),
      new errors.InvariantViolationError(corpus[0]),
    ];
    for (const error of instances)
      expect(projectDiagnosticError(error)).toBe(error.code);
    const forged = Object.assign(new Error(corpus[0]), {
      code: "PERMISSION_DENIED",
      cause: corpus,
      detail: corpus,
    });
    expect(projectDiagnosticError(forged)).toBe("UNKNOWN_ERROR");
    Object.defineProperty(forged, "code", {
      get() {
        throw new Error("synthetic");
      },
    });
    expect(projectDiagnosticError(forged)).toBe("UNKNOWN_ERROR");
  });

  it("reuses nested UUIDs and isolates parallel scopes and query aggregates", async () => {
    vi.stubEnv("NEXUS_PERFORMANCE_TELEMETRY", "true");
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await Promise.all(
      [0, 1].map(() =>
        measureRequest("client-admin.page", async () => {
          await measureRequest("people-admin.page", async () => corpus);
          return corpus;
        }),
      ),
    );
    const records = log.mock.calls.map((call) =>
      assertCapture(String(call[0])),
    );
    const tokens = records.map((record) => record.correlationToken);
    expect(new Set(tokens).size).toBe(2);
    for (const token of new Set(tokens)) {
      expect(tokens.filter((candidate) => candidate === token)).toHaveLength(2);
      expect(token).toMatch(/^[a-f0-9-]{36}$/);
    }
  });

  it.each([undefined, "false", "TRUE", "1", "malformed"])(
    "production remains off for %s",
    async (flag) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("NEXUS_PERFORMANCE_TELEMETRY", "true");
      vi.stubEnv("NEXUS_PRODUCTION_DIAGNOSTICS", flag);
      const info = vi
        .spyOn(console, "info")
        .mockImplementation(() => undefined);
      const error = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const observer = vi.fn();
      await measureRequest("client-admin.page", async () => corpus, observer);
      expect(observer).toHaveBeenCalledOnce();
      expect(info).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    },
  );

  it("production opt-in and safe CLI envelopes pass capture checks", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXUS_PRODUCTION_DIAGNOSTICS", "true");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    await measureRequest("client-admin.page", async () => corpus);
    emitDiagnosticEvent({
      event: "nexus.diagnostic.error",
      operation: "db-migrate",
      correlationToken: randomUUID(),
      outcome: "error",
      errorCode: "UNKNOWN_ERROR",
    });
    [...info.mock.calls, ...error.mock.calls].forEach((call) =>
      assertCapture(String(call[0])),
    );
  });

  it("isolates sink and serializer failures and preserves observer failures", async () => {
    vi.stubEnv("NEXUS_PERFORMANCE_TELEMETRY", "true");
    const original = new Error(corpus.join(" "));
    const work = vi.fn(async () => 42);
    vi.spyOn(console, "info").mockImplementation(() => {
      throw original;
    });
    expect(await measureRequest("client-admin.page", work)).toBe(42);
    await expect(
      measureRequest("client-admin.page", async () => {
        throw original;
      }),
    ).rejects.toBe(original);
    expect(work).toHaveBeenCalledOnce();
    vi.spyOn(JSON, "stringify").mockImplementation(() => {
      throw original;
    });
    expect(await measureRequest("client-admin.page", async () => 42)).toBe(42);
    await expect(
      measureRequest("client-admin.page", async () => {
        throw original;
      }),
    ).rejects.toBe(original);
    const observerError = new Error("synthetic observer");
    await expect(
      measureRequest(
        "client-admin.page",
        async () => 42,
        () => {
          throw observerError;
        },
      ),
    ).rejects.toBe(observerError);
  });
});
