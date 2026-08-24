import { ValidationError } from "@/server/request/errors";
import {
  organizationStatuses,
  type CreateBranchInput,
  type OrganizationStatus,
  type UpdateBranchInput,
  type UpdateOrganizationInput,
} from "./contracts";

const MAX_NAME_LENGTH = 120;

function text(
  value: unknown,
  field: string,
  label: string,
  maxLength = MAX_NAME_LENGTH,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError({ [field]: [`${label} is required.`] });
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ValidationError({
      [field]: [`${label} must be ${maxLength} characters or fewer.`],
    });
  }
  return normalized;
}

function status(value: unknown): OrganizationStatus {
  if (
    typeof value !== "string" ||
    !organizationStatuses.includes(value as OrganizationStatus)
  ) {
    throw new ValidationError({ status: ["Select a valid status."] });
  }
  return value as OrganizationStatus;
}

function timezone(value: unknown): string {
  const normalized = text(value, "timezone", "Timezone", 80);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: normalized }).format();
  } catch {
    throw new ValidationError({
      timezone: ["Enter a valid IANA timezone, such as America/Los_Angeles."],
    });
  }
  return normalized;
}

function expectedUpdatedAt(value: unknown): string {
  const normalized = text(value, "expectedUpdatedAt", "Record version", 40);
  if (Number.isNaN(Date.parse(normalized))) {
    throw new ValidationError({
      expectedUpdatedAt: ["Refresh the record and try again."],
    });
  }
  return normalized;
}

export function validateOrganizationInput(input: UpdateOrganizationInput) {
  return {
    name: text(input.name, "name", "Organization name"),
    status: status(input.status),
    expectedUpdatedAt: expectedUpdatedAt(input.expectedUpdatedAt),
  };
}

export function validateCreateBranchInput(input: CreateBranchInput) {
  return {
    name: text(input.name, "name", "Branch name"),
    timezone: timezone(input.timezone),
    status: status(input.status),
  };
}

export function validateUpdateBranchInput(input: UpdateBranchInput) {
  return {
    branchId: text(input.branchId, "branchId", "Branch"),
    expectedUpdatedAt: expectedUpdatedAt(input.expectedUpdatedAt),
    ...validateCreateBranchInput(input),
  };
}
