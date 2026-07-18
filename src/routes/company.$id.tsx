import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Building2,
  CheckCircle2,
  ChevronRight,
  Database,
  FileText,
  MapPin,
  ShieldCheck,
  TrendingUp,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/matchfund/AppShell";
import { ScoreRing } from "@/components/matchfund/ScoreRing";
import { companyById, founders, type Company } from "@/data/matchfund";

export const Route = createFileRoute("/company/$id")({
  loader: ({ params }): { company: Company } => {
    const c = companyById(params.id);
    if (!c) throw notFound();
    return { company: c };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.company.name} — Diligence · Match Fund`
          : "Company — Match Fund",
      },
      { name: "description", content: loaderData?.company.description ?? "" },
    ],
  }),
  component: CompanyDiligence,
  notFoundComponent: () => (
    <AppShell>
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <div className="text-lg font-medium">Company not found</div>
      </div>
    </AppShell>
  ),
});

function CompanyDiligence() {
  const { company } = Route.useLoaderData() as { company: Company };
  const founder = founders.find((f) => f.companyId === company.id);

  return (
    <AppShell>
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to opportunities
      </Link>

      <div className="grid grid-cols-12 gap-6">
        {/* Left: company header */}
        <div className="col-span-4">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-xl bg-mint-soft">
              <Building2 className="h-6 w-6 text-mint" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-4xl font-semibold tracking-tight">{company.name}</h1>
                <span className="rounded-full border border-mint/30 bg-mint-soft px-2 py-0.5 text-[11px] text-mint">
                  {company.signal}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{company.tagline}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-border bg-elevated px-2.5 py-0.5 text-[11px]">
                  {company.sector}
                </span>
                <span className="rounded-full border border-border bg-elevated px-2.5 py-0.5 text-[11px]">
                  {company.stage}
                </span>
              </div>
            </div>
          </div>
          <p className="mt-5 text-sm text-foreground/85">{company.description}</p>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {company.location}
          </div>
          <div className="mt-5 flex gap-2">
            <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-elevated px-4 py-2 text-xs hover:border-mint/40">
              <FileText className="h-3.5 w-3.5" /> Company profile
            </button>
            <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-elevated px-4 py-2 text-xs hover:border-mint/40">
              <Database className="h-3.5 w-3.5" /> Data room
            </button>
          </div>
        </div>

        {/* Center: dual score rings */}
        <div className="col-span-5">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6">
            <div
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                background:
                  "radial-gradient(ellipse at center bottom, oklch(0.86 0.17 155 / 0.15), transparent 60%)",
              }}
            />
            <div className="relative flex items-center justify-around">
              <div className="text-center">
                <div className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" /> Traction Strength
                </div>
                <ScoreRing value={company.scores.traction} size={160} stroke={10} />
              </div>
              <div className="text-center">
                <div className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> Trust Score
                </div>
                <ScoreRing value={company.scores.trust} size={160} stroke={10} sublabel={company.scores.trust >= 85 ? "High Trust" : "Building"} />
              </div>
            </div>
          </div>
        </div>

        {/* Right: recommendation */}
        <div className="col-span-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-sm font-medium">Recommendation</div>
            <div className="mt-2 inline-flex items-center gap-2 text-mint">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-xl font-semibold">{company.recommendation}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{company.rationale}</p>
            <div className="mt-2 text-[10px] text-muted-foreground">Updated 2 hours ago</div>

            <div className="mt-5 space-y-2">
              <button className="flex w-full items-center justify-between rounded-lg bg-mint px-3 py-2 text-xs font-medium text-primary-foreground">
                <span className="inline-flex items-center gap-2">
                  <Bookmark className="h-3.5 w-3.5" /> Shortlist
                </span>
                <Bookmark className="h-3.5 w-3.5" />
              </button>
              <button className="flex w-full items-center justify-between rounded-lg border border-border bg-elevated px-3 py-2 text-xs">
                <span className="inline-flex items-center gap-2">
                  <ArrowRight className="h-3.5 w-3.5" /> Move to Diligence
                </span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button className="flex w-full items-center justify-between rounded-lg border border-border bg-elevated px-3 py-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <X className="h-3.5 w-3.5" /> Pass
                </span>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs + timeline */}
      <div className="mt-6 grid grid-cols-12 gap-6">
        <section className="col-span-7 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-medium">Traction Overview</h2>
          <div className="mt-4 grid grid-cols-5 gap-3">
            <Kpi label="Pilots" value={String(company.kpis.pilots)} sub="Active pilots" delta={company.deltas.pilots} />
            <Kpi label="Revenue" value={company.kpis.arr} sub="Annual run rate" delta={company.deltas.arr} />
            <Kpi label="Customer LOIs" value={String(company.kpis.lois)} sub="Active LOIs" delta={company.deltas.lois} />
            <Kpi label="Evidence" value={`${company.kpis.evidenceQuality}/100`} sub="Quality" delta={company.deltas.evidence} />
            <Kpi label="Verification" value={`${company.kpis.verification}%`} sub="Verified" delta={company.deltas.verification} />
          </div>
        </section>

        <section className="col-span-5 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-medium">Traction Timeline</h2>
          <div className="mt-4 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={company.timeline}>
                <defs>
                  <linearGradient id="mintGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.86 0.17 155)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.86 0.17 155)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: "oklch(0.7 0.02 250)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.24 0.025 250)",
                    border: "1px solid oklch(1 0 0 / 0.1)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="oklch(0.86 0.17 155)"
                  strokeWidth={2}
                  fill="url(#mintGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Evidence / signals / path */}
      <div className="mt-6 grid grid-cols-12 gap-6">
        <section className="col-span-5 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-medium">Evidence Trail</h2>
          <div className="mt-4 space-y-2">
            {company.evidence.map((e, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 bg-elevated/60 p-3">
                <FileText className="h-4 w-4 text-mint" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{e.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Verified · {e.type} · {e.size}
                  </div>
                </div>
                <span
                  className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                  style={{
                    color: e.confidence === "High" ? "var(--mint)" : "var(--amber)",
                    borderColor: e.confidence === "High" ? "oklch(0.86 0.17 155 / 0.4)" : "oklch(0.82 0.15 80 / 0.4)",
                    background: e.confidence === "High" ? "oklch(0.86 0.17 155 / 0.12)" : "oklch(0.82 0.15 80 / 0.12)",
                  }}
                >
                  {e.confidence}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            ))}
          </div>
          <button className="mt-4 w-full rounded-lg border border-border bg-elevated py-2 text-xs">
            View all evidence
          </button>
        </section>

        <section className="col-span-4 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-medium">Key Signals</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {company.signals.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint" />
                <span className="text-foreground/85">{s}</span>
              </li>
            ))}
            <li className="mt-2 flex items-start gap-2 border-t border-border pt-3">
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--rose)" }} />
              <span className="text-foreground/85">
                <span className="font-medium" style={{ color: "var(--rose)" }}>Key Risk: </span>
                {company.risk}
              </span>
            </li>
          </ul>
        </section>

        <section className="col-span-3 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-sm font-medium">Investor Path</h2>
          <div className="mt-6 space-y-3">
            {[
              { label: "Discover", done: true },
              { label: "Shortlist", done: true },
              { label: "Diligence", done: false, current: true },
              { label: "Decision", done: false },
            ].map((s, i) => (
              <div key={s.label} className="flex items-center gap-3">
                <div
                  className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-medium ${
                    s.done
                      ? "bg-mint text-primary-foreground"
                      : s.current
                        ? "border-2 border-mint text-mint"
                        : "border border-border text-muted-foreground"
                  }`}
                >
                  {s.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <div className="flex-1">
                  <div className={`text-xs ${s.current ? "text-mint" : ""}`}>{s.label}</div>
                  {s.current && <div className="text-[10px] text-muted-foreground">You are here</div>}
                </div>
              </div>
            ))}
          </div>
          <button className="mt-6 w-full rounded-full bg-mint py-2 text-xs font-medium text-primary-foreground">
            Continue diligence
          </button>
        </section>
      </div>

      {founder && (
        <div className="mt-6 flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <img src={founder.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Founder</div>
            <div className="text-sm font-medium">
              {founder.name} · {founder.headline}
            </div>
          </div>
          <Link
            to="/founder/$id"
            params={{ id: founder.id }}
            className="text-xs text-mint hover:underline"
          >
            View founder profile →
          </Link>
        </div>
      )}
    </AppShell>
  );
}

function Kpi({ label, value, sub, delta }: { label: string; value: string; sub: string; delta: string }) {
  const positive = delta.startsWith("+");
  return (
    <div className="rounded-xl border border-border/60 bg-elevated/50 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
      <div
        className="mt-2 text-[11px] font-medium"
        style={{ color: positive ? "var(--mint)" : "var(--muted-foreground)" }}
      >
        {positive ? "▲ " : ""}
        {delta}
        {positive ? " vs last month" : ""}
      </div>
    </div>
  );
}
