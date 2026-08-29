import { describe, expect, it } from "vitest";
import type { AuthenticatedPrincipal } from "@/shared/types/auth";
import { createAuthenticatedRequestContext } from "@/server/request/context";
import {
  AuthorizedDataAccess,
  type AuditContext,
} from "@/server/request/boundary";
import {
  InvariantViolationError,
  PermissionDeniedError,
  ResourceNotFoundError,
  ValidationError,
} from "@/server/request/errors";
import { SchedulingService } from "@/features/scheduling/service";
import type {
  PostSchedulingScope,
  SchedulingRepository,
  SchedulingScope,
  ShiftMutation,
} from "@/features/scheduling/repository";
import type { ShiftSummary } from "@/features/scheduling/contracts";

class MemorySchedulingRepository implements SchedulingRepository {
  post: PostSchedulingScope = {
    organizationId: "org-1",
    branchId: "branch-1",
    clientId: "client-1",
    siteId: "site-1",
    postId: "post-1",
    timezone: "America/Los_Angeles",
  };
  shifts: ShiftSummary[] = [];
  activeAssignments = 0;
  audit?: AuditContext;
  calls: string[] = [];
  getPostScope(scope: SchedulingScope, postId: string) {
    this.calls.push("getPostScope");
    return Promise.resolve(
      scope.organizationId === this.post.organizationId &&
        postId === this.post.postId
        ? this.post
        : null,
    );
  }
  listShifts(_scope: SchedulingScope, limit: number) {
    this.calls.push("listShifts");
    return Promise.resolve({
      items: this.shifts.slice(0, limit),
      hasMore: false,
    });
  }
  getShift(_scope: SchedulingScope, shiftId: string) {
    this.calls.push("getShift");
    return Promise.resolve(
      this.shifts.find((shift) => shift.id === shiftId) ?? null,
    );
  }
  countActiveAssignments() {
    this.calls.push("countActiveAssignments");
    return Promise.resolve(this.activeAssignments);
  }
  createShift(
    _scope: SchedulingScope,
    input: ShiftMutation,
    audit: AuditContext,
  ) {
    this.calls.push("createShift");
    this.audit = audit;
    const shift: ShiftSummary = {
      id: "shift-1",
      organizationId: this.post.organizationId,
      siteId: this.post.siteId,
      clientId: this.post.clientId,
      branchId: this.post.branchId,
      postName: "Lobby",
      siteName: "HQ",
      assignedCount: 0,
      updatedAt: "2026-08-29T10:00:00.000Z",
      ...input,
    };
    this.shifts.push(shift);
    return Promise.resolve(shift);
  }
  updateShift(
    _scope: SchedulingScope,
    shiftId: string,
    input: ShiftMutation,
    expectedUpdatedAt: string,
    audit: AuditContext,
  ) {
    this.calls.push("updateShift");
    this.audit = audit;
    const index = this.shifts.findIndex((shift) => shift.id === shiftId);
    if (index < 0 || this.shifts[index].updatedAt !== expectedUpdatedAt)
      return Promise.resolve(null);
    const updated = {
      ...this.shifts[index],
      ...input,
      updatedAt: "2026-08-29T11:00:00.000Z",
    };
    this.shifts[index] = updated;
    return Promise.resolve(updated);
  }
}

const principal = (
  roles: AuthenticatedPrincipal["roles"],
  values: Partial<AuthenticatedPrincipal> = {},
): AuthenticatedPrincipal => ({
  userId: "manager-1",
  organizationId: "org-1",
  roles,
  branchIds: [],
  clientIds: [],
  siteIds: [],
  ...values,
});

async function subject(
  actor: AuthenticatedPrincipal,
  repository = new MemorySchedulingRepository(),
) {
  const context = await createAuthenticatedRequestContext(
    {
      resolve: async () => ({
        principal: actor,
        authentication: { sessionId: "session-1" },
      }),
    },
    "scheduling.test",
    "request-1",
  );
  return {
    service: new SchedulingService(
      new AuthorizedDataAccess(context),
      repository,
    ),
    repository,
  };
}

const shiftInput = {
  postId: "post-1",
  timezone: "America/Los_Angeles",
  scheduledStart: "2026-11-07T22:00:00-08:00",
  scheduledEnd: "2026-11-08T06:00:00-08:00",
  staffingRequirement: 2,
  status: "DRAFT",
};

describe("NX-2.1 shift scheduling", () => {
  it("creates an overnight shift with authoritative scope and audit attribution", async () => {
    const { service, repository } = await subject(
      principal(["ADMIN"], { organizationWide: true }),
    );
    const shift = await service.createShift(shiftInput);
    expect(shift.scheduledEnd).toBe("2026-11-08T14:00:00.000Z");
    expect(repository.audit).toMatchObject({
      actorUserId: "manager-1",
      requestId: "request-1",
    });
  });

  it("rejects nonexistent spring-forward time and ambiguous time without an offset", async () => {
    const { service } = await subject(
      principal(["ADMIN"], { organizationWide: true }),
    );
    await expect(
      service.createShift({
        ...shiftInput,
        scheduledStart: "2026-03-08T02:30:00-08:00",
        scheduledEnd: "2026-03-08T04:00:00-07:00",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.createShift({
        ...shiftInput,
        scheduledStart: "2026-11-01T01:30:00",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("accepts an explicitly disambiguated fall-back instant", async () => {
    const { service } = await subject(
      principal(["ADMIN"], { organizationWide: true }),
    );
    await expect(
      service.createShift({
        ...shiftInput,
        scheduledStart: "2026-11-01T01:30:00-08:00",
        scheduledEnd: "2026-11-01T02:30:00-08:00",
      }),
    ).resolves.toBeDefined();
  });

  it("denies client users and cross-hierarchy forged posts", async () => {
    const client = await subject(
      principal(["CLIENT_USER"], { siteIds: ["site-1"] }),
    );
    await expect(client.service.createShift(shiftInput)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    const scoped = await subject(
      principal(["OPERATIONS_MANAGER"], { siteIds: ["site-2"] }),
    );
    await expect(scoped.service.createShift(shiftInput)).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
    await expect(
      scoped.service.createShift({ ...shiftInput, postId: "forged" }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });

  it("blocks invalid transitions and staffed material changes", async () => {
    const { service, repository } = await subject(
      principal(["ADMIN"], { organizationWide: true }),
    );
    const shift = await service.createShift({
      ...shiftInput,
      status: "PUBLISHED",
    });
    repository.activeAssignments = 1;
    await expect(
      service.updateShift({
        ...shiftInput,
        shiftId: shift.id,
        expectedUpdatedAt: shift.updatedAt,
        status: "CANCELLED",
      }),
    ).rejects.toBeInstanceOf(InvariantViolationError);
    repository.activeAssignments = 0;
    repository.shifts[0] = { ...repository.shifts[0], status: "COMPLETED" };
    await expect(
      service.updateShift({
        ...shiftInput,
        shiftId: shift.id,
        expectedUpdatedAt: shift.updatedAt,
      }),
    ).rejects.toBeInstanceOf(InvariantViolationError);
  });

  it("uses one bounded repository call for lists", async () => {
    const { service, repository } = await subject(
      principal(["ADMIN"], { organizationWide: true }),
    );
    await service.listShifts(500);
    expect(repository.calls).toEqual(["listShifts"]);
  });
});
