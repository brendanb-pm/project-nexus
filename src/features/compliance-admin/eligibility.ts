import type { ArmedRequirement } from "@/features/site-admin/contracts";
import type { ComplianceSummary } from "./contracts";
export const ARMED_AUTHORIZATION_TYPE = "armed_authorization";
export type EligibilityResult = {
  eligible: boolean;
  missing: readonly string[];
  expired: readonly string[];
};
function active(record: ComplianceSummary, asOf: string) {
  return (
    record.status === "active" &&
    (!record.expiresOn || record.expiresOn >= asOf)
  );
}
export function evaluateEmployeeEligibility(input: {
  employeeStatus: "active" | "inactive";
  armedRequirement: ArmedRequirement;
  qualificationRequirements: readonly string[];
  credentials: readonly ComplianceSummary[];
  certifications: readonly ComplianceSummary[];
  asOf?: string;
}): EligibilityResult {
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const records = [...input.credentials, ...input.certifications];
  const valid = new Set(
    records
      .filter((record) => active(record, asOf))
      .map((record) => record.type.trim().toLocaleLowerCase()),
  );
  const expired = records
    .filter((record) => record.expiresOn && record.expiresOn < asOf)
    .map((record) => record.type);
  const missing =
    input.employeeStatus !== "active"
      ? ["active employment"]
      : input.qualificationRequirements.filter(
          (type) => !valid.has(type.trim().toLocaleLowerCase()),
        );
  if (
    input.armedRequirement === "armed" &&
    !valid.has(ARMED_AUTHORIZATION_TYPE)
  )
    missing.push("armed authorization");
  return { eligible: missing.length === 0, missing, expired };
}
