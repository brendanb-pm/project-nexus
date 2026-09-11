export const assetTypes = [
  "vehicle",
  "radio",
  "keys",
  "medical_kit",
  "firearm",
  "equipment",
] as const;
export const assetStatuses = [
  "active",
  "inactive",
  "maintenance",
  "retired",
] as const;
export const assetConditions = [
  "good",
  "fair",
  "poor",
  "out_of_service",
] as const;
export type AssetType = (typeof assetTypes)[number];
export type AssetStatus = (typeof assetStatuses)[number];
export type AssetCondition = (typeof assetConditions)[number];
export type AssetSummary = {
  id: string;
  identifier: string;
  assetType: AssetType;
  status: AssetStatus;
  condition: AssetCondition;
  siteId?: string;
  siteName?: string;
  clientName?: string;
  inspectionDueOn?: string;
  expiresOn?: string;
  updatedAt: string;
};
export type AssetAuditEntry = {
  id: string;
  action: string;
  occurredAt: string;
  actor: string;
};
export type AssetDetail = {
  asset: AssetSummary;
  audit: readonly AssetAuditEntry[];
  custody: readonly AssetCustodyEvent[];
};
export type AssetCustodyEvent = {
  id: string;
  action: "CHECKOUT" | "CHECKIN" | "TRANSFER";
  occurredAt: string;
  fromEmployee?: string;
  fromSite?: string;
  toEmployee?: string;
  toSite?: string;
  actor: string;
  reason: string;
  condition?: AssetSummary["condition"];
};
export type AssetEmployee = {
  id: string;
  displayName: string;
  branchId: string;
};
export type AssetSite = {
  id: string;
  name: string;
  clientName: string;
  branchId: string;
};
export type CreateAssetInput = {
  identifier: unknown;
  assetType: unknown;
  status: unknown;
  condition: unknown;
  siteId: unknown;
  inspectionDueOn: unknown;
  expiresOn: unknown;
};
export type UpdateAssetInput = CreateAssetInput & {
  assetId: unknown;
  expectedUpdatedAt: unknown;
};
export type CustodyActionInput = {
  assetId: unknown;
  action: unknown;
  employeeId: unknown;
  siteId: unknown;
  reason: unknown;
  condition: unknown;
  expectedUpdatedAt: unknown;
};
export type AssetPageState =
  | { kind: "permission-denied"; message: string }
  | { kind: "error"; message: string; retryable: boolean }
  | {
      kind: "ready";
      assets: readonly AssetSummary[];
      sites: readonly AssetSite[];
      employees: readonly AssetEmployee[];
      detail?: AssetDetail;
      canManage: boolean;
    };
