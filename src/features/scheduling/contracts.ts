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
  siteAddress?: string;
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

export type ClockEventType = "CLOCK_IN" | "CLOCK_OUT";
export type ClockVerificationStatus = "NORMAL" | "EXCEPTION_REQUIRED";
export type ClockEventSummary = {
  id: string;
  shiftAssignmentId: string;
  eventType: ClockEventType;
  occurredAt: string;
  effectiveAt: string;
  verificationStatus: ClockVerificationStatus;
  exceptionReasons: readonly string[];
  locationEvidence?: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    distanceMeters?: number;
  };
  recordedByUserId: string;
};
export type ClockEventInput = {
  shiftAssignmentId: unknown;
  eventType: unknown;
  latitude?: unknown;
  longitude?: unknown;
  accuracyMeters?: unknown;
};

export type ClockCorrectionSummary = {
  id: string;
  clockEventId: string;
  revision: number;
  originalEffectiveAt: string;
  correctedEffectiveAt: string;
  correctedByUserId: string;
  correctedAt: string;
  reason: string;
};
export type ClockCorrectionInput = {
  clockEventId: unknown;
  correctedEffectiveAt: unknown;
  timezone: unknown;
  reason: unknown;
  expectedRevision: unknown;
};

export type TimePair = {
  clockInEventId: string;
  clockOutEventId: string;
  startsAt: string;
  endsAt: string;
  secondsWorked: number;
};
export type TimeRecordSummary = {
  id: string;
  shiftAssignmentId: string;
  revision: number;
  pairs: readonly TimePair[];
  secondsWorked: number;
  status: "DRAFT" | "APPROVED" | "AMENDED";
  approvedByUserId?: string;
  approvedAt?: string;
  updatedAt: string;
};
export type ApproveTimeInput = {
  shiftAssignmentId: unknown;
  expectedRevision: unknown;
};

export type SchedulingPostOption = {
  id: string;
  name: string;
  siteName: string;
  timezone: string;
};
export type SchedulingEmployeeOption = {
  id: string;
  employeeNumber: string;
  displayName: string;
};
export type SchedulingAdminPageState =
  | { kind: "permission-denied"; message: string }
  | { kind: "error"; message: string; retryable: boolean }
  | {
      kind: "ready";
      shifts: ShiftPage;
      assignments: readonly AssignmentSummary[];
      posts: readonly SchedulingPostOption[];
      employees: readonly SchedulingEmployeeOption[];
    };
export type MySchedulePageState =
  | { kind: "permission-denied"; message: string }
  | { kind: "error"; message: string; retryable: boolean }
  | {
      kind: "ready";
      assignments: readonly AssignmentSummary[];
      availability: readonly AvailabilitySummary[];
      clockStates?: Readonly<Record<string, "CLOCK_IN" | "CLOCK_OUT">>;
      clockEvents?: Readonly<Record<string, readonly ClockEventSummary[]>>;
    };
