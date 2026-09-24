export const draftFamilies = [
  "SHIFT_ACTIVITY",
  "SECURITY_INCIDENT",
  "SHIFT_CLOSEOUT",
] as const;

export type DraftFamily = (typeof draftFamilies)[number];
export type DraftDisposition = "ACTIVE" | "SUBMITTED" | "DISCARDED" | "EXPIRED";

export type ReportingDraft = {
  id: string;
  shiftAssignmentId: string;
  family: DraftFamily;
  clientDraftKey: string;
  submissionKey: string;
  payload: Record<string, unknown>;
  revision: number;
  disposition: DraftDisposition;
  updatedAt: string;
  expiresAt: string;
  canonicalRecordId?: string;
};

export type SaveDraftInput = {
  shiftAssignmentId: unknown;
  family: unknown;
  clientDraftKey: unknown;
  submissionKey: unknown;
  saveKey: unknown;
  expectedRevision: unknown;
  payload: unknown;
};

export type DraftFinalization = {
  id: string;
  organizationId: string;
  ownerUserId: string;
  ownerEmployeeId: string;
  shiftAssignmentId: string;
  family: DraftFamily;
  revision: number;
  submissionKey: string;
};
