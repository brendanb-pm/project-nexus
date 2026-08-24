"use server";
import { revalidatePath } from "next/cache";
import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { createPeopleAdminService } from "@/features/people-admin/server";
const PATH = "/admin/employees";
async function service(operation: string) {
  return createPeopleAdminService(
    await createProductionPrincipalResolver(),
    operation,
  );
}
export async function createEmployee(form: FormData) {
  await (
    await service("people-admin.create-employee")
  ).createEmployee({
    employeeNumber: form.get("employeeNumber"),
    displayName: form.get("displayName"),
    workPhone: form.get("workPhone"),
    employmentStatus: form.get("employmentStatus"),
    primaryBranchId: form.get("primaryBranchId"),
    userId: form.get("userId"),
  });
  revalidatePath(PATH);
}
export async function updateEmployee(form: FormData) {
  await (
    await service("people-admin.update-employee")
  ).updateEmployee({
    employeeId: form.get("employeeId"),
    employeeNumber: form.get("employeeNumber"),
    displayName: form.get("displayName"),
    workPhone: form.get("workPhone"),
    employmentStatus: form.get("employmentStatus"),
    primaryBranchId: form.get("primaryBranchId"),
    userId: form.get("userId"),
    expectedUpdatedAt: form.get("expectedUpdatedAt"),
  });
  revalidatePath(PATH);
}
