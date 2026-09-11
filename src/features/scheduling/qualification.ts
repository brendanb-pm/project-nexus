import {
  credentialCoversAssignment,
  expirationBoundary,
  jurisdictionMatches,
  type CredentialJurisdiction,
} from "@/features/compliance-admin/canonical";

export type QualificationReason =
  | "MISSING"
  | "PENDING_VERIFICATION"
  | "EXPIRED_BEFORE_START"
  | "EXPIRES_DURING_SHIFT"
  | "SUSPENDED"
  | "REVOKED"
  | "JURISDICTION_MISMATCH";

export type QualificationRequirement = {
  definitionId: string;
  key: string;
  displayName: string;
  severity: "required" | "informational";
  jurisdiction: CredentialJurisdiction;
};

export type CandidateCredential = {
  definitionId: string;
  key: string;
  state:
    | "pending_verification"
    | "verified"
    | "expired"
    | "suspended"
    | "revoked"
    | "superseded";
  expiresOn?: string;
  jurisdiction: CredentialJurisdiction;
};

export type QualificationConflict = {
  definitionId: string;
  displayName: string;
  reason: QualificationReason;
  blocking: boolean;
};

function reasonForState(
  state: CandidateCredential["state"],
): QualificationReason | undefined {
  if (state === "pending_verification") return "PENDING_VERIFICATION";
  if (state === "suspended") return "SUSPENDED";
  if (state === "revoked") return "REVOKED";
  if (state === "expired") return "EXPIRED_BEFORE_START";
}

export function evaluateQualification(input: {
  requirements: readonly QualificationRequirement[];
  credentials: readonly CandidateCredential[];
  scheduledStart: string;
  scheduledEnd: string;
}): readonly QualificationConflict[] {
  return input.requirements.flatMap((requirement) => {
    const matchingDefinition = input.credentials.filter(
      (credential) => credential.key === requirement.key,
    );
    const blocking = requirement.severity === "required";
    if (!matchingDefinition.length)
      return [{ ...requirement, reason: "MISSING" as const, blocking }];
    const jurisdictional = matchingDefinition.filter((credential) =>
      jurisdictionMatches(credential.jurisdiction, requirement.jurisdiction),
    );
    if (!jurisdictional.length)
      return [
        { ...requirement, reason: "JURISDICTION_MISMATCH" as const, blocking },
      ];
    for (const credential of jurisdictional) {
      const stateReason = reasonForState(credential.state);
      if (stateReason) continue;
      if (
        credentialCoversAssignment({
          state: credential.state,
          expiresOn: credential.expiresOn,
          jurisdiction: credential.jurisdiction,
          assignmentStart: input.scheduledStart,
          assignmentEnd: input.scheduledEnd,
        })
      )
        return [];
    }
    const candidate = jurisdictional[0]!;
    const reason = reasonForState(candidate.state);
    if (reason) return [{ ...requirement, reason, blocking }];
    const expiration = candidate.expiresOn;
    const beforeStart =
      expiration && candidate.jurisdiction.timezone
        ? new Date(input.scheduledStart) >=
          expirationBoundary(expiration, candidate.jurisdiction.timezone)
        : false;
    return [
      {
        ...requirement,
        reason: beforeStart ? "EXPIRED_BEFORE_START" : "EXPIRES_DURING_SHIFT",
        blocking,
      },
    ];
  });
}
