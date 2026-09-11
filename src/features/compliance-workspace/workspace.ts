import { expirationBoundary } from "@/features/compliance-admin/canonical";
import {
  evaluateQualification,
  type QualificationReason,
} from "@/features/scheduling/qualification";
import type {
  CompliancePriority,
  ComplianceWorkspace,
  ComplianceWorkspaceAssignment,
  ComplianceWorkspaceCredential,
  ComplianceWorkspaceItem,
  ComplianceWorkspaceRequirement,
  ComplianceWorkspaceSources,
} from "./contracts";

const priorities: readonly CompliancePriority[] = [
  "BLOCKING_ASSIGNMENT",
  "EXPIRED_OR_RESTRICTED",
  "MISSING_REQUIRED",
  "PENDING_VERIFICATION",
  "EXPIRING_SOON",
  "INFORMATIONAL",
];

function localDate(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function requirementApplies(
  requirement: ComplianceWorkspaceRequirement,
  assignment: ComplianceWorkspaceAssignment,
) {
  const start = localDate(assignment.startsAt, assignment.timezone);
  const end = localDate(assignment.endsAt, assignment.timezone);
  return (
    requirement.effectiveStart <= end &&
    (!requirement.effectiveEnd || requirement.effectiveEnd >= start)
  );
}

function displayJurisdiction(credential: ComplianceWorkspaceCredential) {
  const { kind, code } = credential.jurisdiction;
  return kind === "organization" ? "Organization-wide" : (code ?? kind);
}

function reasonLabel(reason: QualificationReason, name: string) {
  switch (reason) {
    case "MISSING":
      return `Required ${name} is missing.`;
    case "PENDING_VERIFICATION":
      return `${name} is awaiting verification.`;
    case "EXPIRED_BEFORE_START":
      return `${name} expires before the shift.`;
    case "EXPIRES_DURING_SHIFT":
      return `${name} expires during the shift.`;
    case "SUSPENDED":
      return `${name} is suspended.`;
    case "REVOKED":
      return `${name} is revoked.`;
    case "JURISDICTION_MISMATCH":
      return `${name} does not match the required jurisdiction.`;
  }
}

function expirationState(
  credential: ComplianceWorkspaceCredential,
  now: Date,
): { priority: CompliancePriority; actionStatus: string } | undefined {
  if (credential.state === "pending_verification")
    return {
      priority: "PENDING_VERIFICATION",
      actionStatus: `${credential.displayName} is awaiting verification.`,
    };
  if (credential.state === "suspended" || credential.state === "revoked")
    return {
      priority: "EXPIRED_OR_RESTRICTED",
      actionStatus: `${credential.displayName} is ${credential.state}.`,
    };
  if (credential.state === "expired")
    return {
      priority: "EXPIRED_OR_RESTRICTED",
      actionStatus: `${credential.displayName} is expired.`,
    };
  if (
    credential.state !== "verified" ||
    !credential.expiresOn ||
    !credential.jurisdiction.timezone
  )
    return undefined;
  const boundary = expirationBoundary(
    credential.expiresOn,
    credential.jurisdiction.timezone,
  );
  const remainingDays = Math.ceil(
    (boundary.valueOf() - now.valueOf()) / 86_400_000,
  );
  if (remainingDays <= 0)
    return {
      priority: "EXPIRED_OR_RESTRICTED",
      actionStatus: `${credential.displayName} is expired.`,
    };
  const window = [...credential.warningDays]
    .sort((a, b) => a - b)
    .find((days) => remainingDays <= days);
  if (window === undefined) return undefined;
  return {
    priority: "EXPIRING_SOON",
    actionStatus: `${credential.displayName} expires in ${remainingDays} day${remainingDays === 1 ? "" : "s"}.`,
  };
}

function key(employeeId: string, definitionId: string) {
  return `${employeeId}:${definitionId}`;
}

function compareItems(a: ComplianceWorkspaceItem, b: ComplianceWorkspaceItem) {
  const priority =
    priorities.indexOf(a.priority) - priorities.indexOf(b.priority);
  if (priority) return priority;
  const assignment = (a.assignment?.startsAt ?? "9999").localeCompare(
    b.assignment?.startsAt ?? "9999",
  );
  if (assignment) return assignment;
  const expiration = (a.expiresOn ?? "9999").localeCompare(
    b.expiresOn ?? "9999",
  );
  if (expiration) return expiration;
  return (
    a.employeeName.localeCompare(b.employeeName) ||
    a.credentialName.localeCompare(b.credentialName) ||
    a.id.localeCompare(b.id)
  );
}

/** Derived-only Operations presentation that reuses NX5.2 qualification results. */
export function buildComplianceWorkspace(
  sources: ComplianceWorkspaceSources,
  now = new Date(),
): ComplianceWorkspace {
  const items = new Map<string, ComplianceWorkspaceItem>();
  const credentialsByEmployee = new Map<
    string,
    ComplianceWorkspaceCredential[]
  >();
  for (const credential of sources.credentials) {
    const list = credentialsByEmployee.get(credential.employeeId) ?? [];
    list.push(credential);
    credentialsByEmployee.set(credential.employeeId, list);
    const state = expirationState(credential, now);
    if (state)
      items.set(key(credential.employeeId, credential.definitionId), {
        id: key(credential.employeeId, credential.definitionId),
        priority: state.priority,
        employeeId: credential.employeeId,
        employeeName: credential.employeeName,
        employeeNumber: credential.employeeNumber,
        branchId: credential.branchId,
        branchName: credential.branchName,
        definitionId: credential.definitionId,
        credentialName: credential.displayName,
        credentialState: credential.state,
        ...(credential.expiresOn ? { expiresOn: credential.expiresOn } : {}),
        jurisdiction: displayJurisdiction(credential),
        severity: "informational",
        actionStatus: state.actionStatus,
        href: `/operations/compliance?employee=${encodeURIComponent(credential.employeeId)}`,
      });
  }
  for (const assignment of sources.assignments) {
    const requirements = sources.requirements.filter(
      (requirement) =>
        requirement.postId === assignment.postId &&
        requirementApplies(requirement, assignment),
    );
    if (!requirements.length) continue;
    const conflicts = evaluateQualification({
      requirements,
      credentials: credentialsByEmployee.get(assignment.employeeId) ?? [],
      scheduledStart: assignment.startsAt,
      scheduledEnd: assignment.endsAt,
    });
    for (const conflict of conflicts) {
      const credential = (
        credentialsByEmployee.get(assignment.employeeId) ?? []
      ).find((value) => value.definitionId === conflict.definitionId);
      const itemKey = key(assignment.employeeId, conflict.definitionId);
      const existing = items.get(itemKey);
      const assignmentContext = {
        id: assignment.id,
        siteId: assignment.siteId,
        siteName: assignment.siteName,
        postId: assignment.postId,
        postName: assignment.postName,
        startsAt: assignment.startsAt,
        endsAt: assignment.endsAt,
        href: `/admin/scheduling?assignmentId=${encodeURIComponent(assignment.id)}`,
      };
      const priority = conflict.blocking
        ? "BLOCKING_ASSIGNMENT"
        : "INFORMATIONAL";
      const next: ComplianceWorkspaceItem = {
        id: itemKey,
        priority,
        employeeId: credential?.employeeId ?? assignment.employeeId,
        employeeName: credential?.employeeName ?? assignment.employeeName,
        employeeNumber: credential?.employeeNumber ?? assignment.employeeNumber,
        branchId: credential?.branchId ?? assignment.branchId,
        branchName: credential?.branchName ?? assignment.branchName,
        definitionId: conflict.definitionId,
        credentialName: conflict.displayName,
        ...(credential ? { credentialState: credential.state } : {}),
        ...(credential?.expiresOn ? { expiresOn: credential.expiresOn } : {}),
        ...(credential
          ? { jurisdiction: displayJurisdiction(credential) }
          : {}),
        reason: conflict.reason,
        severity: conflict.blocking ? "required" : "informational",
        actionStatus: `${reasonLabel(conflict.reason, conflict.displayName)} Blocks ${new Date(assignment.startsAt).toLocaleString()} shift.`,
        href: `/operations/compliance?employee=${encodeURIComponent(assignment.employeeId)}`,
        assignment: assignmentContext,
      };
      if (!existing || compareItems(next, existing) < 0)
        items.set(itemKey, next);
    }
  }
  const ordered = [...items.values()].sort(compareItems);
  const summary = Object.fromEntries(
    priorities.map((priority) => [
      priority,
      ordered.filter((item) => item.priority === priority).length,
    ]),
  ) as ComplianceWorkspace["summary"];
  return { items: ordered, summary };
}
