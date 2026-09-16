export const prototypeScreens = [
  {
    id: "active-shift",
    label: "Active Shift Report",
    group: "Mobile",
    viewport: "390×844",
  },
  {
    id: "add-activity",
    label: "Add Activity",
    group: "Mobile",
    viewport: "390×844",
  },
  {
    id: "timeline-incident",
    label: "Timeline with linked Incident",
    group: "Mobile",
    viewport: "390×844",
  },
  {
    id: "closeout-passdown",
    label: "Shift closeout and passdown",
    group: "Mobile",
    viewport: "390×844",
  },
  {
    id: "closeout-review",
    label: "Closeout review",
    group: "Mobile",
    viewport: "390×844",
  },
  {
    id: "incoming-passdown",
    label: "Incoming passdown",
    group: "Mobile",
    viewport: "390×844",
  },
  {
    id: "incident-form",
    label: "Security Incident form",
    group: "Mobile",
    viewport: "390×844",
  },
  {
    id: "participant-management",
    label: "Participant management",
    group: "Mobile",
    viewport: "390×844",
  },
  {
    id: "draft-restored",
    label: "Draft restored",
    group: "Mobile",
    viewport: "390×844",
  },
  {
    id: "network-failure",
    label: "Network/submission failure",
    group: "Mobile",
    viewport: "390×844",
  },
  {
    id: "correction-requested",
    label: "Correction requested",
    group: "Mobile",
    viewport: "390×844",
  },
  {
    id: "corrected-revision",
    label: "Corrected revision review",
    group: "Mobile",
    viewport: "390×844",
  },
  {
    id: "exception-queue",
    label: "Reporting exception queue",
    group: "Desktop",
    viewport: "1440×900",
  },
  {
    id: "review-dossier",
    label: "Shift Report review dossier",
    group: "Desktop",
    viewport: "1440×900",
  },
  {
    id: "desktop-correction",
    label: "Correction request",
    group: "Desktop",
    viewport: "1440×900",
  },
  {
    id: "revision-comparison",
    label: "Immutable revision comparison",
    group: "Desktop",
    viewport: "1440×900",
  },
  {
    id: "missing-late",
    label: "Missing/late Shift Report management",
    group: "Desktop",
    viewport: "1440×900",
  },
  {
    id: "empty-resolved",
    label: "Empty/resolved queue",
    group: "Desktop",
    viewport: "1440×900",
  },
  {
    id: "tablet-queue",
    label: "Review queue",
    group: "Tablet",
    viewport: "768×1024",
  },
  {
    id: "tablet-dossier",
    label: "Shift Report dossier",
    group: "Tablet",
    viewport: "768×1024",
  },
  {
    id: "tablet-correction",
    label: "Correction request",
    group: "Tablet",
    viewport: "768×1024",
  },
  {
    id: "tablet-revisions",
    label: "Revision comparison",
    group: "Tablet",
    viewport: "768×1024",
  },
  {
    id: "responsive-split",
    label: "Stacked-to-split-pane transition",
    group: "Responsive",
    viewport: "1024×768",
  },
  {
    id: "state-gallery",
    label: "Bounded state gallery",
    group: "States",
    viewport: "1440×900",
  },
] as const;

export type PrototypeScreenId = (typeof prototypeScreens)[number]["id"];

export type PrototypeActivity = {
  time: string;
  category: string;
  title: string;
  detail: string;
  incident?: string;
};

export const activityTimeline: readonly PrototypeActivity[] = [
  {
    time: "07:04",
    category: "Access control",
    title: "Morning vendor access completed",
    detail:
      "Verified Brightline Facilities crew against the approved access list at North Lobby.",
  },
  {
    time: "09:18",
    category: "Safety check",
    title: "Loading dock inspection",
    detail:
      "Dock doors secured; aisle three exit path cleared after delivery staging was moved.",
  },
  {
    time: "11:42",
    category: "Reportable incident",
    title: "Unauthorized access attempt",
    detail:
      "Visitor presented an expired contractor badge and was denied entry without escalation.",
    incident: "INC-2048",
  },
  {
    time: "14:26",
    category: "Observation",
    title: "Camera 12 intermittent",
    detail:
      "Video feed dropped twice; local view restored. Facilities follow-up requested.",
  },
];

export const shift = {
  site: "Cedar Plaza North",
  post: "North Lobby",
  guard: "Jordan Lee",
  time: "07:00–15:00",
  date: "Wednesday, September 16",
};
