import { ValidationError } from "@/server/request/errors";
import {
  contractStatuses,
  lifecycleStatuses,
  type ContractStatus,
  type LifecycleStatus,
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
function optional(value: unknown, field: string, max: number) {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string" || value.trim().length > max)
    throw new ValidationError({
      [field]: [`${field} must be ${max} characters or fewer.`],
    });
  return value.trim() || undefined;
}
function lifecycle(value: unknown): LifecycleStatus {
  if (
    typeof value !== "string" ||
    !lifecycleStatuses.includes(value as LifecycleStatus)
  )
    throw new ValidationError({ status: ["Select a valid status."] });
  return value as LifecycleStatus;
}
function contractStatus(value: unknown): ContractStatus {
  if (
    typeof value !== "string" ||
    !contractStatuses.includes(value as ContractStatus)
  )
    throw new ValidationError({ status: ["Select a valid contract status."] });
  return value as ContractStatus;
}
function version(value: unknown) {
  const result = required(value, "expectedUpdatedAt", "Record version", 40);
  if (Number.isNaN(Date.parse(result)))
    throw new ValidationError({
      expectedUpdatedAt: ["Refresh the record and try again."],
    });
  return result;
}
function dateValue(value: unknown, field: string, requiredValue: boolean) {
  if (!requiredValue && (value == null || value === "")) return undefined;
  const result = required(
    value,
    field,
    field === "startsOn" ? "Start date" : "End date",
    10,
  );
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result) ||
    Number.isNaN(Date.parse(`${result}T00:00:00Z`))
  )
    throw new ValidationError({ [field]: ["Enter a valid date."] });
  return result;
}
export function validateClient(input: {
  branchId: unknown;
  name: unknown;
  status: unknown;
}) {
  return {
    branchId: required(input.branchId, "branchId", "Branch"),
    name: required(input.name, "name", "Client name"),
    status: lifecycle(input.status),
  };
}
export function validateContact(input: {
  clientId: unknown;
  name: unknown;
  email: unknown;
  phone: unknown;
  status: unknown;
}) {
  const email = optional(input.email, "email", 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new ValidationError({ email: ["Enter a valid email address."] });
  const phone = optional(input.phone, "phone", 40);
  if (phone && !/^[+()\-\.\s\d]{7,40}$/.test(phone))
    throw new ValidationError({ phone: ["Enter a valid phone number."] });
  return {
    clientId: required(input.clientId, "clientId", "Client"),
    name: required(input.name, "name", "Contact name"),
    email,
    phone,
    status: lifecycle(input.status),
  };
}
export function validateContract(input: {
  clientId: unknown;
  name: unknown;
  startsOn: unknown;
  endsOn: unknown;
  status: unknown;
}) {
  const startsOn = dateValue(input.startsOn, "startsOn", true)!;
  const endsOn = dateValue(input.endsOn, "endsOn", false);
  if (endsOn && endsOn < startsOn)
    throw new ValidationError({
      endsOn: ["End date cannot be before the start date."],
    });
  return {
    clientId: required(input.clientId, "clientId", "Client"),
    name: required(input.name, "name", "Contract name"),
    startsOn,
    endsOn,
    status: contractStatus(input.status),
  };
}
export { version as validateVersion };
