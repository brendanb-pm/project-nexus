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
