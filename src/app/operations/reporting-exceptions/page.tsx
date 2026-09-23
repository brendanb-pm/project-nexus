import { createProductionPrincipalResolver } from "@/auth/principal-resolver";
import { ReportingExceptionQueue } from "@/components/operations/reporting-exception-queue";
import { createReportingExceptionService } from "@/features/reporting-exceptions/server";
import { transitionReportingException } from "./actions";

export default async function ReportingExceptionsPage() {
  const service = await createReportingExceptionService(
    await createProductionPrincipalResolver(),
    "reporting-exceptions.page",
  );
  const exceptions = await service.listOperations();
  return (
    <ReportingExceptionQueue
      lifecycleRole={service.lifecycleRole()}
      exceptions={exceptions}
      transition={transitionReportingException}
    />
  );
}
