import {
  lifecycleStatuses,
  type LifecycleStatus,
} from "@/features/client-admin/contracts";
import { ValidationError } from "@/server/request/errors";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "./contracts";

function required(value: unknown, field: string, label: string, max = 120) {
  if (typeof value !== "string" || !value.trim())
    throw new ValidationError({ [field]: [`${label} is required.`] });
  const normalized = value.trim();
  if (normalized.length > max)
    throw new ValidationError({
      [field]: [`${label} must be ${max} characters or fewer.`],
    });
  return normalized;
}
function optional(value: unknown, field: string, label: string, max = 40) {
  if (value == null || value === "") return undefined;
  return required(value, field, label, max);
}
function status(value: unknown): LifecycleStatus {
  if (
    typeof value !== "string" ||
    !lifecycleStatuses.includes(value as LifecycleStatus)
  )
    throw new ValidationError({
      employmentStatus: ["Select a valid employment status."],
    });
  return value as LifecycleStatus;
}
export function validateEmployee(input: CreateEmployeeInput) {
  return {
    employeeNumber: required(
      input.employeeNumber,
      "employeeNumber",
      "Employee number",
      48,
    ),
    displayName: required(
      input.displayName,
      "displayName",
      "Display name",
      120,
    ),
    workPhone: optional(input.workPhone, "workPhone", "Work phone", 32),
    employmentStatus: status(input.employmentStatus),
    primaryBranchId: required(
      input.primaryBranchId,
      "primaryBranchId",
      "Primary branch",
      64,
    ),
    userId: optional(input.userId, "userId", "Application user", 64),
  };
}
export function validateUpdateEmployee(input: UpdateEmployeeInput) {
  const expectedUpdatedAt = required(
    input.expectedUpdatedAt,
    "expectedUpdatedAt",
    "Record version",
    40,
  );
  if (Number.isNaN(Date.parse(expectedUpdatedAt)))
    throw new ValidationError({
      expectedUpdatedAt: ["Refresh the record and try again."],
    });
  return {
    employeeId: required(input.employeeId, "employeeId", "Employee", 64),
    expectedUpdatedAt,
    ...validateEmployee(input),
  };
}
