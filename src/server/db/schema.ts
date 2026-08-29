import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  recordStatuses,
  roles,
  serviceTypes,
  visibilityClassifications,
} from "@/domain/model";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const roleEnum = pgEnum("role", roles);
export const visibilityEnum = pgEnum(
  "visibility_classification",
  visibilityClassifications,
);
export const serviceTypeEnum = pgEnum("service_type", serviceTypes);
export const recordStatusEnum = pgEnum("record_status", recordStatuses);

// Better Auth owns authentication/session state only. Nexus users and
// memberships below remain the authorization source of truth.
export const authUsers = pgTable("auth_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("auth_sessions_user_idx").on(t.userId)],
);
export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("auth_accounts_issuer_subject_uidx").on(t.issuer, t.accountId),
    index("auth_accounts_user_idx").on(t.userId),
  ],
);
export const authVerifications = pgTable(
  "auth_verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("auth_verifications_identifier_idx").on(t.identifier)],
);

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const branches = pgTable(
  "branches",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    timezone: text("timezone").notNull(),
    status: text("status").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("branches_org_idx").on(t.organizationId)],
);
export const clients = pgTable(
  "clients",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    branchId: uuid("branch_id").references(() => branches.id),
    name: text("name").notNull(),
    status: text("status").notNull(),
    billingConfig: jsonb("billing_config").notNull().default({}),
    reportingConfig: jsonb("reporting_config").notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("clients_org_idx").on(t.organizationId),
    index("clients_branch_idx").on(t.branchId),
  ],
);
export const clientContacts = pgTable(
  "client_contacts",
  {
    id: id(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("client_contacts_client_idx").on(t.clientId),
    check(
      "client_contacts_status_check",
      sql`${t.status} in ('active', 'inactive')`,
    ),
  ],
);
export const contracts = pgTable(
  "contracts",
  {
    id: id(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    name: text("name").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on"),
    status: text("status").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("contracts_client_start_idx").on(t.clientId, t.startsOn),
    check(
      "contracts_status_check",
      sql`${t.status} in ('draft', 'active', 'expired', 'terminated')`,
    ),
    check(
      "contracts_date_order_check",
      sql`${t.endsOn} is null or ${t.endsOn} >= ${t.startsOn}`,
    ),
  ],
);
export const sites = pgTable(
  "sites",
  {
    id: id(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    name: text("name").notNull(),
    address: jsonb("address").notNull(),
    timezone: text("timezone").notNull(),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    geofenceConfig: jsonb("geofence_config").notNull().default({}),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("sites_client_name_idx").on(t.clientId, t.name, t.id)],
);
export const posts = pgTable(
  "posts",
  {
    id: id(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    name: text("name").notNull(),
    description: text("description").notNull(),
    serviceType: serviceTypeEnum("service_type").notNull(),
    armedRequirement: text("armed_requirement").notNull(),
    qualificationRequirements: jsonb("qualification_requirements")
      .notNull()
      .default([]),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("posts_site_name_idx").on(t.siteId, t.name, t.id)],
);

export const users = pgTable(
  "users",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    email: text("email").notNull(),
    status: text("status").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_org_email_uidx").on(t.organizationId, t.email)],
);
export const externalIdentities = pgTable(
  "external_identities",
  {
    id: id(),
    issuer: text("issuer").notNull(),
    subject: text("subject").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("external_identities_issuer_subject_uidx").on(
      t.issuer,
      t.subject,
    ),
    index("external_identities_user_idx").on(t.userId),
  ],
);
export const userMemberships = pgTable(
  "user_memberships",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    status: text("status").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("user_memberships_user_org_uidx").on(
      t.userId,
      t.organizationId,
    ),
    index("user_memberships_org_idx").on(t.organizationId),
  ],
);
export const employees = pgTable(
  "employees",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id").references(() => users.id),
    employeeNumber: text("employee_number").notNull(),
    employmentStatus: text("employment_status").notNull(),
    primaryBranchId: uuid("primary_branch_id")
      .notNull()
      .references(() => branches.id),
    profile: jsonb("profile").notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("employees_org_number_uidx").on(
      t.organizationId,
      t.employeeNumber,
    ),
    uniqueIndex("employees_user_uidx").on(t.userId),
  ],
);
export const employeeRoles = pgTable(
  "employee_roles",
  {
    id: id(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    role: roleEnum("role").notNull(),
    branchId: uuid("branch_id").references(() => branches.id),
    clientId: uuid("client_id").references(() => clients.id),
    siteId: uuid("site_id").references(() => sites.id),
    createdAt: createdAt(),
  },
  (t) => [index("employee_roles_employee_idx").on(t.employeeId)],
);
export const credentials = pgTable(
  "credentials",
  {
    id: id(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    type: text("type").notNull(),
    identifier: text("identifier"),
    issuingAuthority: text("issuing_authority").notNull(),
    issuedOn: date("issued_on").notNull(),
    expiresOn: date("expires_on"),
    status: text("status").notNull(),
    documentReference: text("document_reference"),
    predecessorId: uuid("predecessor_id"),
    verifiedByUserId: uuid("verified_by_user_id").references(() => users.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("credentials_employee_type_idx").on(
      t.employeeId,
      t.type,
      t.expiresOn,
    ),
    check(
      "credentials_status_check",
      sql`${t.status} in ('active', 'expired', 'suspended', 'revoked', 'pending_verification')`,
    ),
    check(
      "credentials_date_order_check",
      sql`${t.expiresOn} is null or ${t.expiresOn} >= ${t.issuedOn}`,
    ),
  ],
);
export const certifications = pgTable(
  "certifications",
  {
    id: id(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    type: text("type").notNull(),
    issuingAuthority: text("issuing_authority").notNull(),
    issuedOn: date("issued_on").notNull(),
    expiresOn: date("expires_on"),
    status: text("status").notNull(),
    documentReference: text("document_reference"),
    predecessorId: uuid("predecessor_id"),
    verifiedByUserId: uuid("verified_by_user_id").references(() => users.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("certifications_employee_type_idx").on(
      t.employeeId,
      t.type,
      t.expiresOn,
    ),
    check(
      "certifications_status_check",
      sql`${t.status} in ('active', 'expired', 'suspended', 'revoked', 'pending_verification')`,
    ),
    check(
      "certifications_date_order_check",
      sql`${t.expiresOn} is null or ${t.expiresOn} >= ${t.issuedOn}`,
    ),
  ],
);
export const availability = pgTable(
  "availability",
  {
    id: id(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("availability_employee_start_idx").on(t.employeeId, t.startsAt),
    check("availability_time_order_check", sql`${t.endsAt} > ${t.startsAt}`),
    check(
      "availability_status_check",
      sql`${t.status} in ('AVAILABLE', 'UNAVAILABLE')`,
    ),
  ],
);

export const shifts = pgTable(
  "shifts",
  {
    id: id(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id),
    scheduledStart: timestamp("scheduled_start", {
      withTimezone: true,
    }).notNull(),
    scheduledEnd: timestamp("scheduled_end", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull(),
    status: text("status").notNull(),
    staffingRequirement: integer("staffing_requirement").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("shifts_post_start_idx").on(t.postId, t.scheduledStart),
    check(
      "shifts_time_order_check",
      sql`${t.scheduledEnd} > ${t.scheduledStart}`,
    ),
    check(
      "shifts_staffing_check",
      sql`${t.staffingRequirement} between 1 and 100`,
    ),
    check(
      "shifts_status_check",
      sql`${t.status} in ('DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED')`,
    ),
  ],
);
export const shiftAssignments = pgTable(
  "shift_assignments",
  {
    id: id(),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    status: text("status").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull(),
    availabilityStatus: text("availability_status")
      .notNull()
      .default("UNKNOWN"),
    warnings: jsonb("warnings").notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("shift_assignments_shift_employee_uidx").on(
      t.shiftId,
      t.employeeId,
    ),
    index("shift_assignments_employee_idx").on(t.employeeId, t.status),
    check(
      "shift_assignments_status_check",
      sql`${t.status} in ('assigned', 'confirmed', 'cancelled')`,
    ),
    check(
      "shift_assignments_availability_check",
      sql`${t.availabilityStatus} in ('AVAILABLE', 'UNAVAILABLE', 'UNKNOWN')`,
    ),
  ],
);
export const clockEvents = pgTable(
  "clock_events",
  {
    id: id(),
    shiftAssignmentId: uuid("shift_assignment_id")
      .notNull()
      .references(() => shiftAssignments.id),
    eventType: text("event_type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    recordedByUserId: uuid("recorded_by_user_id")
      .notNull()
      .references(() => users.id),
    geolocation: jsonb("geolocation"),
    verificationStatus: text("verification_status").notNull(),
    exceptionReason: text("exception_reason"),
    exceptionReasons: jsonb("exception_reasons").notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [
    index("clock_events_assignment_time_idx").on(
      t.shiftAssignmentId,
      t.occurredAt,
    ),
    check(
      "clock_events_type_check",
      sql`${t.eventType} in ('CLOCK_IN', 'CLOCK_OUT')`,
    ),
    check(
      "clock_events_verification_check",
      sql`${t.verificationStatus} in ('NORMAL', 'EXCEPTION_REQUIRED')`,
    ),
  ],
);
export const clockEventCorrections = pgTable(
  "clock_event_corrections",
  {
    id: id(),
    clockEventId: uuid("clock_event_id")
      .notNull()
      .references(() => clockEvents.id),
    revision: integer("revision").notNull(),
    originalEffectiveAt: timestamp("original_effective_at", {
      withTimezone: true,
    }).notNull(),
    correctedEffectiveAt: timestamp("corrected_effective_at", {
      withTimezone: true,
    }).notNull(),
    correctedByUserId: uuid("corrected_by_user_id")
      .notNull()
      .references(() => users.id),
    correctedAt: timestamp("corrected_at", { withTimezone: true }).notNull(),
    reason: text("reason").notNull(),
  },
  (t) => [
    uniqueIndex("clock_event_corrections_revision_uidx").on(
      t.clockEventId,
      t.revision,
    ),
    check("clock_event_corrections_revision_check", sql`${t.revision} > 0`),
    check(
      "clock_event_corrections_reason_check",
      sql`length(trim(${t.reason})) > 0`,
    ),
  ],
);
export const timeRecords = pgTable("time_records", {
  id: id(),
  shiftAssignmentId: uuid("shift_assignment_id")
    .notNull()
    .references(() => shiftAssignments.id),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  minutesWorked: integer("minutes_worked"),
  status: recordStatusEnum("status").notNull().default("DRAFT"),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const activityEntries = pgTable("activity_entries", {
  id: id(),
  shiftAssignmentId: uuid("shift_assignment_id")
    .notNull()
    .references(() => shiftAssignments.id),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  category: text("category").notNull(),
  postId: uuid("post_id").references(() => posts.id),
  description: jsonb("description").notNull(),
  actionTaken: text("action_taken"),
  followUpRequired: boolean("follow_up_required").notNull().default(false),
  incidentRelated: boolean("incident_related").notNull().default(false),
  visibility: visibilityEnum("visibility").notNull().default("INTERNAL"),
  status: recordStatusEnum("status").notNull().default("DRAFT"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const dailyActivityReports = pgTable("daily_activity_reports", {
  id: id(),
  shiftAssignmentId: uuid("shift_assignment_id")
    .notNull()
    .references(() => shiftAssignments.id),
  reportDate: date("report_date").notNull(),
  summary: text("summary").notNull(),
  visibility: visibilityEnum("visibility").notNull().default("INTERNAL"),
  status: recordStatusEnum("status").notNull().default("DRAFT"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const incidentReports = pgTable(
  "incident_reports",
  {
    id: id(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id),
    shiftAssignmentId: uuid("shift_assignment_id").references(
      () => shiftAssignments.id,
    ),
    incidentNumber: text("incident_number").notNull(),
    classification: text("classification").notNull(),
    severity: text("severity").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    narrative: text("narrative").notNull(),
    actionsTaken: text("actions_taken").notNull(),
    emergencyServiceInvolvement: boolean("emergency_service_involvement")
      .notNull()
      .default(false),
    externalReportNumber: text("external_report_number"),
    status: recordStatusEnum("status").notNull().default("DRAFT"),
    acknowledgedByUserId: uuid("acknowledged_by_user_id").references(
      () => users.id,
    ),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    visibility: visibilityEnum("visibility").notNull().default("INTERNAL"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("incident_reports_site_number_uidx").on(
      t.siteId,
      t.incidentNumber,
    ),
  ],
);
export const incidentParticipants = pgTable("incident_participants", {
  id: id(),
  incidentReportId: uuid("incident_report_id")
    .notNull()
    .references(() => incidentReports.id),
  participantType: text("participant_type").notNull(),
  employeeId: uuid("employee_id").references(() => employees.id),
  name: text("name"),
  details: jsonb("details").notNull().default({}),
  createdAt: createdAt(),
});
export const incidentAttachments = pgTable("incident_attachments", {
  id: id(),
  incidentReportId: uuid("incident_report_id")
    .notNull()
    .references(() => incidentReports.id),
  storageReference: text("storage_reference").notNull(),
  mediaType: text("media_type").notNull(),
  uploadedByUserId: uuid("uploaded_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
});
export const handoffs = pgTable("handoffs", {
  id: id(),
  shiftAssignmentId: uuid("shift_assignment_id")
    .notNull()
    .references(() => shiftAssignments.id),
  unresolvedIssues: jsonb("unresolved_issues").notNull().default([]),
  equipmentKeyStatus: jsonb("equipment_key_status").notNull().default({}),
  followUpItems: jsonb("follow_up_items").notNull().default([]),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  status: recordStatusEnum("status").notNull().default("DRAFT"),
  visibility: visibilityEnum("visibility").notNull().default("INTERNAL"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assets = pgTable(
  "assets",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    assetType: text("asset_type").notNull(),
    identifier: text("identifier").notNull(),
    status: text("status").notNull(),
    condition: text("condition").notNull(),
    assignedSiteId: uuid("assigned_site_id").references(() => sites.id),
    assignedEmployeeId: uuid("assigned_employee_id").references(
      () => employees.id,
    ),
    inspectionDueOn: date("inspection_due_on"),
    expiresOn: date("expires_on"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("assets_org_identifier_uidx").on(
      t.organizationId,
      t.identifier,
    ),
  ],
);
export const assetAssignments = pgTable("asset_assignments", {
  id: id(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id),
  siteId: uuid("site_id").references(() => sites.id),
  employeeId: uuid("employee_id").references(() => employees.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull(),
  returnedAt: timestamp("returned_at", { withTimezone: true }),
  createdAt: createdAt(),
});
export const assetCheckoutEvents = pgTable("asset_checkout_events", {
  id: id(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id),
  employeeId: uuid("employee_id").references(() => employees.id),
  siteId: uuid("site_id").references(() => sites.id),
  eventType: text("event_type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  condition: text("condition"),
  actorUserId: uuid("actor_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
});

export const billingRates = pgTable("billing_rates", {
  id: id(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  postId: uuid("post_id").references(() => posts.id),
  serviceType: serviceTypeEnum("service_type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const billingPeriods = pgTable("billing_periods", {
  id: id(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  status: text("status").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const billableTimeRecords = pgTable(
  "billable_time_records",
  {
    id: id(),
    billingPeriodId: uuid("billing_period_id")
      .notNull()
      .references(() => billingPeriods.id),
    timeRecordId: uuid("time_record_id")
      .notNull()
      .references(() => timeRecords.id),
    billingRateId: uuid("billing_rate_id")
      .notNull()
      .references(() => billingRates.id),
    billableMinutes: integer("billable_minutes").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("billable_time_record_uidx").on(
      t.billingPeriodId,
      t.timeRecordId,
    ),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    requestId: text("request_id"),
    sessionId: text("session_id"),
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),
    reason: text("reason"),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [
    index("audit_events_org_entity_idx").on(
      t.organizationId,
      t.entityType,
      t.entityId,
    ),
    index("audit_events_occurred_idx").on(t.occurredAt),
  ],
);
export const operationalRecordRevisions = pgTable(
  "operational_record_revisions",
  {
    id: id(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    revision: integer("revision").notNull(),
    status: recordStatusEnum("status").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    changedByUserId: uuid("changed_by_user_id")
      .notNull()
      .references(() => users.id),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull(),
    reason: text("reason"),
    auditEventId: uuid("audit_event_id")
      .notNull()
      .references(() => auditEvents.id),
  },
  (t) => [
    uniqueIndex("operational_record_revision_uidx").on(
      t.entityType,
      t.entityId,
      t.revision,
    ),
  ],
);
