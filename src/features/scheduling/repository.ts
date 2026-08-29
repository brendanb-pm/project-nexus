import type { AuditContext } from "@/server/request/boundary";
import type { ComplianceSummary } from "@/features/compliance-admin/contracts";
import type {
  AssignmentSummary,
  AvailabilityStatus,
  AvailabilitySummary,
  ShiftPage,
  ShiftStatus,
  ShiftSummary,
} from "./contracts";

export type SchedulingScope = {
  organizationId: string;
  organizationWide: boolean;
  branchIds: readonly string[];
  clientIds: readonly string[];
  siteIds: readonly string[];
};

export type PostSchedulingScope = {
  organizationId: string;
  branchId: string;
  clientId: string;
  siteId: string;
  postId: string;
  timezone: string;
  armedRequirement: "armed" | "unarmed" | "either";
  qualificationRequirements: readonly string[];
};

export type ShiftMutation = {
  postId: string;
  timezone: string;
  scheduledStart: string;
  scheduledEnd: string;
  staffingRequirement: number;
  status: ShiftStatus;
};

export type AssignmentCandidate = {
  organizationId: string;
  employeeId: string;
  employeeNumber: string;
  employeeStatus: "active" | "inactive";
  credentials: readonly ComplianceSummary[];
  certifications: readonly ComplianceSummary[];
  availability: readonly AvailabilitySummary[];
};

export interface SchedulingRepository {
  getPostScope(
    scope: SchedulingScope,
    postId: string,
  ): Promise<PostSchedulingScope | null>;
  listShifts(scope: SchedulingScope, limit: number): Promise<ShiftPage>;
  getShift(
    scope: SchedulingScope,
    shiftId: string,
  ): Promise<ShiftSummary | null>;
  countActiveAssignments(
    scope: SchedulingScope,
    shiftId: string,
  ): Promise<number>;
  createShift(
    scope: SchedulingScope,
    input: ShiftMutation,
    audit: AuditContext,
  ): Promise<ShiftSummary>;
  updateShift(
    scope: SchedulingScope,
    shiftId: string,
    input: ShiftMutation,
    expectedUpdatedAt: string,
    audit: AuditContext,
  ): Promise<ShiftSummary | null>;
  listAvailability(
    scope: SchedulingScope,
    employeeId: string,
    limit: number,
  ): Promise<readonly AvailabilitySummary[]>;
  createAvailability(
    scope: SchedulingScope,
    employeeId: string,
    input: { startsAt: string; endsAt: string; status: AvailabilityStatus },
    audit: AuditContext,
  ): Promise<AvailabilitySummary>;
  getAssignmentCandidate(
    scope: SchedulingScope,
    employeeId: string,
  ): Promise<AssignmentCandidate | null>;
  hasOverlappingAssignment(
    scope: SchedulingScope,
    employeeId: string,
    startsAt: string,
    endsAt: string,
  ): Promise<boolean>;
  createAssignment(
    scope: SchedulingScope,
    shiftId: string,
    employeeId: string,
    availability: AssignmentSummary["availability"],
    warnings: readonly string[],
    audit: AuditContext,
  ): Promise<AssignmentSummary>;
  listAssignments(
    scope: SchedulingScope,
    limit: number,
  ): Promise<readonly AssignmentSummary[]>;
}
