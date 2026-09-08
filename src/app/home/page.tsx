import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { DevelopmentSignOut } from "@/components/auth/development-sign-out";
import { GuardHome } from "@/components/guard/guard-home";
import { GuardShell } from "@/components/guard/guard-shell";
import { isLocalDevelopmentAuthEnabled } from "@/auth/development";
import { createEndOfShiftReportService } from "@/features/eosr/server";
import { loadMySchedulePage } from "@/features/scheduling/application";
import { createSchedulingService } from "@/features/scheduling/server";
import { setPassdownDismissal } from "../eosr/actions";
import { clock, createAvailability } from "../schedule/actions";

export default async function Page() {
  const resolver = await createProductionPrincipalResolver();
  const [state, passdowns] = await Promise.all([
    loadMySchedulePage(createSchedulingService(resolver, "guard-home.page")),
    (
      await createEndOfShiftReportService(resolver, "guard-home.passdowns")
    ).listIncomingPassdowns(),
  ]);
  return (
    <GuardShell>
      <GuardHome
        actions={{ clock, createAvailability, setPassdownDismissal }}
        passdowns={passdowns}
        state={state}
      />
      {isLocalDevelopmentAuthEnabled() ? <DevelopmentSignOut /> : null}
    </GuardShell>
  );
}
