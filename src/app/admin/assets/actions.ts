"use server";
import { revalidatePath } from "next/cache";
import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { createAssetService } from "@/features/assets/server";
const PATH = "/admin/assets";
async function service(operation: string) {
  return createAssetService(
    await createProductionPrincipalResolver(),
    operation,
  );
}
function input(form: FormData) {
  return {
    identifier: form.get("identifier"),
    assetType: form.get("assetType"),
    status: form.get("status"),
    condition: form.get("condition"),
    siteId: form.get("siteId"),
    inspectionDueOn: form.get("inspectionDueOn"),
    expiresOn: form.get("expiresOn"),
  };
}
export async function createAsset(form: FormData) {
  await (await service("assets.create")).create(input(form));
  revalidatePath(PATH);
}
export async function updateAsset(form: FormData) {
  await (
    await service("assets.update")
  ).update({
    ...input(form),
    assetId: form.get("assetId"),
    expectedUpdatedAt: form.get("expectedUpdatedAt"),
  });
  revalidatePath(PATH);
}
export async function custodyAsset(form: FormData) {
  await (
    await service("assets.custody")
  ).custody({
    assetId: form.get("assetId"),
    action: form.get("action"),
    employeeId: form.get("employeeId"),
    siteId: form.get("siteId"),
    reason: form.get("reason"),
    condition: form.get("condition"),
    expectedUpdatedAt: form.get("expectedUpdatedAt"),
  });
  revalidatePath(PATH);
}
