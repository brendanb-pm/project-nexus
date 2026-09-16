"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  activityTimeline,
  prototypeScreens,
  shift,
  type PrototypeScreenId,
} from "./prototype-data";

const card =
  "rounded-2xl border border-white/10 bg-[var(--card)] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.18)]";
const input =
  "mt-1.5 min-h-12 w-full rounded-xl border border-white/15 bg-[#18191b] px-3 py-2 text-[15px] text-white outline-none placeholder:text-[#77787b] focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30";
const primary =
  "inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-3 font-bold text-white shadow-[0_8px_24px_rgba(217,85,42,.22)] outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#1b1b1d]";
const secondary =
  "inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 px-4 py-3 font-semibold text-white outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

function Mark() {
  return <span className="text-sm font-black tracking-[0.22em]">NEXUS</span>;
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
}) {
  const tones = {
    neutral: "border-white/15 bg-white/5 text-[#d4d1cc]",
    good: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    warn: "border-amber-400/35 bg-amber-400/10 text-amber-100",
    bad: "border-red-400/35 bg-red-400/10 text-red-100",
    info: "border-sky-400/35 bg-sky-400/10 text-sky-100",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function MobileShell({
  title,
  eyebrow = "Shift Report",
  children,
  footer = true,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: boolean;
}) {
  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-[var(--background)] pb-24 text-[var(--text-primary)]">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#17181a]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <Mark />
          <Pill tone="good">On shift</Pill>
        </div>
      </header>
      <main className="px-4 py-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--accent)]">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-[26px] font-bold leading-tight">{title}</h1>
        {children}
      </main>
      {footer ? (
        <nav
          aria-label="Guard navigation"
          className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[430px] border-t border-white/10 bg-[#17181a]/98 px-2 pb-[env(safe-area-inset-bottom)]"
        >
          <div className="grid grid-cols-4">
            <span className="grid min-h-16 place-items-center text-xs text-[var(--text-muted)]">
              Home
            </span>
            <span className="grid min-h-16 place-items-center text-xs text-[var(--text-muted)]">
              Schedule
            </span>
            <span className="grid min-h-16 place-items-center rounded-xl bg-[var(--accent)] text-xs font-bold text-white">
              Report
            </span>
            <span className="grid min-h-16 place-items-center text-xs text-[var(--text-muted)]">
              More
            </span>
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function ShiftContext({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`${card} mt-4`} aria-label="Active assignment">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">{shift.site}</p>
          <p className="text-sm text-[var(--text-muted)]">
            {shift.post} · {shift.time}
          </p>
        </div>
        <Pill tone="good">Active</Pill>
      </div>
      {!compact ? (
        <p className="mt-3 border-t border-white/10 pt-3 text-sm text-[#c9c6c1]">
          {shift.date} · {shift.guard}
        </p>
      ) : null}
    </section>
  );
}

function Timeline({
  linked = false,
  condensed = false,
}: {
  linked?: boolean;
  condensed?: boolean;
}) {
  const entries = condensed ? activityTimeline.slice(0, 3) : activityTimeline;
  return (
    <ol className="relative mt-4 grid gap-3 before:absolute before:bottom-5 before:left-[35px] before:top-5 before:w-px before:bg-white/10">
      {entries.map((entry) => (
        <li className={`${card} relative ml-10`} key={entry.time}>
          <span className="absolute -left-[52px] top-4 z-10 rounded-lg border border-white/15 bg-[#17181a] px-1.5 py-1 text-[11px] font-bold text-[#c8c5c0]">
            {entry.time}
          </span>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Pill tone={entry.incident ? "bad" : "neutral"}>
              {entry.category}
            </Pill>
            {entry.incident && linked ? (
              <Pill tone="bad">Linked · {entry.incident}</Pill>
            ) : null}
          </div>
          <h3 className="mt-2 font-bold">{entry.title}</h3>
          <p className="mt-1 text-sm leading-5 text-[#b8b5b0]">
            {entry.detail}
          </p>
          {entry.incident && linked ? (
            <button className="mt-3 min-h-12 w-full rounded-xl border border-red-400/30 bg-red-400/5 px-3 text-left text-sm font-bold text-red-100">
              Open Security Incident {entry.incident} <span aria-hidden>›</span>
            </button>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function ActiveShift() {
  return (
    <MobileShell title="Your active Shift Report">
      <ShiftContext />
      <section className="mt-5 grid grid-cols-2 gap-3">
        <button className={`${primary} col-span-2 text-base`}>
          ＋ Add activity
        </button>
        <button className={secondary}>File incident</button>
        <button className={secondary}>Closeout</button>
      </section>
      <div className="mt-6 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold">Today’s timeline</h2>
          <p className="text-sm text-[var(--text-muted)]">
            4 entries · 1 linked incident
          </p>
        </div>
        <Pill>Draft current</Pill>
      </div>
      <Timeline condensed />
    </MobileShell>
  );
}

function AddActivity() {
  const [saved, setSaved] = useState(false);
  return (
    <MobileShell eyebrow="Shift Report · Activity" title="Add activity">
      <ShiftContext compact />
      <form
        className="mt-5 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(true);
        }}
      >
        <label className="font-semibold">
          Activity type
          <select className={input} defaultValue="OBSERVATION">
            <option>Observation</option>
            <option>Access control</option>
            <option>Safety check</option>
            <option>Safety concern</option>
            <option>Reportable incident</option>
            <option>Customer service</option>
            <option>Other</option>
          </select>
        </label>
        <label className="font-semibold">
          What happened
          <textarea
            className={input}
            rows={5}
            defaultValue="Completed lobby and vestibule safety check. All access points secured."
          />
        </label>
        <label className="font-semibold">
          Location or context{" "}
          <span className="font-normal text-[var(--text-muted)]">
            (optional)
          </span>
          <input className={input} defaultValue="North Lobby vestibule" />
        </label>
        <label className="font-semibold">
          Action taken{" "}
          <span className="font-normal text-[var(--text-muted)]">
            (optional)
          </span>
          <input className={input} placeholder="Describe any response" />
        </label>
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 px-3">
          <input className="h-5 w-5 accent-[var(--accent)]" type="checkbox" />{" "}
          <span>Follow-up required</span>
        </label>
        {saved ? (
          <p
            className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-100"
            role="status"
          >
            Activity saved to this Shift Report.
          </p>
        ) : null}
        <div className="sticky bottom-20 grid grid-cols-[1fr_1.4fr] gap-3 bg-[var(--background)]/95 py-2 backdrop-blur">
          <button className={secondary} type="button">
            Cancel
          </button>
          <button className={primary}>Save activity</button>
        </div>
      </form>
    </MobileShell>
  );
}

function TimelineIncident() {
  return (
    <MobileShell title="Shift timeline">
      <ShiftContext compact />
      <div className="mt-5 flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">Chronological record</p>
        <Pill tone="info">4 entries</Pill>
      </div>
      <h2 className="sr-only">Timeline entries</h2>
      <Timeline linked />
    </MobileShell>
  );
}

function CloseoutForm() {
  return (
    <MobileShell
      eyebrow="Shift Report · Closeout"
      title="Closeout and passdown"
    >
      <div className="mt-3 rounded-xl border border-sky-400/30 bg-sky-400/10 p-3 text-sm text-sky-100">
        Your activity timeline is already included. Summarize material
        conditions and turnover information only.
      </div>
      <form className="mt-5 grid gap-4">
        <label className="font-semibold">
          Shift summary
          <textarea
            className={input}
            rows={4}
            defaultValue="Lobby operations remained stable. One denied access incident was documented. Camera 12 requires facilities follow-up."
          />
        </label>
        <fieldset className="grid gap-4 rounded-2xl border border-white/10 p-4">
          <legend className="px-1 font-bold">
            Passdown for incoming guard
          </legend>
          <label className="font-semibold">
            Unresolved issues
            <textarea
              className={input}
              rows={3}
              defaultValue="Camera 12 feed remains intermittent."
            />
          </label>
          <label className="font-semibold">
            Equipment or access condition
            <textarea
              className={input}
              rows={2}
              defaultValue="Lobby keys secured; radio 3 charging."
            />
          </label>
          <label className="font-semibold">
            Follow-up items
            <textarea
              className={input}
              rows={3}
              defaultValue="Confirm facilities ticket FP-882 before 17:00."
            />
          </label>
          <label className="font-semibold">
            Unusual conditions
            <textarea
              className={input}
              rows={2}
              defaultValue="Contractor badge issue documented in INC-2048."
            />
          </label>
        </fieldset>
        <button className={primary} type="button">
          Review closeout
        </button>
      </form>
    </MobileShell>
  );
}

function CloseoutReview() {
  return (
    <MobileShell
      eyebrow="Shift Report · Review"
      title="Review before finalizing"
    >
      <div className="mt-3 rounded-xl border border-amber-400/35 bg-amber-400/10 p-3 text-sm text-amber-100">
        <strong>Final submission</strong>
        <br />
        You can’t edit the original after submission. Corrections create a new
        audited revision.
      </div>
      <ShiftContext compact />
      <section className={`${card} mt-4`}>
        <h2 className="font-bold">Timeline</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          4 activity entries · 1 linked Security Incident
        </p>
        <button className="mt-3 min-h-12 text-sm font-bold text-[var(--accent)]">
          Review timeline
        </button>
      </section>
      <section className={`${card} mt-3 grid gap-3`}>
        <h2 className="font-bold">Closeout summary</h2>
        <p className="text-sm leading-5 text-[#c8c5c0]">
          Lobby operations stable. One denied access incident documented. Camera
          12 requires follow-up.
        </p>
        <div className="border-t border-white/10 pt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
            Incoming passdown
          </p>
          <p className="mt-1 text-sm">
            Camera 12 intermittent · confirm facilities ticket FP-882.
          </p>
        </div>
      </section>
      <label className="mt-4 flex min-h-11 items-center gap-3 text-sm">
        <input
          className="mt-1 h-5 w-5 accent-[var(--accent)]"
          type="checkbox"
          defaultChecked
        />
        <span>I reviewed the timeline and closeout information.</span>
      </label>
      <button className={`${primary} mt-5 w-full`}>
        Finalize Shift Report
      </button>
    </MobileShell>
  );
}

function IncomingPassdown() {
  return (
    <MobileShell eyebrow="Upcoming assignment" title="Incoming passdown">
      <div className="mt-3 flex items-center gap-2">
        <Pill tone="warn">Starts in 24 min</Pill>
        <span className="text-sm text-[var(--text-muted)]">15:00–23:00</span>
      </div>
      <ShiftContext compact />
      <section className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4">
        <p className="text-xs font-bold uppercase tracking-[.15em] text-amber-200">
          From outgoing guard · Jordan Lee
        </p>
        <h2 className="mt-2 text-lg font-bold">What needs your attention</h2>
        <dl className="mt-4 grid gap-4 text-sm">
          <div>
            <dt className="font-bold text-amber-100">Unresolved issue</dt>
            <dd className="mt-1 text-[#d8d3ca]">
              Camera 12 video feed remains intermittent.
            </dd>
          </div>
          <div>
            <dt className="font-bold text-amber-100">Equipment / access</dt>
            <dd className="mt-1 text-[#d8d3ca]">
              Lobby keys secured; radio 3 charging.
            </dd>
          </div>
          <div>
            <dt className="font-bold text-amber-100">Follow-up</dt>
            <dd className="mt-1 text-[#d8d3ca]">
              Confirm facilities ticket FP-882 before 17:00.
            </dd>
          </div>
        </dl>
        <button className={`${primary} mt-5 w-full`}>
          I’ve reviewed this passdown
        </button>
        <button className="mt-2 min-h-12 w-full text-sm font-bold text-[#d8d3ca]">
          Dismiss for now
        </button>
      </section>
      <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
        You can reopen this passdown from your Shift Report.
      </p>
    </MobileShell>
  );
}

function IncidentForm() {
  return (
    <MobileShell
      eyebrow="Security Incident Report"
      title="File security incident"
    >
      <div className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">
        Formal exception record · separate from routine Shift Report activity.
      </div>
      <form className="mt-5 grid gap-4">
        <label className="font-semibold">
          Related activity{" "}
          <span className="font-normal text-[var(--text-muted)]">
            (optional)
          </span>
          <select className={input} defaultValue="11:42">
            <option>11:42 · Unauthorized access attempt</option>
            <option>No related activity</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="font-semibold">
            Classification
            <select className={input}>
              <option>Security</option>
              <option>Safety</option>
              <option>Access</option>
              <option>Property</option>
              <option>Other</option>
            </select>
          </label>
          <label className="font-semibold">
            Severity
            <select className={input}>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Critical</option>
            </select>
          </label>
        </div>
        <label className="font-semibold">
          What happened
          <textarea
            className={input}
            rows={5}
            defaultValue="Visitor presented an expired contractor badge and attempted to proceed beyond reception."
          />
        </label>
        <label className="font-semibold">
          Immediate actions taken
          <textarea
            className={input}
            rows={3}
            defaultValue="Denied entry, retained lobby position, and notified site contact."
          />
        </label>
        <label className="font-semibold">
          External report number{" "}
          <span className="font-normal text-[var(--text-muted)]">
            (optional)
          </span>
          <input
            className={input}
            placeholder="Police, fire, or customer reference"
          />
        </label>
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 px-3">
          <input className="h-5 w-5 accent-[var(--accent)]" type="checkbox" />{" "}
          Emergency services involved
        </label>
        <button className={primary} type="button">
          Continue to participants
        </button>
      </form>
    </MobileShell>
  );
}

function ParticipantManagement() {
  return (
    <MobileShell
      eyebrow="Security Incident · Participants"
      title="People involved"
    >
      <p className="mt-2 text-sm leading-5 text-[var(--text-muted)]">
        Add known people connected to this incident. Do not estimate participant
        counts.
      </p>
      <section className={`${card} mt-4`}>
        <div className="flex items-center justify-between">
          <div>
            <Pill tone="info">Witness</Pill>
            <h2 className="mt-2 font-bold">Avery Morgan</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Front desk contractor
            </p>
          </div>
          <button className="min-h-12 px-3 text-sm font-bold text-[var(--accent)]">
            Edit
          </button>
        </div>
      </section>
      <form className="mt-4 grid gap-4 rounded-2xl border border-white/10 p-4">
        <h2 className="font-bold">Add participant</h2>
        <label className="font-semibold">
          Participant type
          <select className={input}>
            <option>Witness</option>
            <option>Involved person</option>
            <option>Reporting person</option>
            <option>Emergency responder</option>
          </select>
        </label>
        <label className="font-semibold">
          Name
          <input className={input} placeholder="Full name if known" />
        </label>
        <label className="font-semibold">
          Details{" "}
          <span className="font-normal text-[var(--text-muted)]">
            (optional)
          </span>
          <textarea
            className={input}
            rows={3}
            placeholder="Role or relevant context"
          />
        </label>
        <button className={secondary} type="button">
          ＋ Add participant
        </button>
      </form>
      <button className={`${primary} mt-5 w-full`}>
        Review incident report
      </button>
    </MobileShell>
  );
}

function DraftRestored() {
  return (
    <MobileShell eyebrow="Shift Report · Activity" title="Draft restored">
      <div
        className="mt-3 rounded-2xl border border-sky-400/35 bg-sky-400/10 p-4 text-sky-100"
        role="status"
      >
        <p className="font-bold">Your unfinished activity was restored</p>
        <p className="mt-1 text-sm">
          Saved at 10:16 on this device session. Review before submitting.
        </p>
      </div>
      <form className="mt-5 grid gap-4">
        <label className="font-semibold">
          Activity type
          <select className={input}>
            <option>Safety concern</option>
          </select>
        </label>
        <label className="font-semibold">
          What happened
          <textarea
            className={input}
            rows={7}
            defaultValue="Delivery pallets partially blocked the west stairwell exit. Vendor was asked to relocate them and complied before leaving the floor."
          />
        </label>
        <label className="font-semibold">
          Action taken
          <input
            className={input}
            defaultValue="Exit path cleared and rechecked."
          />
        </label>
        <div className="flex items-center justify-between text-sm">
          <span className="text-emerald-200">● Draft saved</span>
          <button className="min-h-12 font-bold text-[#d7d3ce]">
            Discard draft
          </button>
        </div>
        <button className={primary}>Save activity</button>
      </form>
    </MobileShell>
  );
}

function NetworkFailure() {
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => alertRef.current?.focus(), []);
  return (
    <MobileShell
      eyebrow="Shift Report · Activity"
      title="Submission needs attention"
    >
      <div
        className="mt-3 rounded-2xl border border-red-400/40 bg-red-400/10 p-4 text-red-100 outline-none focus-visible:ring-2 focus-visible:ring-white"
        ref={alertRef}
        role="alert"
        tabIndex={-1}
      >
        <p className="font-bold">Activity not confirmed</p>
        <p className="mt-1 text-sm leading-5">
          The connection dropped before Nexus confirmed the result. Your entered
          details are preserved.
        </p>
      </div>
      <section className={`${card} mt-4`}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Safety check</h2>
          <Pill tone="warn">Confirmation unknown</Pill>
        </div>
        <p className="mt-3 text-sm leading-5 text-[#c9c5bf]">
          West stairwell inspected after vendor delivery. Exit path is clear.
        </p>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Last attempt · 10:21
        </p>
      </section>
      <div className="mt-5 grid gap-3">
        <button className={primary}>Check submission status</button>
        <button className={secondary}>Keep editing</button>
      </div>
      <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
        Nexus will reconcile before offering another submit.
      </p>
    </MobileShell>
  );
}

function CorrectionRequested() {
  return (
    <MobileShell
      eyebrow="Shift Report · Correction"
      title="Correction requested"
    >
      <div className="mt-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4">
        <div className="flex items-center justify-between">
          <Pill tone="warn">Action required</Pill>
          <span className="text-xs text-[var(--text-muted)]">12:36</span>
        </div>
        <h2 className="mt-3 font-bold">Clarify equipment condition</h2>
        <p className="mt-2 text-sm leading-5 text-[#d8d3ca]">
          “Please identify which radio was left charging so the incoming guard
          can verify it.”
        </p>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Requested by Morgan Reyes · Operations Supervisor
        </p>
      </div>
      <section className={`${card} mt-4`}>
        <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
          Original submitted value
        </p>
        <p className="mt-2 text-sm">“Radio charging at desk.”</p>
      </section>
      <label className="mt-4 block font-semibold">
        Corrected detail
        <textarea
          className={input}
          rows={4}
          defaultValue="Radio 3 was placed in the North Lobby charging cradle at 14:48."
        />
      </label>
      <label className="mt-4 block font-semibold">
        Reason for correction
        <textarea
          className={input}
          rows={3}
          defaultValue="Added the equipment identifier requested by supervision."
        />
      </label>
      <button className={`${primary} mt-5 w-full`}>
        Submit corrected revision
      </button>
      <p className="mt-3 text-center text-xs text-[var(--text-muted)]">
        The original remains unchanged in audit history.
      </p>
    </MobileShell>
  );
}

function CorrectedRevision() {
  return (
    <MobileShell
      eyebrow="Shift Report · Revision history"
      title="Correction submitted"
    >
      <div
        className="mt-3 rounded-xl border border-emerald-400/35 bg-emerald-400/10 p-3 text-sm text-emerald-100"
        role="status"
      >
        <strong>Revision 1 recorded</strong>
        <br />
        Operations can now review the corrected detail.
      </div>
      <section className={`${card} mt-4`}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Equipment / access</h2>
          <Pill tone="good">Corrected</Pill>
        </div>
        <div className="mt-4 border-l-2 border-[var(--accent)] pl-3">
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
            Revision 1 · current
          </p>
          <p className="mt-1 text-sm">
            Radio 3 was placed in the North Lobby charging cradle at 14:48.
          </p>
        </div>
        <div className="mt-4 border-l-2 border-white/15 pl-3">
          <p className="text-xs font-bold uppercase text-[var(--text-muted)]">
            Original · preserved
          </p>
          <p className="mt-1 text-sm text-[#aaa7a2]">Radio charging at desk.</p>
        </div>
        <p className="mt-4 border-t border-white/10 pt-3 text-xs text-[var(--text-muted)]">
          Jordan Lee · 15:12 · Added equipment identifier requested by
          supervision.
        </p>
      </section>
      <button className={`${secondary} mt-5 w-full`}>
        Return to Shift Report
      </button>
    </MobileShell>
  );
}

function DesktopShell({
  title,
  eyebrow = "Reporting operations",
  children,
  active = "Review queue",
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  active?: string;
}) {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text-primary)] lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-r border-white/10 bg-[var(--sidebar)] p-6">
        <Mark />
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Security Operations
        </p>
        <nav aria-label="Operations navigation" className="mt-10 grid gap-2">
          {[
            "Overview",
            "Review queue",
            "Missing & late",
            "History",
            "Sites & posts",
          ].map((item) => (
            <span
              className={`rounded-xl px-3 py-3 text-sm font-bold ${item === active ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)]"}`}
              key={item}
            >
              {item}
            </span>
          ))}
        </nav>
        <div className="absolute bottom-6 text-xs text-[var(--text-muted)]">
          <p className="font-bold text-[#d7d3ce]">Morgan Reyes</p>
          <p>Operations Supervisor</p>
        </div>
      </aside>
      <main className="min-w-0 p-6 lg:p-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--accent)]">
              {eyebrow}
            </p>
            <h1 className="mt-1 text-3xl font-bold">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--text-muted)]">
              Cedar Branch
            </span>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10 font-bold">
              MR
            </span>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

const queueItems = [
  {
    tone: "bad" as const,
    status: "Late",
    title: "Shift Report closeout overdue",
    meta: "Cedar Plaza North · North Lobby",
    detail: "Shift ended 58 minutes ago · no closeout submitted",
    action: "Contact guard",
  },
  {
    tone: "warn" as const,
    status: "Correction requested",
    title: "Equipment condition needs clarification",
    meta: "Riverview Center · West Entrance",
    detail: "Supervisor request open for 22 minutes",
    action: "Open dossier",
  },
  {
    tone: "info" as const,
    status: "Review",
    title: "Security Incident INC-2048",
    meta: "Cedar Plaza North · North Lobby",
    detail: "High severity · linked to 11:42 activity",
    action: "Review incident",
  },
  {
    tone: "warn" as const,
    status: "Missing",
    title: "Shift Report activity absent",
    meta: "Summit Medical · Receiving",
    detail: "Active shift has no timeline entries after 5h 14m",
    action: "Review context",
  },
];

function QueueCards({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid gap-3">
      {queueItems.slice(0, compact ? 3 : 4).map((item) => (
        <article
          className={`${card} grid gap-3 md:grid-cols-[1fr_auto] md:items-center`}
          key={item.title}
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={item.tone}>{item.status}</Pill>
              <span className="text-xs text-[var(--text-muted)]">
                {item.meta}
              </span>
            </div>
            <h3 className="mt-2 font-bold">{item.title}</h3>
            <p className="mt-1 text-sm text-[#b8b5b0]">{item.detail}</p>
          </div>
          <button className={secondary}>{item.action}</button>
        </article>
      ))}
    </div>
  );
}

function ExceptionQueue({ tablet = false }: { tablet?: boolean }) {
  const shell = (
    <>
      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className={card}>
          <p className="text-sm text-[var(--text-muted)]">Open</p>
          <p className="mt-1 text-2xl font-bold">12</p>
        </div>
        <div className={card}>
          <p className="text-sm text-[var(--text-muted)]">Late</p>
          <p className="mt-1 text-2xl font-bold text-red-200">3</p>
        </div>
        <div className={card}>
          <p className="text-sm text-[var(--text-muted)]">Corrections</p>
          <p className="mt-1 text-2xl font-bold text-amber-200">4</p>
        </div>
        <div className={card}>
          <p className="text-sm text-[var(--text-muted)]">Incidents</p>
          <p className="mt-1 text-2xl font-bold text-sky-200">5</p>
        </div>
      </section>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Needs attention</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Exception-first · authorized scope only
          </p>
        </div>
        <div className="flex gap-2">
          <button className={secondary}>Filter</button>
          <button className={secondary}>Sort: urgency</button>
        </div>
      </div>
      <div className="mt-4">
        <QueueCards compact={tablet} />
      </div>
    </>
  );
  return tablet ? (
    <div className="min-h-screen bg-[var(--background)] p-5">
      <header className="flex items-center justify-between">
        <Mark />
        <Pill tone="info">Supervisor</Pill>
      </header>
      <main className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--accent)]">
          Reporting operations
        </p>
        <h1 className="mt-1 text-3xl font-bold">Review queue</h1>
        {shell}
      </main>
    </div>
  ) : (
    <DesktopShell title="Reporting exception queue">{shell}</DesktopShell>
  );
}

function DossierContent({ narrow = false }: { narrow?: boolean }) {
  return (
    <div
      className={`mt-6 grid gap-5 ${narrow ? "" : "xl:grid-cols-[1.25fr_.75fr]"}`}
    >
      <div className="grid gap-4">
        <section className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--text-muted)]">
                Cedar Plaza North · North Lobby
              </p>
              <h2 className="mt-1 text-xl font-bold">
                Jordan Lee · 07:00–15:00
              </h2>
            </div>
            <Pill tone="warn">Correction requested</Pill>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm">
            <div>
              <dt className="text-[var(--text-muted)]">Activity entries</dt>
              <dd className="mt-1 font-bold">4</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Linked incidents</dt>
              <dd className="mt-1 font-bold">1 · INC-2048</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Closeout</dt>
              <dd className="mt-1 font-bold">Submitted 15:02</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Revision</dt>
              <dd className="mt-1 font-bold">0 · original</dd>
            </div>
          </dl>
        </section>
        <section className={card}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Activity timeline</h2>
            <button className="min-h-12 text-sm font-bold text-[var(--accent)]">
              Expand all
            </button>
          </div>
          <Timeline linked condensed />
        </section>
      </div>
      <aside className="grid content-start gap-4">
        <section className={card}>
          <h2 className="text-lg font-bold">Closeout & passdown</h2>
          <p className="mt-3 text-sm leading-5 text-[#c8c5c0]">
            Lobby operations stable. One denied access incident documented.
          </p>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-[var(--text-muted)]">Unresolved</dt>
              <dd>Camera 12 intermittent</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Equipment / access</dt>
              <dd>Radio charging at desk</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Follow-up</dt>
              <dd>Confirm facilities ticket FP-882</dd>
            </div>
          </dl>
        </section>
        <section className="rounded-2xl border border-amber-400/35 bg-amber-400/10 p-4">
          <Pill tone="warn">Open request</Pill>
          <h2 className="mt-3 font-bold">Clarify equipment condition</h2>
          <p className="mt-2 text-sm text-[#d8d3ca]">
            Requested by Morgan Reyes · 12:36
          </p>
          <button className={`${secondary} mt-4 w-full`}>View request</button>
        </section>
      </aside>
    </div>
  );
}

function ReviewDossier({ tablet = false }: { tablet?: boolean }) {
  return tablet ? (
    <div className="min-h-screen bg-[var(--background)] p-5">
      <header className="flex items-center justify-between">
        <Mark />
        <Pill tone="info">Supervisor</Pill>
      </header>
      <main className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--accent)]">
          Review queue / Shift Report
        </p>
        <h1 className="mt-1 text-3xl font-bold">Review dossier</h1>
        <DossierContent narrow />
      </main>
    </div>
  ) : (
    <DesktopShell title="Shift Report review dossier">
      <DossierContent />
    </DesktopShell>
  );
}

function CorrectionPanel({ tablet = false }: { tablet?: boolean }) {
  const content = (
    <div
      className={`mt-6 grid gap-5 ${tablet ? "" : "xl:grid-cols-[1fr_420px]"}`}
    >
      <section className={card}>
        <p className="text-sm text-[var(--text-muted)]">
          Original Shift Report · Jordan Lee
        </p>
        <h2 className="mt-1 text-xl font-bold">Closeout details</h2>
        <dl className="mt-5 grid gap-5">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
              Equipment / access
            </dt>
            <dd className="mt-2 rounded-xl bg-white/[.04] p-3">
              Radio charging at desk.
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
              Unresolved issues
            </dt>
            <dd className="mt-2 rounded-xl bg-white/[.04] p-3">
              Camera 12 feed intermittent.
            </dd>
          </div>
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
              Follow-up
            </dt>
            <dd className="mt-2 rounded-xl bg-white/[.04] p-3">
              Confirm facilities ticket FP-882.
            </dd>
          </div>
        </dl>
      </section>
      <form className={`${card} grid content-start gap-4`}>
        <div>
          <Pill tone="warn">Creates an audited request</Pill>
          <h2 className="mt-3 text-xl font-bold">Request correction</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            The original submission remains immutable.
          </p>
        </div>
        <label className="font-semibold">
          Field needing clarification
          <select className={input}>
            <option>Equipment / access condition</option>
          </select>
        </label>
        <label className="font-semibold">
          What needs correction
          <textarea
            className={input}
            rows={5}
            defaultValue="Please identify which radio was left charging so the incoming guard can verify it."
          />
        </label>
        <label className="font-semibold">
          Operational priority
          <select className={input}>
            <option>Before next shift begins</option>
            <option>Routine follow-up</option>
          </select>
        </label>
        <button className={primary} type="button">
          Send correction request
        </button>
        <button className={secondary} type="button">
          Cancel
        </button>
      </form>
    </div>
  );
  return tablet ? (
    <div className="min-h-screen bg-[var(--background)] p-5">
      <header className="flex items-center justify-between">
        <Mark />
        <Pill tone="info">Supervisor</Pill>
      </header>
      <main className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--accent)]">
          Review dossier
        </p>
        <h1 className="mt-1 text-3xl font-bold">Request a correction</h1>
        {content}
      </main>
    </div>
  ) : (
    <DesktopShell title="Request a correction">{content}</DesktopShell>
  );
}

function RevisionComparison({ tablet = false }: { tablet?: boolean }) {
  const content = (
    <>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Pill tone="good">Revision 1 submitted</Pill>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Jordan Lee · 15:12 · awaiting review
          </p>
        </div>
        <button className={primary}>Acknowledge corrected revision</button>
      </div>
      <div className={`mt-5 grid gap-4 ${tablet ? "" : "lg:grid-cols-2"}`}>
        <section className={`${card} border-white/15`}>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
            Original · preserved
          </p>
          <h2 className="mt-2 text-lg font-bold">Equipment / access</h2>
          <p className="mt-4 rounded-xl bg-white/[.04] p-4 text-[#bbb8b3]">
            Radio charging at desk.
          </p>
          <p className="mt-4 text-xs text-[var(--text-muted)]">
            Submitted 15:02 · Revision 0
          </p>
        </section>
        <section
          className={`${card} border-emerald-400/30 bg-emerald-400/[.04]`}
        >
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-200">
            Corrected revision · current
          </p>
          <h2 className="mt-2 text-lg font-bold">Equipment / access</h2>
          <p className="mt-4 rounded-xl bg-emerald-400/[.06] p-4">
            Radio 3 was placed in the North Lobby charging cradle at 14:48.
          </p>
          <p className="mt-4 text-xs text-[var(--text-muted)]">
            Submitted 15:12 · Revision 1
          </p>
        </section>
      </div>
      <section className={`${card} mt-4`}>
        <h2 className="font-bold">Audit reason</h2>
        <p className="mt-2 text-sm">
          Added the equipment identifier requested by supervision.
        </p>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Correction request: Morgan Reyes · Submission: Jordan Lee
        </p>
      </section>
    </>
  );
  return tablet ? (
    <div className="min-h-screen bg-[var(--background)] p-5">
      <header className="flex items-center justify-between">
        <Mark />
        <Pill tone="info">Supervisor</Pill>
      </header>
      <main className="mt-6">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--accent)]">
          Shift Report · Revision history
        </p>
        <h1 className="mt-1 text-3xl font-bold">Compare revisions</h1>
        {content}
      </main>
    </div>
  ) : (
    <DesktopShell title="Immutable revision comparison">{content}</DesktopShell>
  );
}

function MissingLate() {
  return (
    <DesktopShell title="Missing & late Shift Reports" active="Missing & late">
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <h2 className="sr-only">Reporting exceptions</h2>
          <div className="flex flex-wrap gap-2">
            <Pill tone="bad">3 late</Pill>
            <Pill tone="warn">5 missing activity</Pill>
            <Pill tone="neutral">2 unknown</Pill>
          </div>
          <div className="mt-4">
            <QueueCards />
          </div>
        </div>
        <aside className={`${card} h-fit`}>
          <h2 className="text-lg font-bold">Selected exception</h2>
          <p className="mt-3 font-bold">Cedar Plaza North · North Lobby</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Shift ended 58 minutes ago
          </p>
          <dl className="mt-4 grid gap-3 border-t border-white/10 pt-4 text-sm">
            <div>
              <dt className="text-[var(--text-muted)]">Assigned guard</dt>
              <dd>Casey Patel</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Clock-out evidence</dt>
              <dd>15:06 · confirmed</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">
                Shift Report closeout
              </dt>
              <dd className="text-red-100">Not submitted</dd>
            </div>
          </dl>
          <button className={`${primary} mt-5 w-full`}>
            Contact assigned guard
          </button>
          <button className={`${secondary} mt-3 w-full`}>
            Record follow-up note
          </button>
        </aside>
      </div>
    </DesktopShell>
  );
}

function EmptyResolved() {
  return (
    <DesktopShell title="Reporting exception queue">
      <div className="mt-6 flex flex-wrap gap-2">
        <Pill tone="good">All caught up</Pill>
        <Pill>Last refreshed 15:24</Pill>
      </div>
      <section className="mt-10 grid min-h-[430px] place-items-center rounded-3xl border border-dashed border-white/15 bg-white/[.015] p-10 text-center">
        <div className="max-w-md">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-400/10 text-3xl text-emerald-200">
            ✓
          </div>
          <h2 className="mt-5 text-2xl font-bold">No reporting exceptions</h2>
          <p className="mt-2 leading-6 text-[var(--text-muted)]">
            All Shift Report and Security Incident obligations in your
            authorized scope are resolved.
          </p>
          <button className={`${secondary} mt-6`}>View resolved history</button>
        </div>
      </section>
    </DesktopShell>
  );
}

function ResponsiveSplit() {
  return (
    <div className="min-h-screen bg-[var(--background)] p-5 md:p-6">
      <header className="flex items-center justify-between">
        <Mark />
        <Pill tone="info">1024px transition</Pill>
      </header>
      <main className="mt-5">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--accent)]">
          Responsive review
        </p>
        <h1 className="mt-1 text-3xl font-bold">Shift Report workspace</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          At this width, queue context and selected dossier become a split pane.
          Below 960px they stack in reading order.
        </p>
        <div className="mt-5 grid gap-4 min-[960px]:grid-cols-[360px_1fr]">
          <section className={`${card} min-w-0`}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Review queue</h2>
              <Pill tone="warn">4 open</Pill>
            </div>
            <div className="mt-4 grid gap-3">
              {queueItems.slice(0, 3).map((item, index) => (
                <article
                  className={`rounded-xl border p-3 ${index === 1 ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-white/10"}`}
                  key={item.title}
                >
                  <Pill tone={item.tone}>{item.status}</Pill>
                  <p className="mt-2 font-bold">{item.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {item.meta}
                  </p>
                </article>
              ))}
            </div>
          </section>
          <section className={`${card} min-w-0`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm text-[var(--text-muted)]">
                  Selected Shift Report
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  Riverview Center · West Entrance
                </h2>
              </div>
              <Pill tone="warn">Correction requested</Pill>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-white/[.04] p-4">
                <p className="text-xs uppercase text-[var(--text-muted)]">
                  Original
                </p>
                <p className="mt-2 text-sm">Radio charging at desk.</p>
              </div>
              <div className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-4">
                <p className="text-xs uppercase text-amber-200">Request</p>
                <p className="mt-2 text-sm">
                  Identify which radio was left charging.
                </p>
              </div>
            </div>
            <button className={`${primary} mt-5`}>Open full dossier</button>
          </section>
        </div>
      </main>
    </div>
  );
}

const states = [
  ["Normal", "Ready for activity", "good"],
  ["Empty", "No timeline entries yet", "neutral"],
  ["Loading", "Loading authorized Shift Report…", "info"],
  ["Validation failure", "2 fields need attention", "bad"],
  ["Unsaved changes", "Changes not saved", "warn"],
  ["Saving draft", "Saving interrupted work…", "info"],
  ["Draft saved", "Saved at 10:16", "good"],
  ["Restored draft", "Unfinished entry restored", "info"],
  ["Expired draft", "Draft expired; start a new entry", "neutral"],
  ["Degraded network", "Connection is unstable", "warn"],
  ["Submission pending", "Waiting for server confirmation", "info"],
  ["Submission confirmed", "Activity recorded", "good"],
  ["Submission failed", "Details preserved; retry safely", "bad"],
  ["Stale update", "A newer revision exists", "warn"],
  ["Correction requested", "Guard action required", "warn"],
  ["Corrected revision", "Revision 1 submitted", "good"],
  ["Permission denied", "Not available in your scope", "bad"],
  ["Session expired", "Sign in again to continue", "bad"],
  ["Unavailable record", "Record may be stale or out of scope", "neutral"],
] as const;

function StateGallery() {
  return (
    <DesktopShell
      title="Shift Report state gallery"
      eyebrow="Prototype system states"
    >
      <p className="mt-2 max-w-3xl text-[var(--text-muted)]">
        Bounded examples show stable recovery language without prescribing draft
        storage or offline architecture.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {states.map(([name, detail, tone]) => (
          <article className={card} key={name}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-bold">{name}</h2>
              <Pill tone={tone}>State</Pill>
            </div>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{detail}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className={`h-full w-2/3 rounded-full ${tone === "bad" ? "bg-red-400" : tone === "warn" ? "bg-amber-400" : tone === "good" ? "bg-emerald-400" : tone === "info" ? "bg-sky-400" : "bg-white/20"}`}
              />
            </div>
          </article>
        ))}
      </div>
    </DesktopShell>
  );
}

export function PrototypeIndex() {
  const groups = [...new Set(prototypeScreens.map((screen) => screen.group))];
  return (
    <div className="min-h-screen bg-[var(--background)] px-5 py-8 text-[var(--text-primary)] md:px-10">
      <header className="mx-auto max-w-6xl">
        <Mark />
        <p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-[var(--accent)]">
          Isolated visual prototype · synthetic data only
        </p>
        <h1 className="mt-2 text-4xl font-bold">Unified Shift Report</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[var(--text-muted)]">
          One guard-facing Shift Report composes the activity timeline, linked
          incidents, closeout, and passdown. Security Incident Report remains a
          separate formal workflow.
        </p>
      </header>
      <main className="mx-auto mt-10 grid max-w-6xl gap-8">
        {groups.map((group) => (
          <section key={group}>
            <h2 className="text-xl font-bold">{group}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {prototypeScreens
                .filter((screen) => screen.group === group)
                .map((screen) => (
                  <Link
                    className={`${card} block transition hover:-translate-y-0.5 hover:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]`}
                    href={`/prototype/unified-shift-report/${screen.id}`}
                    key={screen.id}
                  >
                    <p className="text-xs font-bold text-[var(--accent)]">
                      {String(prototypeScreens.indexOf(screen) + 1).padStart(
                        2,
                        "0",
                      )}{" "}
                      · {screen.viewport}
                    </p>
                    <h3 className="mt-2 font-bold">{screen.label}</h3>
                  </Link>
                ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

export function PrototypeScreen({ screen }: { screen: PrototypeScreenId }) {
  switch (screen) {
    case "active-shift":
      return <ActiveShift />;
    case "add-activity":
      return <AddActivity />;
    case "timeline-incident":
      return <TimelineIncident />;
    case "closeout-passdown":
      return <CloseoutForm />;
    case "closeout-review":
      return <CloseoutReview />;
    case "incoming-passdown":
      return <IncomingPassdown />;
    case "incident-form":
      return <IncidentForm />;
    case "participant-management":
      return <ParticipantManagement />;
    case "draft-restored":
      return <DraftRestored />;
    case "network-failure":
      return <NetworkFailure />;
    case "correction-requested":
      return <CorrectionRequested />;
    case "corrected-revision":
      return <CorrectedRevision />;
    case "exception-queue":
      return <ExceptionQueue />;
    case "review-dossier":
      return <ReviewDossier />;
    case "desktop-correction":
      return <CorrectionPanel />;
    case "revision-comparison":
      return <RevisionComparison />;
    case "missing-late":
      return <MissingLate />;
    case "empty-resolved":
      return <EmptyResolved />;
    case "tablet-queue":
      return <ExceptionQueue tablet />;
    case "tablet-dossier":
      return <ReviewDossier tablet />;
    case "tablet-correction":
      return <CorrectionPanel tablet />;
    case "tablet-revisions":
      return <RevisionComparison tablet />;
    case "responsive-split":
      return <ResponsiveSplit />;
    case "state-gallery":
      return <StateGallery />;
  }
}
