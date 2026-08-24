import { ValidationError } from "@/server/request/errors";
import {
  complianceStatuses,
  type ComplianceStatus,
  type CreateComplianceInput,
  type RenewComplianceInput,
  type UpdateComplianceInput,
} from "./contracts";
function required(value: unknown, field: string, label: string, max = 120) {
  if (typeof value !== "string" || !value.trim())
    throw new ValidationError({ [field]: [`${label} is required.`] });
  const result = value.trim();
  if (result.length > max)
    throw new ValidationError({
      [field]: [`${label} must be ${max} characters or fewer.`],
    });
  return result;
}
function optional(value: unknown, field: string, label: string, max = 240) {
  return value == null || value === ""
    ? undefined
    : required(value, field, label, max);
}
function date(
  value: unknown,
  field: string,
  label: string,
  requiredDate = true,
) {
  if (!requiredDate && (value == null || value === "")) return undefined;
  const result = required(value, field, label, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result) ||
    Number.isNaN(Date.parse(`${result}T00:00:00Z`))
  )
    throw new ValidationError({ [field]: [`${label} must be a valid date.`] });
  return result;
}
function status(value: unknown): ComplianceStatus {
  if (
    typeof value !== "string" ||
    !complianceStatuses.includes(value as ComplianceStatus)
  )
    throw new ValidationError({
      status: ["Select a valid compliance status."],
    });
  return value as ComplianceStatus;
}
export function validateCompliance(input: CreateComplianceInput) {
  const issuedOn = date(input.issuedOn, "issuedOn", "Issued date")!;
  const expiresOn = date(
    input.expiresOn,
    "expiresOn",
    "Expiration date",
    false,
  );
  if (expiresOn && expiresOn < issuedOn)
    throw new ValidationError({
      expiresOn: ["Expiration must be on or after the issued date."],
    });
  return {
    employeeId: required(input.employeeId, "employeeId", "Employee", 64),
    type: required(input.type, "type", "Type", 80),
    identifier: optional(input.identifier, "identifier", "Identifier", 80),
    issuingAuthority: required(
      input.issuingAuthority,
      "issuingAuthority",
      "Issuing authority",
      120,
    ),
    issuedOn,
    expiresOn,
    status: status(input.status),
    documentReference: optional(
      input.documentReference,
      "documentReference",
      "Document reference",
      240,
    ),
  };
}
export function validateUpdateCompliance(input: UpdateComplianceInput) {
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
    recordId: required(input.recordId, "recordId", "Record", 64),
    expectedUpdatedAt,
    ...validateCompliance(input),
  };
}
export function validateRenewCompliance(input: RenewComplianceInput) {
  return {
    predecessorId: required(
      input.predecessorId,
      "predecessorId",
      "Prior record",
      64,
    ),
    ...validateCompliance(input),
  };
}
export function validateVersion(value: unknown) {
  const expectedUpdatedAt = required(
    value,
    "expectedUpdatedAt",
    "Record version",
    40,
  );
  if (Number.isNaN(Date.parse(expectedUpdatedAt)))
    throw new ValidationError({
      expectedUpdatedAt: ["Refresh the record and try again."],
    });
  return expectedUpdatedAt;
}
