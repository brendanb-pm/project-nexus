import "server-only";
import { createClientPublicationService } from "@/features/client-publication/server";

export async function loadClientPortal() {
  const service = await createClientPublicationService("client-portal.page");
  return { publications: await service.listPublished() };
}
