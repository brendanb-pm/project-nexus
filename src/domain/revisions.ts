import type { RecordStatus } from "@/domain/model";

export type RecordRevision<T> = {
  revision: number;
  status: RecordStatus;
  value: Readonly<T>;
  changedBy: string;
  changedAt: string;
  reason?: string;
};

export function reviseRecord<T>(
  history: readonly RecordRevision<T>[],
  nextValue: T,
  actorId: string,
  changedAt: string,
  reason?: string,
): RecordRevision<T>[] {
  const current = history.at(-1);
  if (!current) throw new Error("A record must have an initial revision");
  if (current.status !== "DRAFT" && !reason?.trim())
    throw new Error("A submitted record correction requires a reason");
  const status: RecordStatus = current.status === "DRAFT" ? "DRAFT" : "AMENDED";
  return [
    ...history,
    {
      revision: current.revision + 1,
      status,
      value: Object.freeze(nextValue),
      changedBy: actorId,
      changedAt,
      ...(reason ? { reason } : {}),
    },
  ];
}

export function transitionRecord<T>(
  history: readonly RecordRevision<T>[],
  status: Extract<RecordStatus, "SUBMITTED" | "ACKNOWLEDGED" | "APPROVED">,
  actorId: string,
  changedAt: string,
): RecordRevision<T>[] {
  const current = history.at(-1);
  if (!current) throw new Error("A record must have an initial revision");
  return [
    ...history,
    {
      ...current,
      revision: current.revision + 1,
      status,
      changedBy: actorId,
      changedAt,
    },
  ];
}
