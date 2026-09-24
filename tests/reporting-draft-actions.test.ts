import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolver: vi.fn(),
  service: vi.fn(),
  save: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth/principal-resolver", () => ({
  createProductionPrincipalResolver: mocks.resolver,
}));
vi.mock("@/features/reporting-drafts/server", () => ({
  createReportingDraftService: mocks.service,
}));
vi.mock("@/features/reporting/server", () => ({
  createReportingService: vi.fn(),
}));
vi.mock("@/features/eosr/server", () => ({
  createEndOfShiftReportService: vi.fn(),
}));

import { saveReportingDraft } from "@/app/reporting/draft-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolver.mockResolvedValue({});
  mocks.service.mockResolvedValue({ save: mocks.save });
});

it("rejects malformed draft JSON without exposing its contents or persisting it", async () => {
  const form = new FormData();
  form.set("payload", '{"narrative":"Private incident details"');
  expect(await saveReportingDraft(form)).toEqual({
    kind: "validation-error",
    fieldErrors: { payload: ["Draft data is malformed. Review and retry."] },
  });
  expect(mocks.save).not.toHaveBeenCalled();
});
