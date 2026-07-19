import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Sparkles, Target } from "lucide-react";
import {
  DEFAULT_THESIS,
  GEO_OPTIONS,
  SECTOR_OPTIONS,
  STAGE_OPTIONS,
  loadThesis,
  saveThesis,
  type Thesis,
} from "@/lib/thesis";
import type { Sector } from "@/data/matchfund";
import { z } from "zod";

const searchSchema = z.object({
  return: z.enum(["settings"]).optional(),
});

export const Route = createFileRoute("/onboard")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Investment thesis — MatchFund" }] }),
  component: OnboardPage,
});

const STEPS = ["Stage", "Sectors", "Signals", "Range"] as const;

function OnboardPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/onboard" });
  const isEditing = search.return === "settings";
  const [step, setStep] = useState(0);
  const [thesis, setThesis] = useState<Thesis>(DEFAULT_THESIS);

  // Preload the existing thesis so edits don't reset selections.
  useEffect(() => {
    const existing = loadThesis();
    if (existing) setThesis(existing);
  }, []);

  const toggle = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const finish = () => {
    // Preserve counters and coach-mark state on edit; only reset on first setup.
    const existing = loadThesis();
    saveThesis({
      ...thesis,
      seenCoachMark: existing?.seenCoachMark ?? false,
      swipeCount: existing?.swipeCount ?? 0,
    });
    if (isEditing) {
      toast.success("Your investment thesis has been updated.");
      navigate({ to: "/settings" });
    } else {
      navigate({ to: "/" });
    }
  };

  const canAdvance =
    (step === 0 && thesis.stages.length > 0) ||
    (step === 1 && thesis.sectors.length > 0) ||
    step === 2 ||
    step === 3;

  return (
    <div className="relative min-h-screen bg-aurora text-foreground">
      <header className="sticky top-0 z-40 glass-bar">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-6">
          <div className="grid h-9 w-9 place-items-center rounded-2xl border border-mint/30 bg-mint-soft ring-glow">
            <Target className="h-4 w-4 text-mint" strokeWidth={2.5} />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Match Fund</span>
          <div className="ml-auto flex items-center gap-2">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i <= step ? "w-8 bg-mint" : "w-4 bg-white/10"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-14">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
          Onboarding · step {step + 1} of {STEPS.length}
        </div>

        {step === 0 && (
          <Stepper
            title="What stage do you back?"
            subtitle="Pick every stage you write checks into. This shapes today's deck."
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {STAGE_OPTIONS.map((s) => {
                const active = thesis.stages.includes(s.value);
                return (
                  <button
                    key={s.value}
                    onClick={() =>
                      setThesis({ ...thesis, stages: toggle(thesis.stages, s.value) })
                    }
                    className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-mint bg-mint-soft/40"
                        : "border-border bg-elevated/50 hover:border-mint/40"
                    }`}
                  >
                    <span
                      className={`mt-0.5 grid h-5 w-5 place-items-center rounded-full border ${
                        active ? "border-mint bg-mint text-primary-foreground" : "border-border"
                      }`}
                    >
                      {active && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span>
                      <div className="text-sm font-medium">{s.label}</div>
                      <div className="text-xs text-muted-foreground">{s.hint}</div>
                    </span>
                  </button>
                );
              })}
            </div>
          </Stepper>
        )}

        {step === 1 && (
          <Stepper
            title="Which sectors excite you?"
            subtitle="Multi-select. You can change these anytime from Thesis."
          >
            <div className="flex flex-wrap gap-2">
              {SECTOR_OPTIONS.map((s: Sector) => {
                const active = thesis.sectors.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() =>
                      setThesis({ ...thesis, sectors: toggle(thesis.sectors, s) })
                    }
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      active
                        ? "border-mint bg-mint-soft text-mint"
                        : "border-border bg-elevated/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </Stepper>
        )}

        {step === 2 && (
          <Stepper
            title="How do you weigh signals?"
            subtitle="Move the sliders. Each swipe will refine this in the background."
          >
            <div className="space-y-6 rounded-2xl border border-border/60 bg-elevated/40 p-6">
              <Slider
                label="Technical depth"
                hint="GitHub velocity, prior shipped projects, research output"
                value={thesis.weights.technical}
                onChange={(v) =>
                  setThesis({ ...thesis, weights: { ...thesis.weights, technical: v } })
                }
              />
              <Slider
                label="Traction & velocity"
                hint="Hackathon wins, user growth, revenue signal"
                value={thesis.weights.traction}
                onChange={(v) =>
                  setThesis({ ...thesis, weights: { ...thesis.weights, traction: v } })
                }
              />
              <Slider
                label="Founder-market fit"
                hint="Domain expertise, prior exits, why-this-founder"
                value={thesis.weights.fmf}
                onChange={(v) =>
                  setThesis({ ...thesis, weights: { ...thesis.weights, fmf: v } })
                }
              />
            </div>
          </Stepper>
        )}

        {step === 3 && (
          <Stepper
            title="Geography & check size"
            subtitle="Optional. Leave empty for a global feed."
          >
            <div>
              <div className="mb-2 text-xs text-muted-foreground">Regions</div>
              <div className="flex flex-wrap gap-2">
                {GEO_OPTIONS.map((g) => {
                  const active = thesis.geos.includes(g);
                  return (
                    <button
                      key={g}
                      onClick={() => setThesis({ ...thesis, geos: toggle(thesis.geos, g) })}
                      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                        active
                          ? "border-mint bg-mint-soft text-mint"
                          : "border-border bg-elevated/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-border/60 bg-elevated/40 p-5">
              <div className="mb-2 flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">Check size (USD)</span>
                <span className="tabular font-medium">
                  ${thesis.checkMin}k – ${thesis.checkMax}k
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={5}
                  value={thesis.checkMin}
                  onChange={(e) =>
                    setThesis({
                      ...thesis,
                      checkMin: Math.min(Number(e.target.value), thesis.checkMax),
                    })
                  }
                  className="flex-1 accent-[var(--mint)]"
                />
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={5}
                  value={thesis.checkMax}
                  onChange={(e) =>
                    setThesis({
                      ...thesis,
                      checkMax: Math.max(Number(e.target.value), thesis.checkMin),
                    })
                  }
                  className="flex-1 accent-[var(--mint)]"
                />
              </div>
            </div>

            <label className="mt-6 flex items-start gap-3 rounded-2xl border border-border/60 bg-elevated/40 p-4">
              <input
                type="checkbox"
                checked={thesis.digestEmail}
                onChange={(e) => setThesis({ ...thesis, digestEmail: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-[var(--mint)]"
              />
              <span className="text-sm">
                <span className="font-medium">Send me a morning shortlist</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  A daily email with the top new founders matching your thesis.
                </span>
              </span>
            </label>
          </Stepper>
        )}

        <div className="mt-10 flex items-center justify-between">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated/60 px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance}
              className="inline-flex items-center gap-1.5 rounded-full bg-mint px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={finish}
              className="inline-flex items-center gap-1.5 rounded-full bg-mint px-5 py-2 text-sm font-medium text-primary-foreground shadow-[0_0_28px_var(--mint-soft)]"
            >
              <Sparkles className="h-3.5 w-3.5" /> Start swiping
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

function Stepper({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function Slider({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <div className="text-sm font-medium">{label}</div>
        <div className="tabular text-xs text-mint">{value}</div>
      </div>
      <div className="mb-2 text-xs text-muted-foreground">{hint}</div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--mint)]"
      />
    </div>
  );
}
