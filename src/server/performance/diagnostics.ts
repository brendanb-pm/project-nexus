import {
  AuthenticationRequiredError,
  PermissionDeniedError,
  ResourceNotFoundError,
  ValidationError,
  StaleUpdateError,
  DuplicateResourceError,
  InvariantViolationError,
} from "../request/errors";

export const DIAGNOSTIC_OPERATIONS = [
  "UNKNOWN_OPERATION",
  "client-admin.page",
  "client-admin.update-client",
  "people-admin.page",
  "people-admin.update-employee",
  "site-admin.page",
  "site-admin.update-post",
  "organization-admin.read",
  "organization-admin.update-organization",
  "compliance.page",
  "compliance.verify-credential",
  "leadership.page",
  "operations.page",
  "operations.compliance.page",
  "operations.post-scorecard",
  "operations.site-scorecard",
  "operations.record-detail",
  "my-schedule.page",
  "scheduling-admin.page",
  "scheduling.create-availability",
  "scheduling.clock",
  "scheduling.create-shift",
  "scheduling.assign-employee",
  "reporting.page",
  "reporting.create-activity",
  "reporting.submit-shift-closeout",
  "reporting.create-incident",
  "reporting.acknowledge-operational-record",
  "reporting.amend-operational-record",
  "reports.page",
  "reports.analytics.page",
  "db-migrate",
  "expire-reporting-drafts",
] as const;

type ErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "STALE_UPDATE"
  | "DUPLICATE_RESOURCE"
  | "INVARIANT_VIOLATION"
  | "UNKNOWN_ERROR";

export type DiagnosticEvent = {
  event: "nexus.performance" | "nexus.diagnostic.error";
  operation: (typeof DIAGNOSTIC_OPERATIONS)[number];
  correlationToken?: string;
  requestDurationMs?: number;
  databaseDurationMs?: number;
  queryCount?: number;
  slowestQueryDurationMs?: number;
  rowsReturned?: number;
  payloadBytes?: number;
  outcome: "success" | "error";
  errorCode?: ErrorCode;
};

export function diagnosticsEnabled(): boolean {
  return process.env.NODE_ENV === "production"
    ? process.env.NEXUS_PRODUCTION_DIAGNOSTICS === "true"
    : process.env.NEXUS_PERFORMANCE_TELEMETRY === "true";
}

// Read only an own data property. Never invoke source getters or toJSON.
function ownValue(source: unknown, field: string): unknown {
  if (source === null || typeof source !== "object") return undefined;
  try {
    const property = Object.getOwnPropertyDescriptor(source, field);
    return property && "value" in property ? property.value : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeDiagnosticOperation(
  value: unknown,
): DiagnosticEvent["operation"] {
  return typeof value === "string" &&
    DIAGNOSTIC_OPERATIONS.some((operation) => operation === value)
    ? (value as DiagnosticEvent["operation"])
    : "UNKNOWN_OPERATION";
}

export function projectDiagnosticError(error: unknown): ErrorCode {
  try {
    if (error instanceof AuthenticationRequiredError)
      return "AUTHENTICATION_REQUIRED";
    if (error instanceof PermissionDeniedError) return "PERMISSION_DENIED";
    if (error instanceof ResourceNotFoundError) return "NOT_FOUND";
    if (error instanceof ValidationError) return "VALIDATION_ERROR";
    if (error instanceof StaleUpdateError) return "STALE_UPDATE";
    if (error instanceof DuplicateResourceError) return "DUPLICATE_RESOURCE";
    if (error instanceof InvariantViolationError) return "INVARIANT_VIOLATION";
  } catch {
    // Hostile proxies and malformed exceptions have the same fixed category.
  }
  return "UNKNOWN_ERROR";
}

function aggregate(
  source: unknown,
  field: string,
  integer = false,
): number | undefined {
  const value = ownValue(source, field);
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    (!integer || Number.isSafeInteger(value))
    ? value
    : undefined;
}

// This is a projection of the fixed envelope, never an arbitrary metadata bag.
export function projectDiagnosticEvent(
  source: unknown,
): DiagnosticEvent | undefined {
  const event = ownValue(source, "event");
  if (event !== "nexus.performance" && event !== "nexus.diagnostic.error")
    return undefined;
  const record: DiagnosticEvent = {
    event,
    operation: normalizeDiagnosticOperation(ownValue(source, "operation")),
    outcome: ownValue(source, "outcome") === "success" ? "success" : "error",
  };
  const token = ownValue(source, "correlationToken");
  if (
    typeof token === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
      token,
    )
  ) {
    record.correlationToken = token;
  }
  record.requestDurationMs = aggregate(source, "requestDurationMs");
  record.databaseDurationMs = aggregate(source, "databaseDurationMs");
  record.queryCount = aggregate(source, "queryCount", true);
  record.slowestQueryDurationMs = aggregate(source, "slowestQueryDurationMs");
  record.rowsReturned = aggregate(source, "rowsReturned", true);
  record.payloadBytes = aggregate(source, "payloadBytes", true);
  if (event === "nexus.diagnostic.error") {
    const code = ownValue(source, "errorCode");
    record.errorCode =
      code === "AUTHENTICATION_REQUIRED" ||
      code === "PERMISSION_DENIED" ||
      code === "NOT_FOUND" ||
      code === "VALIDATION_ERROR" ||
      code === "STALE_UPDATE" ||
      code === "DUPLICATE_RESOURCE" ||
      code === "INVARIANT_VIOLATION"
        ? code
        : "UNKNOWN_ERROR";
  }
  return record;
}

export function emitDiagnosticEvent(source: DiagnosticEvent): void {
  if (!diagnosticsEnabled()) return;
  try {
    const record = projectDiagnosticEvent(source);
    if (!record) return;
    const serialized = JSON.stringify(record);
    if (new TextEncoder().encode(serialized).byteLength > 2048) return;
    if (record.event === "nexus.diagnostic.error") console.error(serialized);
    else console.info(serialized);
  } catch {
    // Owned serialization/sink failures are best effort. No fallback logging.
  }
}
