export const coverageWeekdays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
export type CoverageWeekday = (typeof coverageWeekdays)[number];

export type CoverageRequirementInput = {
  postId: unknown;
  requiredCount: unknown;
  weekdays: unknown;
  localStartTime: unknown;
  localEndTime: unknown;
  effectiveStart: unknown;
  effectiveEnd?: unknown;
};

export type CoverageRequirement = {
  id: string;
  postId: string;
  siteId: string;
  clientId: string;
  branchId: string;
  timezone: string;
  requiredCount: number;
  weekdays: readonly CoverageWeekday[];
  localStartTime: string;
  localEndTime: string;
  effectiveStart: string;
  effectiveEnd?: string;
  active: boolean;
  updatedAt: string;
};

export type CoverageGap = {
  requirementId: string;
  postId: string;
  startsAt: string;
  endsAt: string;
  requiredCount: number;
  scheduledCount: number;
  uncoveredCount: number;
};
