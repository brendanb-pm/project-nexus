import type { AuditContext } from "@/server/request/boundary";
import type { ShiftPage, ShiftStatus, ShiftSummary } from "./contracts";

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
};

export type ShiftMutation = {
  postId: string;
  timezone: string;
  scheduledStart: string;
  scheduledEnd: string;
  staffingRequirement: number;
  status: ShiftStatus;
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
}
