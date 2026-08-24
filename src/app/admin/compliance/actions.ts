"use server";
import { revalidatePath } from "next/cache";
import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { createComplianceAdminService } from "@/features/compliance-admin/server";
const PATH = "/admin/compliance";
async function service(operation: string) {
  return createComplianceAdminService(
    await createProductionPrincipalResolver(),
    operation,
  );
}
function input(form: FormData) {
  return {
    employeeId: form.get("employeeId"),
    type: form.get("type"),
    identifier: form.get("identifier"),
    issuingAuthority: form.get("issuingAuthority"),
    issuedOn: form.get("issuedOn"),
    expiresOn: form.get("expiresOn"),
    status: form.get("status"),
    documentReference: form.get("documentReference"),
  };
}
export async function createCredential(form: FormData) {
  await (
    await service("compliance.create-credential")
  ).create("credential", input(form));
  revalidatePath(PATH);
}
export async function createCertification(form: FormData) {
  await (
    await service("compliance.create-certification")
  ).create("certification", input(form));
  revalidatePath(PATH);
}
export async function updateCredential(form: FormData) {
  await (
    await service("compliance.update-credential")
  ).update("credential", {
    ...input(form),
    recordId: form.get("recordId"),
    expectedUpdatedAt: form.get("expectedUpdatedAt"),
  });
  revalidatePath(PATH);
}
export async function updateCertification(form: FormData) {
  await (
    await service("compliance.update-certification")
  ).update("certification", {
    ...input(form),
    recordId: form.get("recordId"),
    expectedUpdatedAt: form.get("expectedUpdatedAt"),
  });
  revalidatePath(PATH);
}
export async function verifyCredential(form: FormData) {
  await (
    await service("compliance.verify-credential")
  ).verify(
    "credential",
    String(form.get("recordId") ?? ""),
    form.get("expectedUpdatedAt"),
  );
  revalidatePath(PATH);
}
export async function verifyCertification(form: FormData) {
  await (
    await service("compliance.verify-certification")
  ).verify(
    "certification",
    String(form.get("recordId") ?? ""),
    form.get("expectedUpdatedAt"),
  );
  revalidatePath(PATH);
}
export async function renewCredential(form: FormData) {
  await (
    await service("compliance.renew-credential")
  ).renew("credential", {
    ...input(form),
    predecessorId: form.get("predecessorId"),
  });
  revalidatePath(PATH);
}
export async function renewCertification(form: FormData) {
  await (
    await service("compliance.renew-certification")
  ).renew("certification", {
    ...input(form),
    predecessorId: form.get("predecessorId"),
  });
  revalidatePath(PATH);
}
