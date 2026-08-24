import { pathToFileURL } from "node:url";
import { seedData, type SeedData } from "./data";

export function validateSeedData(data: SeedData): string[] {
  const errors: string[] = [];
  const ids = <T extends readonly { id: string }[]>(rows: T) =>
    new Set(rows.map((row) => row.id));
  const organizationIds = ids(data.organizations);
  const branchIds = ids(data.branches);
  const clientIds = ids(data.clients);
  const siteIds = ids(data.sites);
  const postIds = ids(data.posts);
  const userIds = ids(data.users);
  const employeeIds = ids(data.employees);
  const shiftIds = ids(data.shifts);
  const assignmentIds = ids(data.shiftAssignments);

  for (const row of data.branches)
    if (!organizationIds.has(row.organizationId))
      errors.push(`branch ${row.id} has no organization`);
  for (const row of data.clients)
    if (
      !organizationIds.has(row.organizationId) ||
      !branchIds.has(row.branchId)
    )
      errors.push(`client ${row.id} has an invalid scope`);
  for (const row of data.sites)
    if (!clientIds.has(row.clientId))
      errors.push(`site ${row.id} has no client`);
  for (const row of data.posts)
    if (!siteIds.has(row.siteId)) errors.push(`post ${row.id} has no site`);
  for (const row of data.employees)
    if (
      !organizationIds.has(row.organizationId) ||
      !userIds.has(row.userId) ||
      !branchIds.has(row.primaryBranchId)
    )
      errors.push(`employee ${row.id} has an invalid scope`);
  for (const row of data.externalIdentities)
    if (!userIds.has(row.userId))
      errors.push(`external identity ${row.id} has no user`);
  for (const row of data.userMemberships)
    if (
      !userIds.has(row.userId) ||
      !organizationIds.has(row.organizationId) ||
      data.users.find((user) => user.id === row.userId)?.organizationId !==
        row.organizationId
    )
      errors.push(`membership ${row.id} has an invalid scope`);
  for (const row of data.employeeRoles)
    if (!employeeIds.has(row.employeeId))
      errors.push(`role has no employee ${row.employeeId}`);
  for (const row of [...data.credentials, ...data.certifications])
    if (!employeeIds.has(row.employeeId))
      errors.push(`compliance record ${row.id} has no employee`);
  for (const row of data.shifts)
    if (!postIds.has(row.postId)) errors.push(`shift ${row.id} has no post`);
  for (const row of data.shiftAssignments)
    if (!shiftIds.has(row.shiftId) || !employeeIds.has(row.employeeId))
      errors.push(`assignment ${row.id} has an invalid relation`);
  for (const row of data.activityEntries)
    if (!assignmentIds.has(row.shiftAssignmentId))
      errors.push(`activity ${row.id} has no assignment`);
  for (const row of data.incidentReports)
    if (!siteIds.has(row.siteId) || !assignmentIds.has(row.shiftAssignmentId))
      errors.push(`incident ${row.id} has an invalid relation`);
  for (const row of data.assets)
    if (!organizationIds.has(row.organizationId))
      errors.push(`asset ${row.id} has no organization`);

  if (
    data.clients.length < 2 ||
    data.sites.length < 2 ||
    data.employees.length < 3 ||
    data.shiftAssignments.length < 3
  )
    errors.push("seed minimums are not satisfied");
  return errors;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const errors = validateSeedData(seedData);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Seed integrity validated.");
  }
}
