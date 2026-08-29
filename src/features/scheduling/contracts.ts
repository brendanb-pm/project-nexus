export const shiftStatuses = [
  "DRAFT",
  "PUBLISHED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type ShiftStatus = (typeof shiftStatuses)[number];

export type ShiftSummary = {
  id: string;
  organizationId: string;
  postId: string;
  siteId: string;
  clientId: string;
  branchId: string;
  postName: string;
  siteName: string;
  timezone: string;
  scheduledStart: string;
  scheduledEnd: string;
  staffingRequirement: number;
  assignedCount: number;
  status: ShiftStatus;
  updatedAt: string;
};

export type ShiftPage = {
  items: readonly ShiftSummary[];
  hasMore: boolean;
};

export type ShiftMutationInput = {
  postId: unknown;
  timezone: unknown;
  scheduledStart: unknown;
  scheduledEnd: unknown;
  staffingRequirement: unknown;
  status: unknown;
};

export type UpdateShiftInput = ShiftMutationInput & {
  shiftId: unknown;
  expectedUpdatedAt: unknown;
};

export const availabilityStatuses = ["AVAILABLE", "UNAVAILABLE"] as const;
export type AvailabilityStatus = (typeof availabilityStatuses)[number];
export type AvailabilitySummary = {
  id: string;
  employeeId: string;
  startsAt: string;
  endsAt: string;
  status: AvailabilityStatus;
  updatedAt: string;
};
export type AvailabilityMutationInput = {
  startsAt: unknown;
  endsAt: unknown;
  timezone: unknown;
  status: unknown;
};
export type AssignmentSummary = {
  id: string;
  organizationId: string;
  shiftId: string;
  employeeId: string;
  employeeNumber: string;
  shift: ShiftSummary;
  status: "assigned" | "confirmed" | "cancelled";
  availability: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
  warnings: readonly string[];
  assignedAt: string;
  updatedAt: string;
};
export type AssignmentMutationInput = {
  shiftId: unknown;
  employeeId: unknown;
};
