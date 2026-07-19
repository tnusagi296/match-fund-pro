// Canonical founder metric module.
//
// Every surface — Discover card, Founder Overview, Idea tab, Traction tab,
// Pipeline, and Grants recommendations — must derive founder metrics from
// this file. Do not re-derive Fit / Idea / Traction anywhere else, and do
// not hardcode substitute demo values silently.

export type Provenance =
  | "verified" // cryptographically or authoritatively confirmed
  | "observed" // publicly observed (crawler-scraped, cached)
  | "self-reported" // founder-provided
  | "inferred" // derived heuristic from other signals
  | "missing"; // not enough data — DO NOT substitute

export type Metric = {
  value: number | null; // 0–100, or null when missing
  provenance: Provenance;
  label: string; // display value ("74" or "Not enough evidence")
};

export type CanonicalMetrics = {
  founderFit: Metric;
  ideaStrength: Metric;
  tractionStrength: Metric;
  evidenceCount: number;
  // hasSufficientDataForPersonalization: true only when we have enough
  // real signals to present metrics as personalized scores.
  hasSufficientDataForPersonalization: boolean;
};

const MISSING_LABEL = "Not enough evidence";
const MISSING_LABEL_ALT = "No verified data";

function metric(value: number | null | undefined, provenance: Provenance): Metric {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { value: null, provenance: "missing", label: MISSING_LABEL };
  }
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return { value: clamped, provenance, label: String(clamped) };
}

/**
 * Compute canonical metrics from a shape-agnostic source. Every existing
 * founder shape (demo `Founder`, `GraphFounderCard`, DB row) should be
 * projected into `MetricSource` before this call — never invented.
 */
export type MetricSource = {
  founderFit?: number | null;
  founderFitProvenance?: Provenance;
  ideaStrength?: number | null;
  ideaStrengthProvenance?: Provenance;
  tractionStrength?: number | null;
  tractionStrengthProvenance?: Provenance;
  evidenceCount?: number;
};

export function buildMetrics(src: MetricSource): CanonicalMetrics {
  const founderFit = metric(src.founderFit ?? null, src.founderFitProvenance ?? "inferred");
  const ideaStrength = metric(src.ideaStrength ?? null, src.ideaStrengthProvenance ?? "inferred");
  const tractionStrength = metric(
    src.tractionStrength ?? null,
    src.tractionStrengthProvenance ?? "inferred",
  );
  const evidenceCount = src.evidenceCount ?? 0;
  // Personalization requires at least two real observations, not just a
  // single inferred number. Demo-only surfaces must fall through to false.
  const realish = [founderFit, ideaStrength, tractionStrength].filter(
    (m) => m.value !== null && (m.provenance === "verified" || m.provenance === "observed"),
  ).length;
  return {
    founderFit,
    ideaStrength,
    tractionStrength,
    evidenceCount,
    hasSufficientDataForPersonalization: realish >= 2 && evidenceCount >= 2,
  };
}

export function formatMetric(m: Metric, altMissing = false): string {
  if (m.provenance === "missing" || m.value === null) {
    return altMissing ? MISSING_LABEL_ALT : MISSING_LABEL;
  }
  return m.label;
}

export const PROVENANCE_COPY: Record<Provenance, string> = {
  verified: "Verified",
  observed: "Publicly observed",
  "self-reported": "Founder-provided",
  inferred: "Inferred",
  missing: "Missing",
};
