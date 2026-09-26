import { describe, expect, it, vi } from "vitest";
import { AuthorizedDataAccess } from "@/server/request/boundary";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import { PermissionDeniedError } from "@/server/request/errors";
import {
  ClientPublicationService,
  validateDraft,
} from "@/features/client-publication/service";
import type { ClientPublicationRepository } from "@/features/client-publication/repository";

const ids = {
  organization: "00000000-0000-4000-8000-000000000001",
  branch: "00000000-0000-4000-8000-000000000010",
  client: "00000000-0000-4000-8000-000000000020",
  site: "00000000-0000-4000-8000-000000000030",
  user: "00000000-0000-4000-8000-000000000052",
};
const draft = {
  clientId: ids.client,
  siteIds: [ids.site],
  periodStart: "2026-09-01T00:00:00.000Z",
  periodEnd: "2026-09-02T00:00:00.000Z",
  executiveSummary: "Reviewed client-safe summary.",
  completionSummary: "Closeout evidence reviewed.",
  followUps: ["Follow up with the site."],
  selectedSources: [],
};

async function subject(
  role:
    | "GUARD"
    | "SUPERVISOR"
    | "OPERATIONS_MANAGER"
    | "ADMIN"
    | "CLIENT_USER"
    | "LEADERSHIP",
) {
  const context = await createAuthenticatedRequestContext(
    {
      resolve: async () => ({
        principal: {
          userId: ids.user,
          organizationId: ids.organization,
          roles: [role],
          organizationWide: true,
          branchIds: [],
          clientIds: [],
          siteIds: [],
        },
      }),
    },
    "client-publication.test",
  );
  const repo = {
    saveDraft: vi.fn().mockResolvedValue({
      ...draft,
      id: "draft-1",
      revision: 0,
      latestVersion: 0,
    }),
    listDrafts: vi.fn().mockResolvedValue([]),
    draft: vi.fn().mockResolvedValue(null),
    publish: vi.fn().mockResolvedValue({ id: "publication-1" }),
    listPublished: vi.fn().mockResolvedValue([]),
    publication: vi.fn().mockResolvedValue(null),
  } as unknown as ClientPublicationRepository;
  return {
    service: new ClientPublicationService(
      new AuthorizedDataAccess(context),
      repo,
    ),
    repo,
  };
}

describe("NX-8.12 publication authority", () => {
  it("bounds draft content and rejects invalid or duplicate source selection", () => {
    expect(validateDraft(draft).scopeKey).toHaveLength(64);
    expect(() =>
      validateDraft({ ...draft, siteIds: [ids.site, ids.site] }),
    ).toThrow(/distinct/);
    expect(() =>
      validateDraft({ ...draft, periodEnd: "2026-11-01T00:00:00.000Z" }),
    ).toThrow(/31 days/);
    expect(() =>
      validateDraft({
        ...draft,
        selectedSources: [
          { kind: "ACTIVITY", id: ids.site, clientSummary: "First" },
          { kind: "ACTIVITY", id: ids.site, clientSummary: "Second" },
        ],
      }),
    ).toThrow(/only once/);
  });

  it("grants publication only to capability-backed Operations Manager and Admin", async () => {
    for (const role of ["OPERATIONS_MANAGER", "ADMIN"] as const) {
      const { service, repo } = await subject(role);
      await service.saveDraft(draft);
      expect(repo.saveDraft).toHaveBeenCalledOnce();
    }
    for (const role of [
      "GUARD",
      "SUPERVISOR",
      "CLIENT_USER",
      "LEADERSHIP",
    ] as const) {
      const { service, repo } = await subject(role);
      await expect(service.saveDraft(draft)).rejects.toBeInstanceOf(
        PermissionDeniedError,
      );
      expect(repo.saveDraft).not.toHaveBeenCalled();
    }
  });

  it("requires an explicit confirmation and current revisions before publication", async () => {
    const { service, repo } = await subject("OPERATIONS_MANAGER");
    await expect(
      service.publish({
        draftId: ids.site,
        expectedDraftRevision: 0,
        expectedVersion: 0,
        confirmationKey: ids.client,
        confirmed: false,
      }),
    ).rejects.toThrow(/Confirm/);
    expect(repo.publish).not.toHaveBeenCalled();
  });
});
