import type { ComplianceWorkspaceSources } from "./contracts";

export type ComplianceWorkspaceScope = {
  organizationId: string;
  organizationWide: boolean;
  branchIds: readonly string[];
  clientIds: readonly string[];
  siteIds: readonly string[];
};

export interface ComplianceWorkspaceRepository {
  load(
    scope: ComplianceWorkspaceScope,
    now: string,
  ): Promise<ComplianceWorkspaceSources>;
}
