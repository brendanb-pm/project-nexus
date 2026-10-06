import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import {
  diagnosticsEnabled,
  emitDiagnosticEvent,
  normalizeDiagnosticOperation,
} from "./diagnostics";

export type RequestPerformanceSample = {
  operation: string;
  requestDurationMs: number;
  databaseDurationMs: number;
  queryCount: number;
  slowestQueryDurationMs: number;
  rowsReturned: number;
  payloadBytes?: number;
  outcome: "success" | "error";
};

type ActiveMeasurement = Omit<
  RequestPerformanceSample,
  "requestDurationMs" | "payloadBytes" | "outcome"
> & {
  startedAt: number;
  correlationToken: string;
};

type QueryResult = { rowCount?: number | null };

export type QueryableClient = {
  query: (...arguments_: unknown[]) => unknown;
};

const measurementStorage = new AsyncLocalStorage<ActiveMeasurement>();
const poolDelegationStorage = new AsyncLocalStorage<boolean>();
const instrumentedClient = Symbol("nexus.performance.instrumented-client");

function telemetryEnabled(): boolean {
  return diagnosticsEnabled();
}

function estimatePayloadBytes(value: unknown): number | undefined {
  if (value === undefined) return undefined;

  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return undefined;
  }
}

function emit(
  sample: RequestPerformanceSample,
  correlationToken: string,
): void {
  emitDiagnosticEvent({
    event: "nexus.performance",
    operation: normalizeDiagnosticOperation(sample.operation),
    correlationToken,
    requestDurationMs: sample.requestDurationMs,
    databaseDurationMs: sample.databaseDurationMs,
    queryCount: sample.queryCount,
    slowestQueryDurationMs: sample.slowestQueryDurationMs,
    rowsReturned: sample.rowsReturned,
    payloadBytes: sample.payloadBytes,
    outcome: sample.outcome,
  });
}

export async function measureRequest<T>(
  operation: string,
  work: () => Promise<T>,
  observer?: (sample: RequestPerformanceSample) => void,
): Promise<T> {
  if (!telemetryEnabled() && !observer) return work();

  const measurement: ActiveMeasurement = {
    operation,
    startedAt: performance.now(),
    correlationToken:
      measurementStorage.getStore()?.correlationToken ?? randomUUID(),
    databaseDurationMs: 0,
    queryCount: 0,
    slowestQueryDurationMs: 0,
    rowsReturned: 0,
  };

  return measurementStorage.run(measurement, async () => {
    let outcome: RequestPerformanceSample["outcome"] = "success";
    let result: T | undefined;

    try {
      result = await work();
      return result;
    } catch (error) {
      outcome = "error";
      throw error;
    } finally {
      const sample: RequestPerformanceSample = {
        operation: measurement.operation,
        requestDurationMs: performance.now() - measurement.startedAt,
        databaseDurationMs: measurement.databaseDurationMs,
        queryCount: measurement.queryCount,
        slowestQueryDurationMs: measurement.slowestQueryDurationMs,
        rowsReturned: measurement.rowsReturned,
        payloadBytes:
          outcome === "success" ? estimatePayloadBytes(result) : undefined,
        outcome,
      };
      observer?.(sample);
      emit(sample, measurement.correlationToken);
    }
  });
}

export async function measureServerAction<T>(
  operation: string,
  action: () => Promise<T>,
): Promise<T> {
  return measureRequest(operation, action);
}

function recordQuery(result: unknown, startedAt: number): void {
  const measurement = measurementStorage.getStore();
  if (!measurement) return;

  const durationMs = performance.now() - startedAt;
  let rowCount: unknown;
  try {
    if (result !== null && typeof result === "object") {
      rowCount = Object.getOwnPropertyDescriptor(result, "rowCount")?.value;
    }
  } catch {
    // Malformed driver aggregates must not replace a business result/error.
  }
  measurement.queryCount += 1;
  measurement.databaseDurationMs += durationMs;
  measurement.slowestQueryDurationMs = Math.max(
    measurement.slowestQueryDurationMs,
    durationMs,
  );
  if (
    typeof rowCount === "number" &&
    Number.isSafeInteger(rowCount) &&
    rowCount > 0
  ) {
    measurement.rowsReturned += rowCount;
  }
}

export function instrumentPgClient<T extends QueryableClient>(
  client: T,
  options: { delegatesQueries?: boolean } = {},
): T {
  const target = client as T & { [instrumentedClient]?: boolean };
  if (target[instrumentedClient]) return client;

  const originalQuery = client.query;
  target[instrumentedClient] = true;
  client.query = function instrumentedQuery(...arguments_: unknown[]): unknown {
    const startedAt = performance.now();
    const isDelegatedPoolQuery =
      !options.delegatesQueries && poolDelegationStorage.getStore() === true;
    let finished = false;
    const finish = (result: unknown) => {
      if (!finished && !isDelegatedPoolQuery) {
        finished = true;
        recordQuery(result, startedAt);
      }
    };
    const callbackIndex = arguments_.findLastIndex(
      (argument) => typeof argument === "function",
    );

    if (callbackIndex >= 0) {
      const callback = arguments_[callbackIndex] as (
        error: Error | null,
        result?: QueryResult,
      ) => void;
      arguments_[callbackIndex] = (
        error: Error | null,
        result?: QueryResult,
      ) => {
        finish(result);
        callback(error, result);
      };
    }

    try {
      const invoke = () => originalQuery.apply(this, arguments_);
      const result = options.delegatesQueries
        ? poolDelegationStorage.run(true, invoke)
        : invoke();
      if (
        callbackIndex < 0 &&
        result &&
        typeof (result as PromiseLike<unknown>).then === "function"
      ) {
        return (result as Promise<unknown>).then(
          (resolved) => {
            finish(resolved);
            return resolved;
          },
          (error: unknown) => {
            finish(undefined);
            throw error;
          },
        );
      }
      return result;
    } catch (error) {
      finish(undefined);
      throw error;
    }
  };

  return client;
}
