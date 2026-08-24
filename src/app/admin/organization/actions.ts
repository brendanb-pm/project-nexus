"use server";

import { revalidatePath } from "next/cache";
import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { createOrganizationAdminService } from "@/features/organization-admin/server";

const ADMIN_PATH = "/admin/organization";

async function service(operation: string) {
  return createOrganizationAdminService(
    await createProductionPrincipalResolver(),
    operation,
  );
}

export async function updateOrganization(formData: FormData): Promise<void> {
  await (
    await service("organization-admin.update-organization")
  ).updateOrganization({
    name: formData.get("name"),
    status: formData.get("status"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
  });
  revalidatePath(ADMIN_PATH);
}

export async function createBranch(formData: FormData): Promise<void> {
  await (
    await service("organization-admin.create-branch")
  ).createBranch({
    name: formData.get("name"),
    timezone: formData.get("timezone"),
    status: formData.get("status"),
  });
  revalidatePath(ADMIN_PATH);
}

export async function updateBranch(formData: FormData): Promise<void> {
  await (
    await service("organization-admin.update-branch")
  ).updateBranch({
    branchId: formData.get("branchId"),
    name: formData.get("name"),
    timezone: formData.get("timezone"),
    status: formData.get("status"),
    expectedUpdatedAt: formData.get("expectedUpdatedAt"),
  });
  revalidatePath(ADMIN_PATH);
}
