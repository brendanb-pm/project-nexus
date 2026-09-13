import { redirect } from "next/navigation";
import { selectAuthenticatedLandingPath } from "@/auth/landing";
import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { createAuthenticatedRequestContext } from "@/server/request/context";

export default async function Page() {
  let destination: string | null = null;
  try {
    const context = await createAuthenticatedRequestContext(
      await createProductionPrincipalResolver(),
      "session.continue",
    );
    destination = selectAuthenticatedLandingPath(context.capabilities);
  } catch {
    redirect("/sign-in");
  }

  redirect(destination ?? "/sign-in?error=access_unavailable");
}
