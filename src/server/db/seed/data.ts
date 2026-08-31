const uuid = (value: number) =>
  `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;

export const seedData = {
  organizations: [
    { id: uuid(1), name: "Northstar Protective Services", status: "active" },
    { id: uuid(2), name: "Beacon Security Cooperative", status: "active" },
  ],
  branches: [
    {
      id: uuid(10),
      organizationId: uuid(1),
      name: "Northstar Central",
      timezone: "America/Los_Angeles",
      status: "active",
    },
    {
      id: uuid(11),
      organizationId: uuid(2),
      name: "Beacon Central",
      timezone: "America/Denver",
      status: "active",
    },
  ],
  clients: [
    {
      id: uuid(20),
      organizationId: uuid(1),
      branchId: uuid(10),
      name: "Cedar Plaza",
      status: "active",
    },
    {
      id: uuid(21),
      organizationId: uuid(1),
      branchId: uuid(10),
      name: "Harbor Works",
      status: "active",
    },
  ],
  sites: [
    {
      id: uuid(30),
      clientId: uuid(20),
      name: "Cedar Plaza North",
      timezone: "America/Los_Angeles",
    },
    {
      id: uuid(31),
      clientId: uuid(20),
      name: "Cedar Plaza South",
      timezone: "America/Los_Angeles",
    },
    {
      id: uuid(32),
      clientId: uuid(21),
      name: "Harbor Works Campus",
      timezone: "America/Los_Angeles",
    },
  ],
  posts: [
    {
      id: uuid(40),
      siteId: uuid(30),
      name: "North Lobby",
      serviceType: "access_control",
    },
    {
      id: uuid(41),
      siteId: uuid(31),
      name: "Receiving Gate",
      serviceType: "site_security",
    },
    {
      id: uuid(42),
      siteId: uuid(32),
      name: "Fire Watch",
      serviceType: "fire_watch",
    },
  ],
  users: [
    {
      id: uuid(50),
      organizationId: uuid(1),
      email: "alex.guard@example.invalid",
      status: "active",
    },
    {
      id: uuid(51),
      organizationId: uuid(1),
      email: "sam.guard@example.invalid",
      status: "active",
    },
    {
      id: uuid(52),
      organizationId: uuid(1),
      email: "riley.ops@example.invalid",
      status: "active",
    },
    {
      id: uuid(53),
      organizationId: uuid(1),
      email: "casey.client@example.invalid",
      status: "active",
    },
    {
      id: uuid(54),
      organizationId: uuid(2),
      email: "jordan.guard@example.invalid",
      status: "active",
    },
  ],
  externalIdentities: [
    {
      id: uuid(55),
      issuer: "https://identity.example.invalid",
      subject: "fictional-alex-guard",
      userId: uuid(50),
    },
    {
      id: uuid(56),
      issuer: "https://identity.example.invalid",
      subject: "fictional-riley-ops",
      userId: uuid(52),
    },
  ],
  userMemberships: [
    {
      id: uuid(57),
      userId: uuid(50),
      organizationId: uuid(1),
      status: "active",
    },
    {
      id: uuid(58),
      userId: uuid(52),
      organizationId: uuid(1),
      status: "active",
    },
  ],
  employees: [
    {
      id: uuid(60),
      organizationId: uuid(1),
      userId: uuid(50),
      primaryBranchId: uuid(10),
      employeeNumber: "NPS-100",
    },
    {
      id: uuid(61),
      organizationId: uuid(1),
      userId: uuid(51),
      primaryBranchId: uuid(10),
      employeeNumber: "NPS-101",
    },
    {
      id: uuid(62),
      organizationId: uuid(1),
      userId: uuid(52),
      primaryBranchId: uuid(10),
      employeeNumber: "NPS-200",
    },
    {
      id: uuid(63),
      organizationId: uuid(2),
      userId: uuid(54),
      primaryBranchId: uuid(11),
      employeeNumber: "BSC-100",
    },
  ],
  employeeRoles: [
    {
      employeeId: uuid(60),
      role: "GUARD",
      branchId: uuid(10),
      siteId: uuid(30),
    },
    {
      employeeId: uuid(61),
      role: "GUARD",
      branchId: uuid(10),
      siteId: uuid(31),
    },
    { employeeId: uuid(62), role: "OPERATIONS_MANAGER", branchId: uuid(10) },
  ],
  credentials: [
    {
      id: uuid(70),
      employeeId: uuid(60),
      type: "guard_card",
      status: "active",
    },
  ],
  certifications: [
    { id: uuid(71), employeeId: uuid(61), type: "first_aid", status: "active" },
  ],
  shifts: [
    {
      id: uuid(80),
      postId: uuid(40),
      scheduledStart: "2026-08-31T15:00:00.000Z",
      scheduledEnd: "2026-08-31T23:00:00.000Z",
    },
    {
      id: uuid(81),
      postId: uuid(41),
      scheduledStart: "2026-08-31T23:00:00.000Z",
      scheduledEnd: "2026-09-01T07:00:00.000Z",
    },
    {
      id: uuid(82),
      postId: uuid(42),
      scheduledStart: "2026-09-01T07:00:00.000Z",
      scheduledEnd: "2026-09-01T15:00:00.000Z",
    },
  ],
  shiftAssignments: [
    {
      id: uuid(90),
      shiftId: uuid(80),
      employeeId: uuid(60),
      status: "assigned",
    },
    {
      id: uuid(91),
      shiftId: uuid(81),
      employeeId: uuid(61),
      status: "assigned",
    },
    {
      id: uuid(92),
      shiftId: uuid(82),
      employeeId: uuid(60),
      status: "assigned",
    },
  ],
  activityEntries: [
    {
      id: uuid(100),
      shiftAssignmentId: uuid(90),
      category: "observation",
      visibility: "CLIENT_VISIBLE",
    },
  ],
  incidentReports: [
    {
      id: uuid(101),
      siteId: uuid(30),
      shiftAssignmentId: uuid(90),
      incidentNumber: "CEDAR-2026-001",
      visibility: "INTERNAL",
    },
  ],
  assets: [
    {
      id: uuid(110),
      organizationId: uuid(1),
      identifier: "RADIO-001",
      assetType: "radio",
      assignedSiteId: uuid(30),
    },
    {
      id: uuid(111),
      organizationId: uuid(1),
      identifier: "KEYSET-001",
      assetType: "keys",
      assignedEmployeeId: uuid(60),
    },
  ],
} as const;

export type SeedData = typeof seedData;
