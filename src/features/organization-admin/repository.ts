import type { AuditContext } from "@/server/request/boundary";
import type {
  BranchCursor,
  BranchPage,
  BranchSummary,
  OrganizationStatus,
  OrganizationSummary,
} from "./contracts";

export const DEFAULT_BRANCH_PAGE_SIZE = 25;
export const MAX_BRANCH_PAGE_SIZE = 100;

export function boundedPageSize(requested?: number): number {
  if (!Number.isInteger(requested) || !requested || requested < 1) {
    return DEFAULT_BRANCH_PAGE_SIZE;
  }
  return Math.min(requested, MAX_BRANCH_PAGE_SIZE);
}

export type OrganizationMutation = {
  name: string;
  status: OrganizationStatus;
};

export type BranchMutation = OrganizationMutation & { timezone: string };

export interface OrganizationAdminRepository {
  getOrganization(organizationId: string): Promise<OrganizationSummary | null>;
  updateOrganization(
    organizationId: string,
    input: OrganizationMutation,
    expectedUpdatedAt: string,
    audit: AuditContext,
  ): Promise<OrganizationSummary | null>;
  listBranches(
    organizationId: string,
    options: { limit: number; cursor?: BranchCursor },
  ): Promise<BranchPage>;
  getBranch(
    organizationId: string,
    branchId: string,
  ): Promise<BranchSummary | null>;
  createBranch(
    organizationId: string,
    input: BranchMutation,
    audit: AuditContext,
  ): Promise<BranchSummary>;
  updateBranch(
    organizationId: string,
    branchId: string,
    input: BranchMutation,
    expectedUpdatedAt: string,
    audit: AuditContext,
  ): Promise<BranchSummary | null>;
}
