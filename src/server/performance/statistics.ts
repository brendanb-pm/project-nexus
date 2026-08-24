export type MeasuredOperation = {
  operation: string;
  requestDurationMs: number;
  databaseDurationMs: number;
  queryCount: number;
  slowestQueryDurationMs: number;
  rowsReturned: number;
};

export type OperationSummary = {
  operation: string;
  samples: number;
  requestP50Ms: number;
  requestP95Ms: number;
  databaseP50Ms: number;
  databaseP95Ms: number;
  maxQueryCount: number;
  maxSlowestQueryMs: number;
  maxRowsReturned: number;
};

export function percentile(
  values: readonly number[],
  percentileValue: number,
): number {
  if (!values.length)
    throw new Error("Cannot summarize an empty measurement set.");
  if (percentileValue < 0 || percentileValue > 1)
    throw new Error("Percentile must be between 0 and 1.");

  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(ordered.length * percentileValue) - 1)]!;
}

export function summarizeOperations(
  measurements: readonly MeasuredOperation[],
): OperationSummary[] {
  const byOperation = new Map<string, MeasuredOperation[]>();
  for (const measurement of measurements) {
    const samples = byOperation.get(measurement.operation) ?? [];
    samples.push(measurement);
    byOperation.set(measurement.operation, samples);
  }

  return [...byOperation.entries()]
    .map(([operation, samples]) => ({
      operation,
      samples: samples.length,
      requestP50Ms: percentile(
        samples.map((sample) => sample.requestDurationMs),
        0.5,
      ),
      requestP95Ms: percentile(
        samples.map((sample) => sample.requestDurationMs),
        0.95,
      ),
      databaseP50Ms: percentile(
        samples.map((sample) => sample.databaseDurationMs),
        0.5,
      ),
      databaseP95Ms: percentile(
        samples.map((sample) => sample.databaseDurationMs),
        0.95,
      ),
      maxQueryCount: Math.max(...samples.map((sample) => sample.queryCount)),
      maxSlowestQueryMs: Math.max(
        ...samples.map((sample) => sample.slowestQueryDurationMs),
      ),
      maxRowsReturned: Math.max(
        ...samples.map((sample) => sample.rowsReturned),
      ),
    }))
    .sort((left, right) => left.operation.localeCompare(right.operation));
}
