import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReportingDraft } from "@/components/reporting/use-reporting-draft";

const actions = vi.hoisted(() => ({
  recover: vi.fn(),
  save: vi.fn(),
  discard: vi.fn(),
  submit: vi.fn(),
}));

vi.mock("@/app/reporting/draft-actions", () => ({
  recoverReportingDraft: actions.recover,
  saveReportingDraft: actions.save,
  discardReportingDraft: actions.discard,
  submitReportingDraft: actions.submit,
}));

beforeEach(() => {
  vi.clearAllMocks();
  actions.recover.mockResolvedValue({ kind: "empty" });
});
afterEach(cleanup);

function setup() {
  const payload = { narrative: "" };
  const hook = renderHook(() =>
    useReportingDraft({
      assignmentId: "assignment-1",
      family: "SHIFT_ACTIVITY",
      readPayload: () => ({ ...payload }),
      restorePayload: (saved) => {
        payload.narrative = String(saved.narrative);
      },
      clearPayload: () => {
        payload.narrative = "";
      },
    }),
  );
  return { ...hook, payload };
}

describe("reporting draft client state", () => {
  it("acknowledges only confirmed saves and avoids unchanged writes", async () => {
    const { result, payload } = setup();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    payload.narrative = "A synthetic note";
    act(() => result.current.changed());
    expect(result.current.status).toBe("unsaved");
    actions.save.mockImplementation(async (form: FormData) => ({
      kind: "saved",
      draft: {
        id: "draft-1",
        shiftAssignmentId: "assignment-1",
        family: "SHIFT_ACTIVITY",
        clientDraftKey: form.get("clientDraftKey"),
        submissionKey: form.get("submissionKey"),
        revision: 1,
        disposition: "ACTIVE",
        payload: JSON.parse(String(form.get("payload"))),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      },
    }));
    await act(async () => expect(await result.current.saveNow()).toBe(true));
    expect(result.current.status).toBe("saved");
    await act(async () => expect(await result.current.saveNow()).toBe(true));
    expect(actions.save).toHaveBeenCalledTimes(1);
  });

  it("reuses the save idempotency key after a lost response", async () => {
    const { result, payload } = setup();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    payload.narrative = "Lost acknowledgement";
    act(() => result.current.changed());
    actions.save.mockRejectedValueOnce(new Error("connection lost"));
    await act(async () => expect(await result.current.saveNow()).toBe(false));
    expect(result.current.status).toBe("retry");
    const first = actions.save.mock.calls[0]![0] as FormData;
    actions.save.mockImplementationOnce(async (form: FormData) => ({
      kind: "saved",
      draft: {
        id: "draft-2",
        shiftAssignmentId: "assignment-1",
        family: "SHIFT_ACTIVITY",
        clientDraftKey: form.get("clientDraftKey"),
        submissionKey: form.get("submissionKey"),
        revision: 1,
        disposition: "ACTIVE",
        payload: JSON.parse(String(form.get("payload"))),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
      },
    }));
    await act(async () => expect(await result.current.saveNow()).toBe(true));
    const second = actions.save.mock.calls[1]![0] as FormData;
    expect(second.get("saveKey")).toBe(first.get("saveKey"));
    expect(result.current.status).toBe("saved");
  });

  it("serializes simultaneous autosave and submit-triggered saves", async () => {
    const { result, payload } = setup();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    payload.narrative = "A concurrent save";
    let release: (() => void) | undefined;
    actions.save.mockImplementation(
      (form: FormData) =>
        new Promise((resolve) => {
          release = () =>
            resolve({
              kind: "saved",
              draft: {
                id: "draft-3",
                shiftAssignmentId: "assignment-1",
                family: "SHIFT_ACTIVITY",
                clientDraftKey: form.get("clientDraftKey"),
                submissionKey: form.get("submissionKey"),
                revision: 1,
                disposition: "ACTIVE",
                payload: JSON.parse(String(form.get("payload"))),
                updatedAt: new Date().toISOString(),
                expiresAt: new Date().toISOString(),
              },
            });
        }),
    );
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.saveNow();
      second = result.current.saveNow();
    });
    expect(actions.save).toHaveBeenCalledTimes(1);
    await act(async () => release?.());
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(actions.save).toHaveBeenCalledTimes(1);
  });
});
