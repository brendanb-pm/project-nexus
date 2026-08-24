"use server";
import { revalidatePath } from "next/cache";
import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { createClientAdminService } from "@/features/client-admin/server";
import { measureServerAction } from "@/server/performance/telemetry";
const PATH = "/admin/clients";
async function service(operation: string) {
  return createClientAdminService(
    await createProductionPrincipalResolver(),
    operation,
  );
}
export async function createClient(form: FormData) {
  await (
    await service("client-admin.create-client")
  ).createClient({
    branchId: form.get("branchId"),
    name: form.get("name"),
    status: form.get("status"),
  });
  revalidatePath(PATH);
}
export async function updateClient(form: FormData) {
  return measureServerAction("client-admin.update-client", async () => {
    await (
      await service("client-admin.update-client")
    ).updateClient({
      clientId: form.get("clientId"),
      branchId: form.get("branchId"),
      name: form.get("name"),
      status: form.get("status"),
      expectedUpdatedAt: form.get("expectedUpdatedAt"),
    });
    revalidatePath(PATH);
  });
}
export async function createContact(form: FormData) {
  await (
    await service("client-admin.create-contact")
  ).createContact({
    clientId: form.get("clientId"),
    name: form.get("name"),
    email: form.get("email"),
    phone: form.get("phone"),
    status: form.get("status"),
  });
  revalidatePath(PATH);
}
export async function updateContact(form: FormData) {
  await (
    await service("client-admin.update-contact")
  ).updateContact({
    contactId: form.get("contactId"),
    clientId: form.get("clientId"),
    name: form.get("name"),
    email: form.get("email"),
    phone: form.get("phone"),
    status: form.get("status"),
    expectedUpdatedAt: form.get("expectedUpdatedAt"),
  });
  revalidatePath(PATH);
}
export async function createContract(form: FormData) {
  await (
    await service("client-admin.create-contract")
  ).createContract({
    clientId: form.get("clientId"),
    name: form.get("name"),
    startsOn: form.get("startsOn"),
    endsOn: form.get("endsOn"),
    status: form.get("status"),
  });
  revalidatePath(PATH);
}
export async function updateContract(form: FormData) {
  await (
    await service("client-admin.update-contract")
  ).updateContract({
    contractId: form.get("contractId"),
    clientId: form.get("clientId"),
    name: form.get("name"),
    startsOn: form.get("startsOn"),
    endsOn: form.get("endsOn"),
    status: form.get("status"),
    expectedUpdatedAt: form.get("expectedUpdatedAt"),
  });
  revalidatePath(PATH);
}
