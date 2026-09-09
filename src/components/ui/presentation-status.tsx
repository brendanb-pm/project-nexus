const actionRequired = new Set([
  "UNSTAFFED",
  "OVERDUE_CHECKIN",
  "CRITICAL_INCIDENT",
  "UNCOVERED",
  "CURRENT",
  "INCOMPLETE",
]);
const pending = new Set([
  "SCHEDULED",
  "ASSIGNED",
  "AWAITING_ACK",
  "AWAITING_ACKNOWLEDGEMENT",
  "INCOMING_PASSDOWN",
  "UPCOMING",
  "REVIEW",
]);
const inProgress = new Set(["CLOCKED_IN", "ON_DUTY", "INVESTIGATING"]);
const resolved = new Set([
  "COMPLETED",
  "ACKNOWLEDGED",
  "CLOSED_EOSR",
  "VERIFIED",
  "CLOSED",
]);

export type PresentationStatus =
  "Action Required" | "Pending" | "In Progress" | "Resolved";

export function presentationStatus(value: string): PresentationStatus {
  const normalized = value.trim().toUpperCase().replaceAll(" ", "_");
  if (actionRequired.has(normalized)) return "Action Required";
  if (pending.has(normalized)) return "Pending";
  if (inProgress.has(normalized)) return "In Progress";
  if (resolved.has(normalized)) return "Resolved";
  return "Pending";
}

export function PresentationStatusBadge({ value }: { value: string }) {
  const label = presentationStatus(value);
  const tone =
    label === "Action Required"
      ? "border-[var(--danger)]/50 bg-[var(--danger)]/15 text-red-100"
      : label === "In Progress"
        ? "border-sky-400/40 bg-sky-400/10 text-sky-100"
        : label === "Resolved"
          ? "border-[var(--success)]/40 bg-[var(--success)]/10 text-emerald-100"
          : "border-[var(--warning)]/40 bg-[var(--warning)]/10 text-amber-100";
  return (
    <span
      className={`rounded-full border px-2 py-1 text-xs font-semibold ${tone}`}
    >
      {label}
    </span>
  );
}
