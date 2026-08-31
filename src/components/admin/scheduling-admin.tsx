import type { SchedulingAdminPageState } from "@/features/scheduling/contracts";
import { SubmitButton } from "./submit-button";

const panel = "rounded-xl border border-white/10 bg-[var(--card)] p-5";
const input =
  "mt-1 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3 py-2";

function shiftTime(start: string, end: string, timezone: string) {
  const format = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
  return `${format.format(new Date(start))} → ${format.format(new Date(end))}`;
}

export type SchedulingAdminActions = {
  createShift(form: FormData): Promise<void>;
  assignEmployee(form: FormData): Promise<void>;
};

export function SchedulingAdmin({
  state,
  actions,
}: {
  state: SchedulingAdminPageState;
  actions?: SchedulingAdminActions;
}) {
  if (state.kind !== "ready") {
    return (
      <section className={panel} role="alert">
        <h1 className="text-xl font-semibold">Scheduling unavailable</h1>
        <p className="mt-2 text-[var(--text-muted)]">{state.message}</p>
      </section>
    );
  }
  const enabled = Boolean(actions);
  return (
    <div className="grid gap-6">
      <section className={panel}>
        <h1 className="text-2xl font-semibold">Shift scheduling</h1>
        <p className="mt-1 text-[var(--text-muted)]">
          Times use the post&apos;s local timezone. Nexus preserves the
          authoritative timestamp for scheduling and audit records.
        </p>
        <form
          action={actions?.createShift}
          className="mt-4 grid gap-3 md:grid-cols-3"
        >
          <label>
            <span className="text-sm">Post</span>
            <select className={input} disabled={!enabled} name="post" required>
              {state.posts.map((post) => (
                <option key={post.id} value={`${post.id}|${post.timezone}`}>
                  {post.siteName} — {post.name} ({post.timezone})
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-sm">Start</span>
            <input
              className={input}
              disabled={!enabled}
              name="scheduledStart"
              type="datetime-local"
              required
            />
          </label>
          <label>
            <span className="text-sm">End</span>
            <input
              className={input}
              disabled={!enabled}
              name="scheduledEnd"
              type="datetime-local"
              required
            />
          </label>
          <label>
            <span className="text-sm">Required staff</span>
            <input
              className={input}
              defaultValue="1"
              disabled={!enabled}
              max="100"
              min="1"
              name="staffingRequirement"
              type="number"
            />
          </label>
          <label>
            <span className="text-sm">Initial status</span>
            <select className={input} disabled={!enabled} name="status">
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
            </select>
          </label>
          <div className="self-end">
            <SubmitButton disabled={!enabled}>Create shift</SubmitButton>
          </div>
        </form>
      </section>
      <section className={panel}>
        <h2 className="text-xl font-semibold">Authorized shifts</h2>
        {state.shifts.items.length ? (
          <div className="mt-3 grid gap-3">
            {state.shifts.items.map((shift) => (
              <article
                className="rounded-lg border border-white/10 p-4"
                key={shift.id}
              >
                <strong>
                  {shift.siteName} — {shift.postName}
                </strong>
                <p className="text-sm text-[var(--text-muted)]">
                  {shiftTime(
                    shift.scheduledStart,
                    shift.scheduledEnd,
                    shift.timezone,
                  )}{" "}
                  · {shift.assignedCount}/{shift.staffingRequirement} staffed ·{" "}
                  {shift.status}
                </p>
                <form
                  action={actions?.assignEmployee}
                  className="mt-3 flex flex-wrap items-end gap-2"
                >
                  <input name="shiftId" type="hidden" value={shift.id} />
                  <label className="min-w-64 flex-1">
                    <span className="text-sm">Eligible employee</span>
                    <select
                      className={input}
                      disabled={!enabled}
                      name="employeeId"
                    >
                      {state.employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.displayName} — {employee.employeeNumber}
                        </option>
                      ))}
                    </select>
                  </label>
                  <SubmitButton
                    disabled={
                      !enabled ||
                      shift.assignedCount >= shift.staffingRequirement
                    }
                  >
                    Assign
                  </SubmitButton>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[var(--text-muted)]">
            No shifts are scheduled in your authorized scope.
          </p>
        )}
      </section>
    </div>
  );
}
