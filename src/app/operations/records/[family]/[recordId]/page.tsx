import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { OperationalRecordDetail } from "@/components/operations/operational-record-detail";
import {
  isOperationalRecordFamily,
  isOperationalRecordId,
} from "@/features/operations/contracts";
import { loadOperationalRecordDetail } from "@/features/operations/record-detail";
import { createReportingService } from "@/features/reporting/server";
import { createEndOfShiftReportService } from "@/features/eosr/server";
import { measureRequest } from "@/server/performance/telemetry";
import {
  acknowledgeOperationalRecord,
  amendOperationalRecord,
} from "@/app/reporting/actions";
import { DevelopmentSignOut } from "@/components/auth/development-sign-out";
import { isLocalDevelopmentAuthEnabled } from "@/auth/development";

export default async function Page({
  params,
}: {
  params: Promise<{ family: string; recordId: string }>;
}) {
  const { family, recordId } = await params;
  if (!isOperationalRecordFamily(family) || !isOperationalRecordId(recordId))
    return <OperationalRecordDetail state={{ kind: "unavailable" }} />;
  const resolver = await createProductionPrincipalResolver();
  const state = await measureRequest("operations.record-detail", () =>
    loadOperationalRecordDetail(
      family,
      recordId,
      createReportingService(resolver, "operations.record-detail.reporting"),
      createEndOfShiftReportService(resolver, "operations.record-detail.eosr"),
    ),
  );
  return (
    <>
      {isLocalDevelopmentAuthEnabled() ? <DevelopmentSignOut /> : null}
      <OperationalRecordDetail
        state={state}
        actions={{
          acknowledge: acknowledgeOperationalRecord,
          amend: amendOperationalRecord,
        }}
      />
    </>
  );
}
