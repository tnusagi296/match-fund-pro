import { HelpCircle, X } from "lucide-react";
import { useState } from "react";

type ScoreDef = {
  key: string;
  label: string;
  color: string;
  description: string;
};

const SCORES: ScoreDef[] = [
  {
    key: "founder-fit",
    label: "Founder Fit",
    color: "var(--mint)",
    description:
      "Strength and relevance of the founder profile — background, prior building, and domain proximity. Higher means the founder's track record aligns with what typically succeeds at pre-seed.",
  },
  {
    key: "idea-strength",
    label: "Idea Strength",
    color: "oklch(0.8 0.15 210)",
    description:
      "Quality, clarity, and differentiation of the project. Reflects how well the wedge, insight, and target user are articulated — not commercial validation.",
  },
  {
    key: "traction-strength",
    label: "Traction Strength",
    color: "oklch(0.82 0.16 145)",
    description:
      "Observed adoption, growth, or shipping signals: repository activity, hackathon results, pilots, users, launches. Absence is 'insufficient evidence', not a low score.",
  },
  {
    key: "thesis-match",
    label: "Thesis Match",
    color: "var(--mint)",
    description:
      "Alignment with YOUR investment thesis — stages, sectors, geography, and preferred signals. Personal to your account. Changes when you edit your thesis.",
  },
  {
    key: "evidence-confidence",
    label: "Evidence Confidence",
    color: "var(--amber)",
    description:
      "Quality and reliability of the underlying evidence: how many independent sources agree, how recent they are, and how directly they support each claim.",
  },
];

export function ScoreHelpButton({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-full glass-subtle px-3 py-1.5 text-[11px] text-muted-foreground transition hover:text-foreground ${className}`}
        title="How scoring works"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        {!compact && <span>How scoring works</span>}
      </button>
      {open && <ScoreHelpDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function ScoreHelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="How scoring works"
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-border bg-elevated/95 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
          Scoring model
        </div>
        <h2 className="mt-1 font-display text-xl font-semibold tracking-tight">
          How scoring works
        </h2>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Five separate scores. They are not blended into a single number — each answers a
          different question. All are read-only signals for you to evaluate, not a recommendation.
        </p>
        <ul className="mt-5 space-y-3">
          {SCORES.map((s) => (
            <li
              key={s.key}
              className="rounded-xl border border-border/60 bg-background/40 p-3.5"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: s.color }}
                  aria-hidden
                />
                <span className="text-sm font-semibold">{s.label}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {s.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
