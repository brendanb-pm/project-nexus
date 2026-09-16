# Unified Shift Report visual prototype

Product Owner review artifact for Sprint 8 reporting discovery. This is an isolated, synthetic-data prototype; it does not call production services or change reporting persistence, routes, authorization, or historical records.

## Product contract represented

- One guard-facing **Shift Report** combines the canonical `ActivityEntry` timeline, linked Security Incident Reports, and EOSR-backed closeout/passdown.
- Security Incident Reporting remains a separate formal exception workflow that can link to the Shift Report and originating activity.
- Finalized originals are immutable; corrections append an audited revision.
- The supervisor experience is exception-first and scoped to authorized records.
- Historical handoffs, `daily_activity_reports`, payroll/timekeeping, storage authority, and retention implementation remain outside this visual prototype.

## Captures

Each numbered `.png` is an exact viewport capture. Each `-full-page.png` companion preserves the complete long-form page for review.

| Group | Viewport | Screens |
| --- | --- | --- |
| Mobile | 390 × 844 | 01–12: active shift, activity capture, linked incident timeline, closeout/passdown, final review, incoming passdown, incident form, participants, restored draft, network failure, correction requested, corrected revision |
| Desktop | 1440 × 900 | 13–18: exception queue, review dossier, correction request, immutable comparison, missing/late, empty/resolved |
| Tablet | 768 × 1024 | 19–22: queue, dossier, correction request, revision comparison |
| Responsive | 1024 × 768 | 23: stacked-to-split review workspace |
| States | 1440 × 900 | 24: bounded state gallery |

## Review ownership

Product Owner feedback should decide language, information priority, exception policy, and whether each screen expresses the approved unified Shift Report model. Engineering follow-up should validate implementation feasibility, service composition, authorization, persistence, draft/retry architecture, and route migration. Visual polish can proceed only after those product and engineering decisions are recorded.

## Reproduce

Run the app on port `3100`, then:

```powershell
npx tsx scripts/prototype/capture-unified-shift-report.ts
npx tsx scripts/prototype/audit-unified-shift-report.ts
```
