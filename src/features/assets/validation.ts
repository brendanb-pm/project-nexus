import { ValidationError } from "@/server/request/errors";
import {
  assetConditions,
  assetStatuses,
  assetTypes,
  type AssetCondition,
  type AssetStatus,
  type AssetType,
  type CreateAssetInput,
} from "./contracts";
function required(value: unknown, field: string, label: string, max = 160) {
  if (typeof value !== "string" || !value.trim())
    throw new ValidationError({ [field]: [`${label} is required.`] });
  const v = value.trim();
  if (v.length > max)
    throw new ValidationError({
      [field]: [`${label} must be ${max} characters or fewer.`],
    });
  return v;
}
function enumValue<T extends readonly string[]>(
  value: unknown,
  values: T,
  field: string,
  label: string,
): T[number] {
  if (typeof value !== "string" || !values.includes(value))
    throw new ValidationError({ [field]: [`Select a valid ${label}.`] });
  return value as T[number];
}
function date(value: unknown, field: string) {
  if (value == null || value === "") return undefined;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T12:00:00Z`))
  )
    throw new ValidationError({ [field]: ["Enter a valid date."] });
  return value;
}
export function validateAsset(input: CreateAssetInput) {
  return {
    identifier: required(input.identifier, "identifier", "Identifier", 120),
    assetType: enumValue(
      input.assetType,
      assetTypes,
      "assetType",
      "asset type",
    ) as AssetType,
    status: enumValue(
      input.status,
      assetStatuses,
      "status",
      "status",
    ) as AssetStatus,
    condition: enumValue(
      input.condition,
      assetConditions,
      "condition",
      "condition",
    ) as AssetCondition,
    siteId: required(input.siteId, "siteId", "Inventory site"),
    inspectionDueOn: date(input.inspectionDueOn, "inspectionDueOn"),
    expiresOn: date(input.expiresOn, "expiresOn"),
  };
}
export function validateVersion(value: unknown) {
  const v = required(value, "expectedUpdatedAt", "Record version", 40);
  if (Number.isNaN(Date.parse(v)))
    throw new ValidationError({
      expectedUpdatedAt: ["Refresh the record and try again."],
    });
  return v;
}
export function validateCustody(input: {
  action: unknown;
  employeeId: unknown;
  siteId: unknown;
  reason: unknown;
  condition: unknown;
}) {
  const action = enumValue(
    input.action,
    ["CHECKOUT", "CHECKIN", "TRANSFER"] as const,
    "action",
    "custody action",
  );
  const reason = required(input.reason, "reason", "Reason", 500);
  const employeeId =
    typeof input.employeeId === "string" && input.employeeId.trim()
      ? input.employeeId.trim()
      : undefined;
  const siteId =
    typeof input.siteId === "string" && input.siteId.trim()
      ? input.siteId.trim()
      : undefined;
  if ((action === "CHECKOUT" || action === "TRANSFER") && !employeeId)
    throw new ValidationError({
      employeeId: ["Select a destination employee."],
    });
  if (action === "CHECKIN" && !siteId)
    throw new ValidationError({ siteId: ["Select a return site."] });
  return {
    action,
    employeeId,
    siteId,
    reason,
    condition:
      typeof input.condition === "string" && input.condition.trim()
        ? enumValue(input.condition, assetConditions, "condition", "condition")
        : undefined,
  };
}
