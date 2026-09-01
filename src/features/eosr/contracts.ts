export type EndOfShiftReport = {
  id: string;
  shiftAssignmentId: string;
  siteName: string;
  postName: string;
  summary: string;
  unresolvedIssues: readonly string[];
  equipmentAccessStatus: string;
  followUpItems: readonly string[];
  unusualConditions: string;
  submittedByUserId: string;
  submittedAt: string;
  acknowledgedByUserId?: string;
  acknowledgedAt?: string;
};

export type CreateEndOfShiftReportInput = {
  shiftAssignmentId: unknown;
  summary: unknown;
  unresolvedIssues?: unknown;
  equipmentAccessStatus?: unknown;
  followUpItems?: unknown;
  unusualConditions?: unknown;
  submissionKey: unknown;
};

export type IncomingPassdown = EndOfShiftReport & {
  incomingAssignmentId: string;
  dismissed: boolean;
};

export type ShiftCloseStatus = {
  shiftId: string;
  assignmentId: string;
  siteId: string;
  postId: string;
  scheduledEnd: string;
  clockOutComplete: boolean;
  eosrComplete: boolean;
  passdownState: "PRESENT" | "NOT_INCLUDED" | "NO_INCOMING_ASSIGNMENT";
  reviewState: "NOT_SUBMITTED" | "AWAITING_REVIEW" | "ACKNOWLEDGED";
};
