import type { AuditContext } from "@/server/request/boundary";
import type { AssetDetail, AssetSite, AssetSummary } from "./contracts";
export type TrustedAssetScope = {
  organizationId: string;
  organizationWide: boolean;
  branchIds: readonly string[];
  clientIds: readonly string[];
  siteIds: readonly string[];
};
export type AssetMutation = {
  identifier: string;
  assetType: string;
  status: string;
  condition: string;
  siteId: string;
  inspectionDueOn?: string;
  expiresOn?: string;
};
export interface AssetRepository {
  list(scope: TrustedAssetScope): Promise<readonly AssetSummary[]>;
  listSites(scope: TrustedAssetScope): Promise<readonly AssetSite[]>;
  get(scope: TrustedAssetScope, id: string): Promise<AssetSummary | null>;
  detail(scope: TrustedAssetScope, id: string): Promise<AssetDetail | null>;
  create(
    scope: TrustedAssetScope,
    input: AssetMutation,
    audit: AuditContext,
  ): Promise<AssetSummary>;
  update(
    scope: TrustedAssetScope,
    id: string,
    input: AssetMutation,
    expected: string,
    audit: AuditContext,
  ): Promise<AssetSummary | null>;
}
