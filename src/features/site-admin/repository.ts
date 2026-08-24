import type { AuditContext } from "@/server/request/boundary";
import type {
  ArmedRequirement,
  ClientOption,
  PostSummary,
  SiteDetail,
  SitePage,
  SiteSummary,
} from "./contracts";
import type { LifecycleStatus } from "@/features/client-admin/contracts";
import type { ServiceType } from "@/domain/model";
export const SITE_PAGE_SIZE = 25;
export const POST_LIMIT = 100;
export type TrustedSiteScope = {
  organizationId: string;
  organizationWide: boolean;
  branchIds: readonly string[];
  clientIds: readonly string[];
  siteIds: readonly string[];
};
export type SiteMutation = {
  clientId: string;
  name: string;
  address: {
    line1: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
  };
  timezone: string;
  latitude?: number;
  longitude?: number;
  geofenceRadiusMeters?: number;
  status: LifecycleStatus;
};
export type PostMutation = {
  siteId: string;
  name: string;
  description: string;
  serviceType: ServiceType;
  armedRequirement: ArmedRequirement;
  qualificationRequirements: readonly string[];
  status: LifecycleStatus;
};
export interface SiteAdminRepository {
  listClients(scope: TrustedSiteScope): Promise<readonly ClientOption[]>;
  getClient(
    scope: TrustedSiteScope,
    clientId: string,
  ): Promise<ClientOption | null>;
  listSites(scope: TrustedSiteScope, limit: number): Promise<SitePage>;
  getSite(scope: TrustedSiteScope, siteId: string): Promise<SiteSummary | null>;
  getSiteDetail(
    scope: TrustedSiteScope,
    siteId: string,
  ): Promise<SiteDetail | null>;
  createSite(
    scope: TrustedSiteScope,
    input: SiteMutation,
    audit: AuditContext,
  ): Promise<SiteSummary>;
  updateSite(
    scope: TrustedSiteScope,
    siteId: string,
    input: SiteMutation,
    expected: string,
    audit: AuditContext,
  ): Promise<SiteSummary | null>;
  createPost(
    scope: TrustedSiteScope,
    input: PostMutation,
    audit: AuditContext,
  ): Promise<PostSummary>;
  updatePost(
    scope: TrustedSiteScope,
    postId: string,
    input: PostMutation,
    expected: string,
    audit: AuditContext,
  ): Promise<PostSummary | null>;
}
