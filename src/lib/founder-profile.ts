// Canonical founder profile shape used by the Founder workspace and the
// "How Investors See Me" read-only preview. Kept intentionally frontend-only:
// the CTO owns the backing table shape, and this module maps to/from that
// contract in `src/services/founderProfileService.ts`.
//
// Provenance labels drive the small chips ("Verified", "Publicly observed",
// "Founder-provided", "Inferred", "Missing") shown next to fields. Never
// invent a "Verified" label from thin air — use "Founder-provided" for
// values typed into the editor, "Publicly observed" for values that came
// out of the Signal Crawl, and "Missing" when a field is empty.

import type { Provenance } from "@/lib/founder-metrics";

export type FounderStage =
  | "idea"
  | "prototype"
  | "mvp"
  | "pre-seed"
  | "seed"
  | "growth";

export const FOUNDER_STAGES: { value: FounderStage; label: string }[] = [
  { value: "idea", label: "Idea" },
  { value: "prototype", label: "Prototype" },
  { value: "mvp", label: "MVP in market" },
  { value: "pre-seed", label: "Pre-seed" },
  { value: "seed", label: "Seed" },
  { value: "growth", label: "Growth" },
];

export type FundraisingStatus =
  | "not-raising"
  | "planning"
  | "raising"
  | "closed";

export const FUNDRAISING_STATUSES: { value: FundraisingStatus; label: string }[] = [
  { value: "not-raising", label: "Not raising" },
  { value: "planning", label: "Planning a round" },
  { value: "raising", label: "Actively raising" },
  { value: "closed", label: "Round closed" },
];

export type ContactAvailability = "open" | "warm-intro" | "closed";

export const CONTACT_AVAILABILITIES: { value: ContactAvailability; label: string }[] = [
  { value: "open", label: "Open to intros" },
  { value: "warm-intro", label: "Warm intro only" },
  { value: "closed", label: "Not taking meetings" },
];

export type FounderProject = {
  id: string;
  name: string;
  description?: string;
  url?: string;
  stars?: number;
  provenance?: Provenance;
};

export type FounderSignal = {
  id: string;
  kind: string; // e.g. "repo", "publication", "hackathon", "site"
  label: string;
  source?: string; // e.g. "GitHub", "arXiv"
  url?: string;
  provenance?: Provenance;
};

export type FounderProfile = {
  name: string;
  headline: string;
  location: string;
  biography: string;
  currentCompany: string;
  sectors: string[];
  skills: string[];
  stage: FounderStage | "";
  github: string;
  linkedin: string;
  site: string;
  deckText: string;
  projects: FounderProject[];
  signals: FounderSignal[];
  strongestSignal: string;
  fundraisingStatus: FundraisingStatus | "";
  contactAvailability: ContactAvailability | "";
  verified: boolean;
  published: boolean;
  lastUpdatedAt?: string;
  // Wizard progress marker — retained for backwards compatibility with the
  // existing draft shape.
  reviewed?: boolean;
};

export const EMPTY_FOUNDER_PROFILE: FounderProfile = {
  name: "",
  headline: "",
  location: "",
  biography: "",
  currentCompany: "",
  sectors: [],
  skills: [],
  stage: "",
  github: "",
  linkedin: "",
  site: "",
  deckText: "",
  projects: [],
  signals: [],
  strongestSignal: "",
  fundraisingStatus: "",
  contactAvailability: "",
  verified: false,
  published: false,
  reviewed: false,
};

// Weighted profile completeness — mirrors the fields investors expect to
// see. Weights sum to 100; publication/verification are surfaced separately
// and don't count here.
const COMPLETION_WEIGHTS: {
  key: keyof FounderProfile;
  weight: number;
  filled: (p: FounderProfile) => boolean;
}[] = [
  { key: "name", weight: 10, filled: (p) => p.name.trim().length > 0 },
  { key: "headline", weight: 10, filled: (p) => p.headline.trim().length > 0 },
  { key: "biography", weight: 12, filled: (p) => p.biography.trim().length >= 40 },
  { key: "location", weight: 5, filled: (p) => p.location.trim().length > 0 },
  { key: "currentCompany", weight: 8, filled: (p) => p.currentCompany.trim().length > 0 },
  { key: "sectors", weight: 8, filled: (p) => p.sectors.length > 0 },
  { key: "skills", weight: 8, filled: (p) => p.skills.length > 0 },
  { key: "stage", weight: 5, filled: (p) => p.stage !== "" },
  { key: "github", weight: 10, filled: (p) => p.github.trim().length > 0 },
  { key: "linkedin", weight: 4, filled: (p) => p.linkedin.trim().length > 0 },
  { key: "site", weight: 4, filled: (p) => p.site.trim().length > 0 },
  { key: "projects", weight: 6, filled: (p) => p.projects.length > 0 },
  { key: "signals", weight: 4, filled: (p) => p.signals.length > 0 },
  { key: "fundraisingStatus", weight: 3, filled: (p) => p.fundraisingStatus !== "" },
  { key: "contactAvailability", weight: 3, filled: (p) => p.contactAvailability !== "" },
];

export function computeCompletion(p: FounderProfile): {
  percent: number;
  missing: { key: string; weight: number }[];
} {
  const missing: { key: string; weight: number }[] = [];
  let earned = 0;
  for (const rule of COMPLETION_WEIGHTS) {
    if (rule.filled(p)) earned += rule.weight;
    else missing.push({ key: String(rule.key), weight: rule.weight });
  }
  return { percent: Math.min(100, Math.round(earned)), missing };
}

// Provenance chip helper for the workspace/preview views.
export function provenanceFor(p: FounderProfile, key: keyof FounderProfile): Provenance {
  switch (key) {
    case "signals":
    case "projects":
      // These arrays are populated by the Signal Crawl (publicly observed)
      // once at least one entry marked "observed" exists; otherwise the
      // founder typed them.
      if (Array.isArray(p[key])) {
        const arr = p[key] as { provenance?: Provenance }[];
        if (arr.length === 0) return "missing";
        if (arr.some((x) => x.provenance === "observed")) return "observed";
        return "self-reported";
      }
      return "missing";
    case "github":
    case "linkedin":
    case "site":
      if (!(p[key] as string)?.trim()) return "missing";
      // GitHub is only marked verified after the crawl succeeds; we
      // approximate here as "self-reported" — the crawl result upgrades
      // it. LinkedIn/site are self-reported.
      return "self-reported";
    default: {
      const value = p[key];
      if (Array.isArray(value)) return value.length > 0 ? "self-reported" : "missing";
      if (typeof value === "string") return value.trim().length > 0 ? "self-reported" : "missing";
      if (typeof value === "boolean") return "self-reported";
      return "missing";
    }
  }
}

// ---------------------------------------------------------------------------
// DEMO profile — used ONLY inside /demo/founder/* so the video walkthrough
// always renders a complete Founder journey without depending on the crawl
// or a live backend. Never persisted; never touched by production writes.
// ---------------------------------------------------------------------------
export const DEMO_FOUNDER_PROFILE: FounderProfile = {
  name: "Alex Chen",
  headline: "Building open-source telemetry for climate infrastructure",
  location: "Berlin, Germany",
  biography:
    "Former staff engineer at a climate-tech unicorn. Now building an open protocol for real-time carbon flux telemetry across grid, industrial, and land-use sensors. Two prior exits (acqui-hire and Series B secondary). Ex-CERN research fellow.",
  currentCompany: "Fluxline (stealth)",
  sectors: ["Climate", "Developer tools", "Hardware", "Data infrastructure"],
  skills: ["Distributed systems", "Rust", "Time-series DB", "Edge computing", "Sensor networks"],
  stage: "pre-seed",
  github: "alex-chen",
  linkedin: "https://linkedin.com/in/alexchen",
  site: "https://fluxline.io",
  deckText:
    "Fluxline is the missing protocol layer for continuous carbon telemetry. We turn any grid sensor into a verifiable data source.",
  projects: [
    {
      id: "p1",
      name: "fluxline-core",
      description: "Rust reference implementation of the Fluxline telemetry protocol",
      url: "https://github.com/alex-chen/fluxline-core",
      stars: 1240,
      provenance: "observed",
    },
    {
      id: "p2",
      name: "carbon-edge",
      description: "Edge agent for constrained industrial gateways",
      url: "https://github.com/alex-chen/carbon-edge",
      stars: 318,
      provenance: "observed",
    },
    {
      id: "p3",
      name: "gridmap",
      description: "Open dataset of European grid carbon intensity",
      url: "https://github.com/alex-chen/gridmap",
      stars: 92,
      provenance: "observed",
    },
  ],
  signals: [
    {
      id: "s1",
      kind: "repo",
      label: "1,240 stars · fluxline-core",
      source: "GitHub",
      url: "https://github.com/alex-chen/fluxline-core",
      provenance: "observed",
    },
    {
      id: "s2",
      kind: "publication",
      label: "Verifiable carbon telemetry at scale (arXiv)",
      source: "arXiv",
      url: "https://arxiv.org/abs/2401.00001",
      provenance: "observed",
    },
    {
      id: "s3",
      kind: "hackathon",
      label: "Winner · EnergyWeb Hack Berlin 2024",
      source: "Devpost",
      provenance: "observed",
    },
    {
      id: "s4",
      kind: "site",
      label: "fluxline.io · protocol spec published",
      source: "Web",
      url: "https://fluxline.io",
      provenance: "observed",
    },
  ],
  strongestSignal:
    "Open-source protocol adopted by 3 grid operators in 6 months — 1.2k stars, external contributors across 4 EU countries.",
  fundraisingStatus: "raising",
  contactAvailability: "warm-intro",
  verified: true,
  published: true,
  lastUpdatedAt: new Date().toISOString(),
  reviewed: true,
};
