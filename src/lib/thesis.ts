import { useEffect, useState } from "react";
import type { Founder, Sector, Stage } from "@/data/matchfund";

// Investor thesis — collected during onboarding, stored locally.
// This is the "Investment" phase of the Hooked loop: the more the
// investor tells us, the sharper tomorrow's deck feels.

export type Thesis = {
  stages: Stage[];
  sectors: Sector[];
  keywords?: string[];
  technicalThemes?: string[];
  preferredLanguages?: string[];
  founderArchetypes?: string[];
  desiredSignals?: string[];
  activityRecencyDays?: number;
  exclusions?: string[];
  technicalBuilderRequired?: boolean;
  weights: { technical: number; traction: number; fmf: number };
  geos: string[]; // e.g. "US", "EU", "Asia", "LatAm", "Africa", "Remote"
  checkMin: number; // in $k
  checkMax: number;
  digestEmail: boolean;
  seenCoachMark?: boolean;
  swipeCount?: number;
};

export const DEFAULT_THESIS: Thesis = {
  stages: [],
  sectors: [],
  keywords: [],
  technicalThemes: [],
  preferredLanguages: [],
  founderArchetypes: [],
  desiredSignals: [],
  activityRecencyDays: 365,
  exclusions: [],
  weights: { technical: 34, traction: 33, fmf: 33 },
  geos: [],
  checkMin: 25,
  checkMax: 250,
  digestEmail: true,
  seenCoachMark: false,
  swipeCount: 0,
};

const KEY = "mf.thesis.v1";

export function loadThesis(): Thesis | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return { ...DEFAULT_THESIS, ...JSON.parse(raw) } as Thesis;
  } catch {
    return null;
  }
}

export function saveThesis(t: Thesis) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(t));
  // Notify listeners in the same tab.
  window.dispatchEvent(new CustomEvent("mf-thesis-change"));
}

export function clearThesis() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("mf-thesis-change"));
}

export function useThesis(): [Thesis | null, (t: Thesis) => void, boolean] {
  const [thesis, setThesis] = useState<Thesis | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setThesis(loadThesis());
    setHydrated(true);
    const onChange = () => setThesis(loadThesis());
    window.addEventListener("mf-thesis-change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("mf-thesis-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  const update = (t: Thesis) => {
    saveThesis(t);
    setThesis(t);
  };
  return [thesis, update, hydrated];
}

// --- Scoring --------------------------------------------------------------

// Rough region mapping from location strings in mock data.
function inferGeo(location: string): string {
  const l = location.toLowerCase();
  if (/(san francisco|new york|austin|boston|seattle|remote us|,\s*(ca|ny|tx|ma|wa))/.test(l))
    return "US";
  if (/(london|berlin|paris|amsterdam|zurich|barcelona|dublin|stockholm|lisbon)/.test(l))
    return "EU";
  if (/(singapore|tokyo|seoul|shanghai|beijing|bangalore|mumbai|hong kong)/.test(l)) return "Asia";
  if (/(são paulo|sao paulo|mexico|buenos aires|santiago|bogot)/.test(l)) return "LatAm";
  if (/(lagos|nairobi|cape town|cairo|johannesburg)/.test(l)) return "Africa";
  if (/remote/.test(l)) return "Remote";
  return "Other";
}

export type MatchScore = {
  total: number; // 0-100
  parts: {
    stage: number;
    sector: number;
    technical: number;
    traction: number;
    fmf: number;
    geo: number;
  };
  reasons: string[];
  isRareFind: boolean;
};

// Weighted, transparent scorer. Not ML — just an explainable sum, which is
// what an early-stage investor product actually needs.
export function computeMatch(f: Founder, t: Thesis): MatchScore {
  const reasons: string[] = [];

  // Stage match: soft bonus, not a hard filter (we still show near-fit
  // stages so the deck doesn't dead-end).
  const stageMatch = t.stages.length === 0 || t.stages.includes(f.stage);
  const stage = stageMatch ? 100 : 40;
  if (stageMatch && t.stages.length) reasons.push(`${f.stage} focus`);

  // Sector match.
  const sectorMatch = t.sectors.length === 0 || t.sectors.includes(f.sector);
  const sector = sectorMatch ? 100 : 30;
  if (sectorMatch && t.sectors.length) reasons.push(`${f.sector} sector`);

  // Technical depth signal: GitHub activity + prior projects + arXiv-ish.
  const gh =
    f.signals.githubActivity === "High" ? 100 : f.signals.githubActivity === "Med" ? 65 : 35;
  const priors = Math.min(100, f.signals.priorProjects * 25);
  const technical = Math.round(gh * 0.6 + priors * 0.4);
  if (technical >= 80) reasons.push("Deep technical signal");

  // Traction: hackathon wins + traction score from data.
  const hackBoost = Math.min(100, f.signals.hackathonWins * 40);
  const traction = Math.round(f.scores.traction * 0.6 + hackBoost * 0.4);
  if (f.signals.hackathonWins >= 2) reasons.push(`${f.signals.hackathonWins}× hackathon wins`);

  // Founder-Market Fit: trust score + fit breakdown domain/market.
  const fmf = Math.round((f.scores.trust + f.fitBreakdown.domain + f.fitBreakdown.market) / 3);
  if (fmf >= 85) reasons.push("Strong founder-market fit");

  // Geography.
  const geoOfFounder = inferGeo(f.location);
  const geoMatch = t.geos.length === 0 || t.geos.includes(geoOfFounder);
  const geo = geoMatch ? 100 : 50;

  // Weighted sum. Signal weights normalized from thesis sliders.
  const wSum = Math.max(1, t.weights.technical + t.weights.traction + t.weights.fmf);
  const wT = t.weights.technical / wSum;
  const wR = t.weights.traction / wSum;
  const wF = t.weights.fmf / wSum;

  const signalScore = technical * wT + traction * wR + fmf * wF;
  // Structural weights: signals 55%, stage 15%, sector 20%, geo 10%.
  const total = Math.round(signalScore * 0.55 + stage * 0.15 + sector * 0.2 + geo * 0.1);

  return {
    total,
    parts: { stage, sector, technical, traction, fmf, geo },
    reasons: reasons.slice(0, 3),
    isRareFind: total >= 90,
  };
}

export function rankFounders(list: Founder[], thesis: Thesis) {
  return list
    .map((f) => ({ founder: f, match: computeMatch(f, thesis) }))
    .sort((a, b) => b.match.total - a.match.total);
}

// --- Onboarding option constants -----------------------------------------

export const STAGE_OPTIONS: { value: Stage; label: string; hint: string }[] = [
  { value: "Idea", label: "Pre-idea", hint: "Just an insight or wedge" },
  { value: "Hackathon", label: "Hackathon", hint: "Weekend build, demo shipped" },
  { value: "Prototype", label: "Prototype", hint: "Working v0, no users yet" },
  { value: "Pre-seed", label: "Pre-seed", hint: "Early users, raising first round" },
  { value: "Seed", label: "Seed", hint: "Traction, raising to scale" },
];

export const SECTOR_OPTIONS: Sector[] = [
  "AI",
  "Climate",
  "Fintech",
  "Bio",
  "Devtools",
  "Robotics",
  "Consumer",
];

export const GEO_OPTIONS = ["US", "EU", "Asia", "LatAm", "Africa", "Remote"];
