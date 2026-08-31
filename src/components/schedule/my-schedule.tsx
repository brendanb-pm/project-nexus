"use client";

import { useState } from "react";
import type { MySchedulePageState } from "@/features/scheduling/contracts";

const panel = "rounded-xl border border-white/10 bg-[var(--card)] p-5";
const input =
  "mt-1 w-full rounded-lg border border-white/15 bg-[var(--background)] px-3 py-2";

function assignmentTime(start: string, end: string, timezone: string) {
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

function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function localTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

function durationLabel(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export type MyScheduleActions = {
  createAvailability(form: FormData): Promise<void>;
  clock(form: FormData): Promise<void>;
};

function ClockButton({
  assignmentId,
  eventType,
  action,
}: {
  assignmentId: string;
  eventType: "CLOCK_IN" | "CLOCK_OUT";
  action?: (form: FormData) => Promise<void>;
}) {
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  async function submit() {
    if (!action || pending) return;
    setPending(true);
    setStatus("Requesting one-time location…");
    const form = new FormData();
    form.set("shiftAssignmentId", assignmentId);
    form.set("eventType", eventType);
    if (navigator.geolocation) {
      await new Promise<void>((resolve) =>
        navigator.geolocation.getCurrentPosition(
          (position) => {
            form.set("latitude", String(position.coords.latitude));
            form.set("longitude", String(position.coords.longitude));
            form.set("accuracyMeters", String(position.coords.accuracy));
            resolve();
          },
          () => resolve(),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
        ),
      );
    }
    setStatus("Recording…");
    try {
      await action(form);
      setStatus("Recorded.");
    } catch {
      setStatus("Could not record the clock event. Try again safely.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <button
        className="min-h-11 rounded-lg bg-[var(--accent)] px-4 py-2 font-medium text-black"
        disabled={pending}
        onClick={submit}
        type="button"
      >
        {eventType === "CLOCK_IN" ? "Clock in" : "Clock out"}
      </button>
      <span
        aria-live="polite"
        className="ml-2 text-sm text-[var(--text-muted)]"
      >
        {status}
      </span>
    </div>
  );
}

export function MySchedule({
  state,
  actions,
}: {
  state: MySchedulePageState;
  actions?: MyScheduleActions;
}) {
  if (state.kind !== "ready")
    return (
      <section className={panel} role="alert">
        <h1 className="text-xl font-semibold">My schedule unavailable</h1>
        <p className="mt-2 text-[var(--text-muted)]">{state.message}</p>
      </section>
    );
  const timezones = [
    ...new Set(state.assignments.map((item) => item.shift.timezone)),
  ];
  return (
    <div className="grid gap-6">
      <section className={panel}>
        <h1 className="text-2xl font-semibold">My schedule</h1>
        <p className="mt-1 text-[var(--text-muted)]">
          Location is requested only when you press a clock button. Nexus does
          not track location continuously.
        </p>
      </section>
      <section className={panel}>
        <h2 className="text-xl font-semibold">Assignments</h2>
        {state.assignments.length ? (
          <div className="mt-3 grid gap-3">
            {state.assignments.map((assignment) => (
              <article
                className="rounded-lg border border-white/10 p-4"
                key={assignment.id}
              >
                <strong>
                  {assignment.shift.siteName} — {assignment.shift.postName}
                </strong>
                <p className="mb-3 text-sm text-[var(--text-muted)]">
                  {assignmentTime(
                    assignment.shift.scheduledStart,
                    assignment.shift.scheduledEnd,
                    assignment.shift.timezone,
                  )}
                </p>
                {assignment.shift.siteAddress ? (
                  <p className="mb-3 text-sm text-[var(--text-muted)]">
                    {assignment.shift.siteAddress}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  {assignment.shift.siteAddress ? (
                    <a
                      className="min-h-11 rounded-lg border border-white/20 px-4 py-2 font-medium"
                      href={mapsUrl(assignment.shift.siteAddress)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Get directions
                    </a>
                  ) : null}
                  <ClockButton
                    action={actions?.clock}
                    assignmentId={assignment.id}
                    eventType={state.clockStates?.[assignment.id] ?? "CLOCK_IN"}
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[var(--text-muted)]">
            No assignments are currently scheduled.
          </p>
        )}
      </section>
      <section className={panel}>
        <h2 className="text-xl font-semibold">Upcoming schedule</h2>
        <p className="mt-1 text-[var(--text-muted)]">
          Your next scheduled shifts, with local start and end times.
        </p>
        <div className="mt-3 grid gap-3">
          {state.assignments
            .filter((assignment) => assignment.shift.status === "PUBLISHED")
            .map((assignment) => (
              <article
                className="rounded-lg border border-white/10 p-4"
                key={`upcoming-${assignment.id}`}
              >
                <strong>
                  {assignment.shift.siteName} — {assignment.shift.postName}
                </strong>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {assignmentTime(
                    assignment.shift.scheduledStart,
                    assignment.shift.scheduledEnd,
                    assignment.shift.timezone,
                  )}
                </p>
                <p className="mt-1 text-sm">Assignment: {assignment.status}</p>
                {assignment.shift.siteAddress ? (
                  <a
                    className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-white/20 px-3 py-2 text-sm"
                    href={mapsUrl(assignment.shift.siteAddress)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Get directions
                  </a>
                ) : null}
              </article>
            ))}
        </div>
      </section>
      <section className={panel}>
        <h2 className="text-xl font-semibold">Timecard</h2>
        <p className="mt-1 text-[var(--text-muted)]">
          What time Nexus currently has recorded for you.
        </p>
        <div className="mt-3 grid gap-3">
          {state.assignments.map((assignment) => {
            const events = state.clockEvents?.[assignment.id] ?? [];
            const totalSeconds = events.reduce((total, event, index) => {
              if (event.eventType !== "CLOCK_OUT") return total;
              const prior = events[index - 1];
              return prior?.eventType === "CLOCK_IN"
                ? total +
                    Math.max(
                      0,
                      (new Date(event.effectiveAt).valueOf() -
                        new Date(prior.effectiveAt).valueOf()) /
                        1000,
                    )
                : total;
            }, 0);
            const incomplete = events.at(-1)?.eventType === "CLOCK_IN";
            return (
              <article
                className="rounded-lg border border-white/10 p-4"
                key={`timecard-${assignment.id}`}
              >
                <strong>
                  {assignment.shift.siteName} — {assignment.shift.postName}
                </strong>
                {events.length ? (
                  <>
                    {events.map((event) => (
                      <p
                        className="mt-1 text-sm text-[var(--text-muted)]"
                        key={event.id}
                      >
                        {event.eventType === "CLOCK_IN"
                          ? "Clock-in"
                          : "Clock-out"}
                        :{" "}
                        {localTime(
                          event.effectiveAt,
                          assignment.shift.timezone,
                        )}
                      </p>
                    ))}
                    <p className="mt-2 font-medium">
                      Total: {durationLabel(totalSeconds)}
                    </p>
                    {incomplete ? (
                      <p className="mt-1 text-sm">
                        Incomplete pair — clock out to complete this shift.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    No clock events recorded yet.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>
      <section className={panel}>
        <h2 className="text-xl font-semibold">Declare availability</h2>
        <form
          action={actions?.createAvailability}
          className="mt-3 grid gap-3 md:grid-cols-4"
        >
          <input
            name="timezone"
            type="hidden"
            value={timezones[0] ?? "America/Los_Angeles"}
          />
          <label>
            <span className="text-sm">Start</span>
            <input
              className={input}
              name="startsAt"
              required
              type="datetime-local"
            />
          </label>
          <label>
            <span className="text-sm">End</span>
            <input
              className={input}
              name="endsAt"
              required
              type="datetime-local"
            />
          </label>
          <label>
            <span className="text-sm">Status</span>
            <select className={input} name="status">
              <option value="AVAILABLE">Available</option>
              <option value="UNAVAILABLE">Unavailable</option>
            </select>
          </label>
          <button
            className="min-h-11 rounded-lg bg-[var(--accent)] px-4 py-2 font-medium text-black md:col-span-4"
            type="submit"
          >
            Save availability
          </button>
        </form>
      </section>
    </div>
  );
}
