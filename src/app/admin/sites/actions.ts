"use server";
import { revalidatePath } from "next/cache";
import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { createSiteAdminService } from "@/features/site-admin/server";
const PATH = "/admin/sites";
async function service(operation: string) {
  return createSiteAdminService(
    await createProductionPrincipalResolver(),
    operation,
  );
}
export async function createSite(form: FormData) {
  await (await service("site-admin.create-site")).createSite(siteInput(form));
  revalidatePath(PATH);
}
export async function updateSite(form: FormData) {
  await (
    await service("site-admin.update-site")
  ).updateSite({
    ...siteInput(form),
    siteId: form.get("siteId"),
    expectedUpdatedAt: form.get("expectedUpdatedAt"),
  });
  revalidatePath(PATH);
}
function siteInput(form: FormData) {
  return {
    clientId: form.get("clientId"),
    name: form.get("name"),
    addressLine1: form.get("addressLine1"),
    city: form.get("city"),
    region: form.get("region"),
    postalCode: form.get("postalCode"),
    country: form.get("country"),
    timezone: form.get("timezone"),
    latitude: form.get("latitude"),
    longitude: form.get("longitude"),
    geofenceRadiusMeters: form.get("geofenceRadiusMeters"),
    status: form.get("status"),
  };
}
export async function createPost(form: FormData) {
  await (await service("site-admin.create-post")).createPost(postInput(form));
  revalidatePath(PATH);
}
export async function updatePost(form: FormData) {
  await (
    await service("site-admin.update-post")
  ).updatePost({
    ...postInput(form),
    postId: form.get("postId"),
    expectedUpdatedAt: form.get("expectedUpdatedAt"),
  });
  revalidatePath(PATH);
}
function postInput(form: FormData) {
  return {
    siteId: form.get("siteId"),
    name: form.get("name"),
    description: form.get("description"),
    serviceType: form.get("serviceType"),
    armedRequirement: form.get("armedRequirement"),
    qualificationRequirements: form.get("qualificationRequirements"),
    status: form.get("status"),
  };
}
