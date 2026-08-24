import type { ServiceType } from "@/domain/model";
import type { LifecycleStatus } from "@/features/client-admin/contracts";
export const armedRequirements = ["unarmed", "armed", "either"] as const;
export type ArmedRequirement = (typeof armedRequirements)[number];
export type ClientOption = {
  id: string;
  branchId: string;
  name: string;
  branchName: string;
};
export type SiteSummary = {
  id: string;
  clientId: string;
  branchId: string;
  clientName: string;
  name: string;
  addressLine1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  timezone: string;
  latitude?: number;
  longitude?: number;
  geofenceRadiusMeters?: number;
  status: LifecycleStatus;
  updatedAt: string;
};
export type PostSummary = {
  id: string;
  siteId: string;
  name: string;
  description: string;
  serviceType: ServiceType;
  armedRequirement: ArmedRequirement;
  qualificationRequirements: readonly string[];
  status: LifecycleStatus;
  updatedAt: string;
};
export type SitePage = { items: readonly SiteSummary[]; hasMore: boolean };
export type SiteDetail = { site: SiteSummary; posts: readonly PostSummary[] };
export type CreateSiteInput = {
  clientId: unknown;
  name: unknown;
  addressLine1: unknown;
  city: unknown;
  region: unknown;
  postalCode: unknown;
  country: unknown;
  timezone: unknown;
  latitude: unknown;
  longitude: unknown;
  geofenceRadiusMeters: unknown;
  status: unknown;
};
export type UpdateSiteInput = CreateSiteInput & {
  siteId: unknown;
  expectedUpdatedAt: unknown;
};
export type CreatePostInput = {
  siteId: unknown;
  name: unknown;
  description: unknown;
  serviceType: unknown;
  armedRequirement: unknown;
  qualificationRequirements: unknown;
  status: unknown;
};
export type UpdatePostInput = CreatePostInput & {
  postId: unknown;
  expectedUpdatedAt: unknown;
};
export type SiteAdminPageState =
  | { kind: "loading" }
  | { kind: "permission-denied"; message: string }
  | { kind: "error"; message: string; retryable: boolean }
  | {
      kind: "ready";
      canManageSites: boolean;
      canManagePosts: boolean;
      clients: readonly ClientOption[];
      sites: SitePage;
      detail?: SiteDetail;
    };
