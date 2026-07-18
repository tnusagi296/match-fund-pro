import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  Crosshair,
  Lightbulb,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Users2,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/matchfund/AppShell";
import { DotBar, ScoreRing } from "@/components/matchfund/ScoreRing";
import { founderById, type Founder } from "@/data/matchfund";

export const Route = createFileRoute("/idea/$id")({
  loader: ({ params }): { founder: Founder } => {
    const f = founderById(params.id);
    if (!f) throw notFound();
    return { founder: f };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.founder.name} — Idea Strength · Match Fund`
          : "Idea — Match Fund",
      },
    ],
  }),
  component: IdeaStrength,
  notFoundComponent: () => (
    <AppShell>
      <div className="p-10 text-center text-muted-foreground">Not found</div>
    </AppShell>
  ),
});

const FACTORS = [
  { key: "Problem Clarity", icon: Lightbulb, note: "Clear, validated, and well-defined problem.", score: 92 },
  { key: "Solution Differentiation", icon: Rocket, note: "Unique approach with strong differentiation.", score: 88 },
  { key: "Technical Moat", icon: ShieldCheck, note: "Defensible technology or data advantage.", score: 84 },
  { key: "Strategic Fit", icon: Crosshair, note: "Aligns with our investment thesis and portfolio.", score: 90 },
  { key: "Target Customer", icon: Users2, note: "Well-defined ICP with real willingness to pay.", score: 82 },
  { key: "Why Now", icon: Zap, note: "Strong market timing and tailwinds.", score: 86 },
];

function IdeaStrength() {
  const { founder } = Route.useLoaderData() as { founder: Founder };

  return (
    <AppShell>
      <Link
        to="/founder/$id"
        params={{ id: founder.id }}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to founder
      </Link>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4 pt-8">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
            Idea Assessment
          </div>
          <h1 className="mt-3 font-display text-6xl font-semibold leading-[1.02] tracking-tight">
            Idea<br />Strength
          </h1>
          <p className="mt-5 max-w-sm text-sm text-muted-foreground">
            We evaluate the quality, uniqueness, and timing of {founder.name.split(" ")[0]}'s idea. Built for signal, not noise.
          </p>
          <button className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-elevated px-4 py-2 text-xs">
            View full methodology <ArrowLeft className="h-3 w-3 rotate-180" />
          </button>
        </div>

        {/* Center orbital ring */}
        <div className="relative col-span-8">
          <div
            className="relative mx-auto grid aspect-square max-w-2xl place-items-center rounded-full"
            style={{
              background:
                "radial-gradient(circle at center, oklch(0.28 0.05 260) 0%, oklch(0.22 0.04 260) 40%, transparent 70%), radial-gradient(circle at 30% 30%, oklch(0.86 0.17 155 / 0.15), transparent 40%)",
            }}
          >
            {/* orbits */}
            {[0.55, 0.75, 0.95].map((r, i) => (
              <div
                key={i}
                className="absolute rounded-full border border-mint/15"
                style={{
                  width: `${r * 100}%`,
                  height: `${r * 100}%`,
                  transform: "rotate(-15deg)",
                }}
              />
            ))}
            {/* stars */}
            {Array.from({ length: 40 }).map((_, i) => {
              const x = (i * 37) % 100;
              const y = (i * 53) % 100;
              return (
                <span
                  key={i}
                  className="absolute h-0.5 w-0.5 rounded-full bg-mint"
                  style={{ top: `${y}%`, left: `${x}%`, opacity: (i % 3) * 0.3 + 0.2 }}
                />
              );
            })}
            <div className="relative">
              <ScoreRing value={founder.scores.idea} size={260} stroke={4} sublabel={founder.scores.idea >= 85 ? "Strong" : "Good"} />
            </div>

            {/* factor cards */}
            <div className="absolute inset-0">
              {FACTORS.map((f, i) => {
                const angle = (i / FACTORS.length) * Math.PI * 2 - Math.PI / 2;
                const rad = 48; // percent
                const x = 50 + Math.cos(angle) * rad;
                const y = 50 + Math.sin(angle) * rad;
                const Icon = f.icon;
                return (
                  <div
                    key={f.key}
                    className="absolute w-52 -translate-x-1/2 -translate-y-1/2 rounded-xl glass/90 p-3 shadow-xl backdrop-blur"
                    style={{ top: `${y}%`, left: `${x}%` }}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-mint" />
                      <div className="text-xs font-medium">{f.key}</div>
                    </div>
                    <div className="mt-2">
                      <DotBar value={f.score} />
                    </div>
                    <p className="mt-2 text-[10px] leading-snug text-muted-foreground">{f.note}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-12 gap-6">
        <section className="col-span-4 rounded-2xl glass p-5">
          <div className="flex items-center gap-2">
            <Users2 className="h-4 w-4 text-mint" />
            <h2 className="text-sm font-medium">Founder & Traction</h2>
          </div>
          <div className="mt-4 space-y-2">
            {[
              ["Founder Experience", founder.fitBreakdown.execution, "Top 1%"],
              ["Execution Track Record", founder.scores.traction, "Strong"],
              ["Early Traction", Math.min(founder.scores.traction + 5, 100), "Growing"],
            ].map(([l, v, sub]) => (
              <div key={l as string} className="flex items-center gap-3 rounded-lg border border-border/60 bg-elevated/50 p-3">
                <div
                  className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold text-primary-foreground"
                  style={{ background: "var(--mint)" }}
                >
                  {v}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">{l}</div>
                  <div className="text-[10px] text-muted-foreground">{sub}</div>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-4 flex w-full items-center justify-between rounded-lg border border-border bg-elevated p-2 text-xs">
            View full profile
            <ArrowLeft className="h-3 w-3 rotate-180" />
          </button>
        </section>

        <section className="col-span-5 rounded-2xl border border-mint/30 bg-mint-soft/30 p-5">
          <div className="flex items-start gap-3">
            <Star className="mt-0.5 h-6 w-6 text-mint" />
            <div>
              <div className="text-mint">This idea shows strong overall potential.</div>
              <p className="mt-1 text-sm text-foreground/85">
                Consider exploring the team and traction for deeper conviction.
              </p>
            </div>
          </div>
        </section>

        <section className="col-span-3 rounded-2xl glass p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Top Strengths</h2>
            <button className="text-[11px] text-mint">View all</button>
          </div>
          <ul className="mt-3 space-y-2 text-xs">
            {[
              { icon: Lightbulb, title: "Clear Problem", sub: "Well articulated pain point" },
              { icon: Rocket, title: "Differentiated Approach", sub: "Not easily replicable" },
              { icon: Sparkles, title: "Market Timing", sub: "Favorable market conditions" },
            ].map((s) => (
              <li key={s.title} className="flex items-start gap-2">
                <s.icon className="mt-0.5 h-3.5 w-3.5 text-mint" />
                <div>
                  <div className="font-medium">{s.title}</div>
                  <div className="text-[10px] text-muted-foreground">{s.sub}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {founder.companyId && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl glass p-4">
          <Building2 className="h-5 w-5 text-mint" />
          <div className="flex-1 text-sm">
            <span className="text-muted-foreground">Company diligence available · </span>
            <span className="font-medium">See traction and evidence in depth.</span>
          </div>
          <Link
            to="/company/$id"
            params={{ id: founder.companyId }}
            className="rounded-full bg-mint px-4 py-2 text-xs font-medium text-primary-foreground"
          >
            Open diligence →
          </Link>
        </div>
      )}
    </AppShell>
  );
}
