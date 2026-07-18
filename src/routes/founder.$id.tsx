import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  ExternalLink,
  FileText,
  Github,
  Globe,
  Layers,
  Linkedin,
  MapPin,
  MessageCircle,
  Rocket,
  Star,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/matchfund/AppShell";
import { ScoreBar, ScoreRing } from "@/components/matchfund/ScoreRing";
import { companyById, discoveredSources, founderById, type Founder } from "@/data/matchfund";


export const Route = createFileRoute("/founder/$id")({
  loader: ({ params }): { founder: Founder } => {
    const f = founderById(params.id);
    if (!f) throw notFound();
    return { founder: f };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.founder.name} — Founder profile · Match Fund`
          : "Founder — Match Fund",
      },
      {
        name: "description",
        content: loaderData?.founder.headline ?? "Founder profile on Match Fund",
      },
    ],
  }),
  component: FounderProfile,
  notFoundComponent: () => (
    <AppShell>
      <div className="rounded-2xl glass p-10 text-center">
        <div className="text-lg font-medium">Founder not found</div>
        <Link to="/" className="mt-3 inline-block text-sm text-mint">
          Back to discovery
        </Link>
      </div>
    </AppShell>
  ),
});

function FounderProfile() {
  const { founder } = Route.useLoaderData() as { founder: Founder };
  const company = founder.companyId ? companyById(founder.companyId) : undefined;

  return (
    <AppShell>
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to discovery
      </Link>

      <div className="grid grid-cols-12 gap-6">
        {/* Left: profile card */}
        <div className="col-span-3">
          <div className="overflow-hidden rounded-2xl glass">
            <div className="relative aspect-[4/5]">
              <img src={founder.avatar} alt={founder.name} className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent p-3">
                <span className="h-2 w-2 rounded-full bg-mint" />
                <span className="text-xs font-medium text-foreground">
                  {founder.openTo === "cofounder" ? "Seeking cofounder" : "Open to opportunities"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: bio */}
        <div className="col-span-5 space-y-5">
          <div>
            <span className="inline-block rounded-full border border-border bg-elevated px-2.5 py-0.5 text-[11px] text-mint">
              Founder Profile
            </span>
            <div className="mt-3 flex items-center gap-2">
              <h1 className="font-display text-6xl font-semibold tracking-tight">{founder.name}</h1>
              {founder.verified && <CheckCircle2 className="h-6 w-6 text-mint" />}
            </div>
            <p className="mt-3 text-xl text-muted-foreground">{founder.headline}</p>
            <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {founder.location}
              </span>
              {founder.availableForRelocation && (
                <span className="inline-flex items-center gap-1.5">
                  <Rocket className="h-3.5 w-3.5" /> Available for relocation
                </span>
              )}
            </div>
          </div>

          <p className="text-base leading-relaxed text-foreground/85">{founder.bio}</p>


          <div className="flex flex-wrap gap-1.5">
            {founder.skills.map((s) => (
              <span key={s} className="rounded-full border border-border bg-elevated px-3 py-1 text-xs text-muted-foreground">
                {s}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {founder.team.map((t) => (
                <div key={t} className="grid h-8 w-8 place-items-center rounded-full border-2 border-card bg-elevated text-[10px] font-semibold">
                  {t}
                </div>
              ))}
            </div>
            <div className="text-xs">
              <div className="font-medium">{founder.signals.teamSize} team complete</div>
              <button className="text-[11px] text-mint hover:underline">View team</button>
            </div>
          </div>

          <div className="flex gap-2 text-xs">
            <a href="#" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-elevated px-3 py-1.5 hover:text-mint">
              <Github className="h-3.5 w-3.5" /> GitHub
            </a>
            <a href="#" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-elevated px-3 py-1.5 hover:text-mint">
              <Linkedin className="h-3.5 w-3.5" /> LinkedIn
            </a>
            <a href="#" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-elevated px-3 py-1.5 hover:text-mint">
              <FileText className="h-3.5 w-3.5" /> Pitch deck
            </a>
          </div>
        </div>

        {/* Right: founder fit */}
        <div className="col-span-4">
          <div className="rounded-2xl glass p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <div className="text-sm font-medium">Founder Fit</div>
              <div className="text-[10px] text-muted-foreground">vs Horizon thesis</div>
            </div>
            <div className="flex items-center gap-6">
              <ScoreRing value={founder.scores.fit} size={140} stroke={9} sublabel={founder.scores.fit >= 90 ? "Exceptional match" : founder.scores.fit >= 80 ? "Strong match" : "Good match"} />
              <div className="flex-1 space-y-2.5">
                <ScoreBar label="Domain Expertise" value={founder.fitBreakdown.domain} />
                <ScoreBar label="Technical Depth" value={founder.fitBreakdown.technical} />
                <ScoreBar label="Execution History" value={founder.fitBreakdown.execution} />
                <ScoreBar label="Market Insight" value={founder.fitBreakdown.market} />
                <ScoreBar label="Team Completeness" value={founder.fitBreakdown.team} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Second row */}
      <div className="mt-6 grid grid-cols-12 gap-6">
        <div className="col-span-8 space-y-6">
          {/* Signals & Traction */}
          <section className="rounded-2xl glass p-6">
            <h2 className="text-sm font-medium">Signals & Traction</h2>
            <div className="mt-4 grid grid-cols-4 gap-3">
              <SignalTile icon={Trophy} label="Hackathon Wins" value={String(founder.signals.hackathonWins)} sub={founder.signals.hackathonWins >= 2 ? "Top 1% National" : "Emerging"} />
              <SignalTile icon={Github} label="GitHub Activity" value={founder.signals.githubActivity} sub="Active contributor" />
              <SignalTile icon={Layers} label="Prior Projects" value={String(founder.signals.priorProjects)} sub="Shipped products" />
              <SignalTile icon={Users} label="Team" value={founder.signals.teamSize} sub={parseInt(founder.signals.teamSize) === parseInt(founder.signals.teamSize.split("/")[1]) ? "Complete" : "Building"} />
            </div>
          </section>

          {/* Discovered Sources */}
          <section className="rounded-2xl glass p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium">Discovered sources</h2>
              <span className="text-[11px] text-muted-foreground">
                Auto-crawled evidence · {discoveredSources(founder).length} sources
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {discoveredSources(founder).map((s, i) => {
                const Icon =
                  s.kind === "github"
                    ? Github
                    : s.kind === "linkedin"
                      ? Linkedin
                      : s.kind === "hackathon"
                        ? Trophy
                        : s.kind === "arxiv"
                          ? FileText
                          : s.kind === "producthunt"
                            ? Rocket
                            : Globe;
                const content = (
                  <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-elevated/60 p-3 transition hover:border-mint/40">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-mint-soft">
                      <Icon className="h-4 w-4 text-mint" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-medium">{s.label}</div>
                        {s.url && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">{s.detail}</div>
                    </div>
                  </div>
                );
                return s.url ? (
                  <a key={i} href={s.url} target="_blank" rel="noreferrer">
                    {content}
                  </a>
                ) : (
                  <div key={i}>{content}</div>
                );
              })}
            </div>
          </section>



          {/* Hackathons */}
          {founder.hackathons.length > 0 && (
            <section className="rounded-2xl glass p-6">
              <h2 className="text-sm font-medium">Hackathon history</h2>
              <div className="mt-4 space-y-2">
                {founder.hackathons.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-border/50 bg-elevated/50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-mint-soft">
                        <Trophy className="h-4 w-4 text-mint" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{h.event}</div>
                        <div className="text-xs text-muted-foreground">
                          {h.date} · Project: {h.project}
                        </div>
                      </div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                      h.placement.includes("Winner") || h.placement.includes("Prize")
                        ? "border-mint/40 bg-mint-soft text-mint"
                        : "border-amber/40 bg-amber/10 text-amber"
                    }`} style={{ color: h.placement.includes("Winner") || h.placement.includes("Prize") ? "var(--mint)" : "var(--amber)" }}>
                      {h.placement}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Experience & Education */}
          <div className="grid grid-cols-2 gap-6">
            <section className="rounded-2xl glass p-6">
              <h2 className="text-sm font-medium">Experience Snapshot</h2>
              <div className="mt-4 space-y-3">
                {founder.experience.map((e, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div
                      className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md text-[11px] font-bold text-primary-foreground"
                      style={{ background: e.logoColor }}
                    >
                      {e.company.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                    </div>
                    <div className="flex-1">
                      <div className="text-[11px] text-muted-foreground">{e.years}</div>
                      <div className="text-sm font-medium">{e.role}</div>
                      <div className="text-xs text-muted-foreground">{e.company}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-2xl glass p-6">
              <h2 className="text-sm font-medium">Education</h2>
              <div className="mt-4 space-y-3">
                {founder.education.map((ed, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-elevated text-[11px] font-bold text-foreground">
                      {ed.abbrev}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{ed.degree}</div>
                      <div className="text-xs text-muted-foreground">{ed.field}</div>
                      <div className="text-xs text-muted-foreground">{ed.school}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Pitch deck */}
          <section className="rounded-2xl glass p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Pitch deck</h2>
              <button className="text-[11px] text-mint hover:underline">Request full deck →</button>
            </div>
            <div className="mt-4 grid grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[4/3] rounded-lg border border-border bg-gradient-to-br from-elevated to-card p-3 text-[9px] text-muted-foreground"
                  style={{
                    backgroundImage:
                      i === 0
                        ? "radial-gradient(circle at 30% 40%, oklch(0.86 0.17 155 / 0.25), transparent 60%)"
                        : undefined,
                  }}
                >
                  <div className="font-medium text-foreground">Slide {i + 1}</div>
                  <div className="mt-1">
                    {["Cover", "Problem", "Solution", "Traction", "Team", "Ask"][i]}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="col-span-4 space-y-6">
          <section className="rounded-2xl glass p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium">Related Company</h2>
              {company && (
                <span className="inline-flex items-center gap-1 text-[11px] text-mint">
                  <span className="h-1.5 w-1.5 rounded-full bg-mint" /> Active
                </span>
              )}
            </div>
            {company ? (
              <div>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-mint-soft">
                    <Rocket className="h-4 w-4 text-mint" />
                  </div>
                  <div>
                    <div className="font-medium">{company.name}</div>
                    <div className="text-xs text-muted-foreground">{company.tagline}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px]">
                  <span className="rounded-full border border-mint/30 bg-mint-soft px-2 py-0.5 text-mint">
                    {company.stage} Stage
                  </span>
                  <span className="text-muted-foreground">
                    <MapPin className="mr-1 inline h-3 w-3" />
                    {company.location}
                  </span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{company.description}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-border/60 bg-elevated/60 p-3 text-xs">
                  <div>
                    <div className="text-[10px] text-muted-foreground">Founded</div>
                    <div className="font-medium">{company.founded}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Team Size</div>
                    <div className="font-medium">{company.teamSize}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">Funding</div>
                    <div className="font-medium">{company.funding}</div>
                  </div>
                </div>
                <Link
                  to="/company/$id"
                  params={{ id: company.id }}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-elevated py-2 text-xs font-medium hover:border-mint/40 hover:text-mint"
                >
                  Open company diligence <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                <Zap className="mx-auto mb-2 h-5 w-5 text-mint" />
                Building in stealth — no company entity yet.
                <br />
                Evaluating on hackathon builds and prior work.
              </div>
            )}
          </section>

          <section className="rounded-2xl glass p-6">
            <h2 className="text-sm font-medium">Recent Updates</h2>
            <div className="mt-3 space-y-2">
              {founder.updates.map((u, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border/50 bg-elevated/50 p-3">
                  <div className="flex items-center gap-2 text-xs">
                    <Star className="h-3.5 w-3.5 text-mint" />
                    {u.text}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{u.when}</span>
                </div>
              ))}
            </div>
            <button className="mt-3 text-[11px] text-mint hover:underline">View all updates →</button>
          </section>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="mt-8 flex items-center gap-3 rounded-2xl glass p-4">
        <p className="flex-1 text-sm text-muted-foreground">
          <span className="text-foreground">High conviction founder.</span> Strong technical depth and execution track record.
        </p>
        <Link
          to="/idea/$id"
          params={{ id: founder.id }}
          className="inline-flex items-center gap-2 rounded-full bg-mint px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_0_30px_var(--mint-soft)]"
        >
          Review Idea →
        </Link>
        <button className="inline-flex items-center gap-2 rounded-full border border-border bg-elevated px-5 py-2.5 text-sm font-medium">
          <MessageCircle className="h-4 w-4" /> Contact Founder
        </button>
        <button className="grid h-10 w-10 place-items-center rounded-full border border-border bg-elevated">
          <Bookmark className="h-4 w-4" />
        </button>
      </div>
    </AppShell>
  );
}

function SignalTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-elevated/50 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular">{value}</div>
      <div className="mt-0.5 text-[11px] text-mint">{sub}</div>
    </div>
  );
}
