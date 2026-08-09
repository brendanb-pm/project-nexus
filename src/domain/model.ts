export const roles = [
  "GUARD",
  "SUPERVISOR",
  "OPERATIONS_MANAGER",
  "CLIENT_USER",
  "LEADERSHIP",
  "ADMIN",
] as const;
export type Role = (typeof roles)[number];

export const capabilities = [
  "VIEW_OWN_ASSIGNMENTS",
  "CLOCK_OWN_SHIFT",
  "CREATE_ACTIVITY_ENTRY",
  "CREATE_INCIDENT",
  "SUBMIT_HANDOFF",
  "VIEW_SITE_OPERATIONS",
  "MANAGE_SHIFT_ASSIGNMENTS",
  "ACKNOWLEDGE_INCIDENT",
  "APPROVE_TIME",
  "VIEW_EMPLOYEE_COMPLIANCE",
  "VIEW_CLIENT_REPORTS",
  "VIEW_CLIENT_INCIDENTS",
  "VIEW_ORGANIZATION_ANALYTICS",
  "VIEW_BILLING_DATA",
  "MANAGE_CLIENTS",
  "MANAGE_SITES",
  "MANAGE_POSTS",
  "MANAGE_EMPLOYEES",
  "MANAGE_ASSETS",
  "MANAGE_ROLES",
] as const;
export type Capability = (typeof capabilities)[number];

export const visibilityClassifications = [
  "INTERNAL",
  "SUPERVISOR",
  "CLIENT_VISIBLE",
  "EXECUTIVE",
  "RESTRICTED",
] as const;
export type VisibilityClassification =
  (typeof visibilityClassifications)[number];

export const serviceTypes = [
  "site_security",
  "armed_site_security",
  "access_control",
  "event_security",
  "fire_watch",
  "other_uniformed_service",
] as const;
export type ServiceType = (typeof serviceTypes)[number];

export const recordStatuses = [
  "DRAFT",
  "SUBMITTED",
  "ACKNOWLEDGED",
  "APPROVED",
  "AMENDED",
] as const;
export type RecordStatus = (typeof recordStatuses)[number];
