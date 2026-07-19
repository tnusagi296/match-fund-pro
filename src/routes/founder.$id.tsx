import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  BookmarkCheck,
  CheckCircle2,
  ExternalLink,
  FileText,
  FileWarning,
  Github,
  Globe,
  Linkedin,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Rocket,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
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
          ? `${loaderData.founder.name} — Founder · MatchFund`
          : "Founder — MatchFund",
      },
      {
        name: "description",
        content: loaderData?.founder.headline ?? "Founder profile on MatchFund",
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

type Tab = "overview" | "evidence" | "idea" | "traction";

function FounderProfile() {
  const { founder } = Route.useLoaderData() as { founder: Founder };
  const company = founder.companyId ? companyById(founder.companyId) : undefined;
  const [tab, setTab] = useState<Tab>("overview");

  const status = company ? `${company.name} · ${founder.stage}` : "Pre-company";
  const sources = discoveredSources(founder);
  const evidenceConfidence: "High" | "Medium" | "Low" =
    sources.length >= 5 ? "High" : sources.length >= 3 ? "Medium" : "Low";

  return (
    <AppShell>
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to discovery
      </Link>

      {/* Persistent header */}
      <div className="sticky top-16 z-30 -mx-6 mb-5 border-b border-border/40 bg-background/70 px-6 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <img
            src={founder.avatar}
            alt={founder.name}
            className="h-14 w-14 shrink-0 rounded-full border border-border object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-display text-2xl font-semibold tracking-tight">
                {founder.name}
              </h1>
              {founder.verified && <CheckCircle2 className="h-4 w-4 shrink-0 text-mint" />}
              <span className="rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 text-[10px] font-medium text-amber">
                Demo data
              </span>
            </div>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {founder.headline} · {status}
            </p>
          </div>

          <HeaderStat label="Founder Fit" value={founder.scores.fit} tone="mint" />
          <HeaderStat label="Evidence" value={evidenceConfidence} tone="neutral" />

          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 rounded-full bg-mint px-4 py-2 text-xs font-medium text-primary-foreground shadow-[0_0_24px_var(--mint-soft)]">
              <BookmarkCheck className="h-3.5 w-3.5" /> Shortlist
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated px-3 py-2 text-xs font-medium">
              <MessageCircle className="h-3.5 w-3.5" /> Contact
            </button>
            <button className="grid h-9 w-9 place-items-center rounded-full border border-border bg-elevated">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-3 flex gap-1">
          {(
            [
              ["overview", "Overview"],
              ["evidence", "Founder Evidence"],
              ["idea", "Idea"],
              ["traction", "Traction"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-medium transition ${
                tab === id
                  ? "bg-white/10 text-foreground shadow-[0_1px_0_oklch(1_0_0/0.15)_inset]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && (
        <OverviewTab founder={founder} evidenceConfidence={evidenceConfidence} />
      )}
      {tab === "evidence" && <EvidenceTab founder={founder} />}
      {tab === "idea" && <IdeaTab founder={founder} company={company} />}
      {tab === "traction" && <TractionTab founder={founder} company={company} />}
    </AppShell>
  );
}

// ------------- Header stat -------------

function HeaderStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "mint" | "neutral";
}) {
  return (
    <div className="hidden rounded-xl border border-border/60 bg-elevated/50 px-3 py-1.5 md:block">
      <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className="tabular text-base font-semibold leading-tight"
        style={{ color: tone === "mint" ? "var(--mint)" : undefined }}
      >
        {value}
      </div>
    </div>
  );
}

// ------------- Overview -------------

function OverviewTab({
  founder,
  evidenceConfidence,
}: {
  founder: Founder;
  evidenceConfidence: "High" | "Medium" | "Low";
}) {
  const sources = discoveredSources(founder);
  return (
    <div className="grid grid-cols-12 gap-5">
      {/* Left — identity + contact */}
      <aside className="col-span-3 space-y-4">
        <div className="rounded-2xl glass p-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Identity
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {founder.location}
          </div>
          {founder.availableForRelocation && (
            <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
              <Rocket className="h-3.5 w-3.5" /> Available for relocation
            </div>
          )}
          <div className="mt-1.5 flex items-center gap-3 text-xs text-mint">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" />
            {founder.openTo === "cofounder"
              ? "Seeking cofounder"
              : founder.openTo === "opportunities"
                ? "Open to opportunities"
                : "Not open"}
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {founder.skills.map((s) => (
              <span
                key={s}
                className="rounded-full border border-border/60 bg-elevated/50 px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl glass p-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            External profiles
          </div>
          <div className="mt-3 flex flex-col gap-1.5 text-xs">
            <ExternalRow icon={Github} label="GitHub" href="#" />
            <ExternalRow icon={Linkedin} label="LinkedIn" href="#" />
            <ExternalRow icon={Globe} label="Website" href="#" />
          </div>
        </div>

        <div className="rounded-2xl glass p-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Team
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex -space-x-2">
              {founder.team.map((t) => (
                <div
                  key={t}
                  className="grid h-8 w-8 place-items-center rounded-full border-2 border-card bg-elevated text-[10px] font-semibold"
                >
                  {t}
                </div>
              ))}
            </div>
            <div className="text-xs">
              <div className="font-medium">{founder.signals.teamSize} filled</div>
              <div className="text-[10px] text-muted-foreground">Founding team</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Center — narrative + strongest evidence + milestones */}
      <div className="col-span-6 space-y-4">
        <section className="rounded-2xl glass p-5">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 text-mint" />
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-mint">
                Why this founder surfaced
              </div>
              <p className="mt-1 text-sm leading-relaxed">{founder.matchReason}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl glass p-5">
          <h2 className="text-sm font-medium">Founder Fit explanation</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">{founder.bio}</p>
        </section>

        <section className="rounded-2xl glass p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium">Three strongest evidence items</h2>
            <span className="text-[11px] text-muted-foreground">{sources.length} total</span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {sources.slice(0, 3).map((s, i) => (
              <EvidenceCard key={i} source={s} />
            ))}
          </div>
        </section>

        <section className="rounded-2xl glass p-5">
          <h2 className="text-sm font-medium">Recent milestones</h2>
          <ol className="mt-3 space-y-2">
            {founder.updates.map((u, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg border border-border/50 bg-elevated/40 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Star className="h-3.5 w-3.5 text-mint" />
                  {u.text}
                </div>
                <span className="text-[10px] text-muted-foreground">{u.when}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Right — fit breakdown + risk + next action */}
      <aside className="col-span-3 space-y-4">
        <div className="rounded-2xl glass p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <div className="text-sm font-medium">Founder Fit</div>
            <div className="text-[10px] text-muted-foreground">vs your thesis</div>
          </div>
          <div className="flex items-center gap-4">
            <ScoreRing
              value={founder.scores.fit}
              size={100}
              stroke={8}
              sublabel={
                founder.scores.fit >= 90
                  ? "Exceptional"
                  : founder.scores.fit >= 80
                    ? "Strong"
                    : "Good"
              }
            />
            <div className="flex-1 space-y-2">
              <ScoreBar label="Domain" value={founder.fitBreakdown.domain} />
              <ScoreBar label="Technical" value={founder.fitBreakdown.technical} />
              <ScoreBar label="Execution" value={founder.fitBreakdown.execution} />
              <ScoreBar label="Market" value={founder.fitBreakdown.market} />
              <ScoreBar label="Team" value={founder.fitBreakdown.team} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl glass p-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Evidence Confidence
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tabular text-2xl font-semibold text-mint">
              {evidenceConfidence}
            </span>
            <span className="text-xs text-muted-foreground">
              {sources.length} sources
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-amber/25 bg-amber/5 p-5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-amber">
            <FileWarning className="h-3.5 w-3.5" /> Main risk
          </div>
          <p className="mt-2 text-xs leading-relaxed text-foreground/85">
            {founder.companyId
              ? "Traction metrics not independently verified — request pilot references."
              : "No incorporated entity yet. Evaluate on prior projects and hackathon builds."}
          </p>
        </div>

        <div className="rounded-2xl border border-mint/25 bg-mint-soft/25 p-5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-mint">
            <Target className="h-3.5 w-3.5" /> Recommended next action
          </div>
          <p className="mt-2 text-xs leading-relaxed text-foreground/85">
            30-minute intro call to validate {founder.fitBreakdown.market < 80 ? "market thesis" : "execution plan"}.
          </p>
          <button className="mt-3 w-full rounded-lg bg-mint px-3 py-1.5 text-xs font-medium text-primary-foreground">
            Request intro
          </button>
        </div>
      </aside>
    </div>
  );
}

function EvidenceCard({
  source,
}: {
  source: ReturnType<typeof discoveredSources>[number];
}) {
  const Icon =
    source.kind === "github"
      ? Github
      : source.kind === "linkedin"
        ? Linkedin
        : source.kind === "hackathon"
          ? Trophy
          : source.kind === "arxiv"
            ? FileText
            : source.kind === "producthunt"
              ? Rocket
              : Globe;
  const content = (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-elevated/50 p-3 transition hover:border-mint/40">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-mint-soft">
        <Icon className="h-4 w-4 text-mint" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="truncate text-sm font-medium">{source.label}</div>
          {source.url && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{source.detail}</div>
      </div>
      <span className="shrink-0 rounded-full border border-mint/25 bg-mint-soft/30 px-1.5 py-0.5 text-[9px] font-medium text-mint">
        Observed
      </span>
    </div>
  );
  return source.url ? (
    <a href={source.url} target="_blank" rel="noreferrer">
      {content}
    </a>
  ) : (
    content
  );
}

// ------------- Founder Evidence tab -------------

function EvidenceTab({ founder }: { founder: Founder }) {
  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-8 space-y-4">
        <section className="rounded-2xl glass p-5">
          <SectionHead
            icon={Github}
            title="GitHub metrics"
            note="Publicly observed"
          />
          <div className="mt-3 grid grid-cols-3 gap-3">
            <MetricTile
              label="Activity"
              value={founder.signals.githubActivity}
              status="Publicly observed"
            />
            <MetricTile
              label="Prior projects"
              value={String(founder.signals.priorProjects)}
              status="Publicly observed"
            />
            <MetricTile
              label="Hackathon wins"
              value={String(founder.signals.hackathonWins)}
              status="Verified via event pages"
            />
          </div>
        </section>

        {founder.hackathons.length > 0 && (
          <section className="rounded-2xl glass p-5">
            <SectionHead icon={Trophy} title="Hackathon participation" note="Verified" />
            <div className="mt-3 space-y-2">
              {founder.hackathons.map((h, i) => (
                <EvidenceRow
                  key={i}
                  primary={h.event}
                  secondary={`${h.date} · Project: ${h.project}`}
                  badge={h.placement}
                  badgeTone={
                    h.placement.includes("Winner") || h.placement.includes("Prize")
                      ? "mint"
                      : "amber"
                  }
                  status="Verified"
                />
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl glass p-5">
          <SectionHead icon={Rocket} title="Prior projects" note="Publicly observed" />
          <div className="mt-3 space-y-2">
            {founder.hackathons.map((h, i) => (
              <EvidenceRow
                key={i}
                primary={h.project}
                secondary={`Shipped at ${h.event}`}
                status="Publicly observed"
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl glass p-5">
          <SectionHead icon={Users} title="Relevant employment" note="Founder-provided" />
          <div className="mt-3 space-y-2">
            {founder.experience.map((e, i) => (
              <EvidenceRow
                key={i}
                primary={`${e.role} · ${e.company}`}
                secondary={e.years}
                status="Founder-provided"
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl glass p-5 opacity-90">
          <SectionHead icon={FileText} title="Education" note="Supporting" />
          <div className="mt-3 space-y-2">
            {founder.education.map((ed, i) => (
              <EvidenceRow
                key={i}
                primary={`${ed.degree} · ${ed.field}`}
                secondary={ed.school}
                status="Founder-provided"
              />
            ))}
          </div>
        </section>
      </div>

      <aside className="col-span-4">
        <div className="sticky top-56 rounded-2xl glass p-5">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Execution history at a glance
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <SummaryRow label="Ships publicly" value="Yes" tone="mint" />
            <SummaryRow
              label="Hackathon wins"
              value={String(founder.signals.hackathonWins)}
              tone="mint"
            />
            <SummaryRow
              label="Shipped projects"
              value={String(founder.signals.priorProjects)}
              tone="mint"
            />
            <SummaryRow
              label="Team completeness"
              value={founder.signals.teamSize}
              tone="neutral"
            />
          </div>
        </div>
      </aside>
    </div>
  );
}

function SectionHead({
  icon: Icon,
  title,
  note,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  note: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-mint" />
        <h2 className="text-sm font-medium">{title}</h2>
      </div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {note}
      </span>
    </div>
  );
}

function EvidenceRow({
  primary,
  secondary,
  badge,
  badgeTone,
  status,
}: {
  primary: string;
  secondary: string;
  badge?: string;
  badgeTone?: "mint" | "amber";
  status: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-elevated/40 p-3 text-xs">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{primary}</div>
        <div className="truncate text-[11px] text-muted-foreground">{secondary}</div>
      </div>
      <div className="flex items-center gap-2">
        {badge && (
          <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
            style={{
              color: badgeTone === "mint" ? "var(--mint)" : "var(--amber)",
              borderColor: badgeTone === "mint" ? "var(--mint)" : "var(--amber)",
              background: badgeTone === "mint" ? "var(--mint-soft)" : "transparent",
            }}
          >
            {badge}
          </span>
        )}
        <span className="rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground">
          {status}
        </span>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-elevated/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 tabular text-xl font-semibold">{value}</div>
      <div className="mt-0.5 text-[10px] text-mint">{status}</div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "mint" | "neutral";
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-elevated/40 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span
        className="tabular font-medium"
        style={{ color: tone === "mint" ? "var(--mint)" : undefined }}
      >
        {value}
      </span>
    </div>
  );
}

// ------------- Idea tab -------------

function IdeaTab({
  founder,
  company,
}: {
  founder: Founder;
  company: ReturnType<typeof companyById>;
}) {
  const problem = company?.description ?? founder.matchReason;
  const solution = company?.tagline ?? founder.headline;
  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-8 space-y-4">
        <IdeaBlock label="Problem" body={problem} status="Founder-provided" />
        <IdeaBlock label="Solution" body={solution} status="Founder-provided" />
        <IdeaBlock
          label="Target customer"
          body={
            founder.sector === "Bio"
              ? "Clinical research organisations and academic labs."
              : founder.sector === "Climate"
                ? "Industrial operators reducing Scope 1 & 2 emissions."
                : "Technical teams shipping AI-native products."
          }
          status="Inferred"
        />
        <IdeaBlock
          label="Differentiation"
          body={`${founder.skills[0]} depth combined with ${founder.experience[0]?.company ?? "prior operating experience"}.`}
          status="Founder-provided"
        />
        <IdeaBlock
          label="Technical depth"
          body={`${founder.signals.githubActivity} GitHub activity across ${founder.signals.priorProjects} shipped projects.`}
          status="Publicly observed"
        />
        <IdeaBlock
          label="Why now"
          body="Model costs and open-source infra crossed the utility threshold in the last 12 months, unlocking a defensible wedge."
          status="Inferred"
        />
        <IdeaBlock
          label="Main assumptions"
          body="Customer willingness to pay > $50k/yr for verified accuracy; distribution via technical champions inside enterprise buyers."
          status="Inferred"
        />
      </div>
      <aside className="col-span-4">
        <div className="sticky top-56 rounded-2xl glass p-5">
          <div className="text-sm font-medium">Idea Strength</div>
          <div className="mt-3 flex items-center gap-4">
            <ScoreRing
              value={founder.scores.idea}
              size={100}
              stroke={8}
              sublabel="Evidence-weighted"
            />
            <div className="flex-1 space-y-2">
              <ScoreBar label="Problem clarity" value={Math.min(100, founder.scores.idea + 4)} />
              <ScoreBar label="Solution differentiation" value={founder.scores.idea} />
              <ScoreBar label="Technical moat" value={founder.fitBreakdown.technical} />
              <ScoreBar label="Strategic fit" value={founder.scores.fit} />
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-border/60 bg-elevated/40 p-3 text-[11px] text-muted-foreground">
            Supporting evidence · public builds and documented prior projects.
          </div>
        </div>
      </aside>
    </div>
  );
}

function IdeaBlock({
  label,
  body,
  status,
}: {
  label: string;
  body: string;
  status: string;
}) {
  return (
    <section className="rounded-2xl glass p-5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wider text-mint">
          {label}
        </div>
        <span className="rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground">
          {status}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground/85">{body}</p>
    </section>
  );
}

// ------------- Traction tab -------------

function TractionTab({
  founder,
  company,
}: {
  founder: Founder;
  company: ReturnType<typeof companyById>;
}) {
  const hasPitchDeck = false;
  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-8 space-y-4">
        <section className="rounded-2xl glass p-5">
          <SectionHead
            icon={TrendingUp}
            title="Prototype and traction"
            note={company ? "Founder-provided" : "Inferred"}
          />
          <div className="mt-3 grid grid-cols-3 gap-3">
            <MetricTile
              label="Prototype"
              value={founder.stage === "Idea" ? "Not started" : "Live"}
              status={founder.stage === "Idea" ? "Missing" : "Publicly observed"}
            />
            <MetricTile
              label="Users"
              value={company ? "Pilot cohort" : "None yet"}
              status={company ? "Founder-provided" : "Missing"}
            />
            <MetricTile
              label="Revenue"
              value={company?.kpis.arr ?? "—"}
              status={company ? "Founder-provided" : "Missing"}
            />
            <MetricTile
              label="Pilots"
              value={company ? String(company.kpis.pilots) : "0"}
              status={company ? "Founder-provided" : "Missing"}
            />
            <MetricTile
              label="LOIs"
              value={company ? String(company.kpis.lois) : "0"}
              status={company ? "Founder-provided" : "Missing"}
            />
            <MetricTile
              label="GitHub growth"
              value={founder.signals.githubActivity}
              status="Publicly observed"
            />
          </div>
        </section>

        <section className="rounded-2xl glass p-5">
          <SectionHead icon={Trophy} title="Post-hackathon continuation" note="Publicly observed" />
          <p className="mt-2 text-sm text-foreground/85">
            {founder.hackathons.length > 0
              ? `Continued work on ${founder.hackathons[0].project} after ${founder.hackathons[0].event}.`
              : "No hackathon builds carried forward yet."}
          </p>
        </section>

        <section className="rounded-2xl glass p-5">
          <SectionHead icon={FileText} title="Pitch deck" note="Founder-provided" />
          {hasPitchDeck ? (
            <div className="mt-3 text-sm text-muted-foreground">Deck attached.</div>
          ) : (
            <div className="mt-3 flex items-center justify-between rounded-xl border border-dashed border-border p-4 text-sm">
              <span className="text-muted-foreground">No pitch deck available.</span>
              <button className="rounded-full bg-mint px-3 py-1.5 text-xs font-medium text-primary-foreground">
                Request pitch deck
              </button>
            </div>
          )}
        </section>
      </div>

      <aside className="col-span-4 space-y-4">
        <div className="rounded-2xl glass p-5">
          <div className="text-sm font-medium">Traction Strength</div>
          <div className="mt-3 flex items-center gap-4">
            <ScoreRing
              value={founder.scores.traction}
              size={100}
              stroke={8}
              sublabel={founder.scores.traction >= 70 ? "Growing" : "Early"}
            />
            <div className="flex-1 space-y-2">
              <ScoreBar label="Prototype" value={founder.stage === "Idea" ? 20 : 80} />
              <ScoreBar label="Users" value={company ? 60 : 15} />
              <ScoreBar label="Revenue" value={company?.kpis.arr ? 55 : 5} />
              <ScoreBar label="Partnerships" value={company ? 50 : 10} />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ExternalRow({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-between rounded-lg border border-border/60 bg-elevated/50 px-3 py-1.5 hover:border-mint/40 hover:text-mint"
    >
      <span className="inline-flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <ExternalLink className="h-3 w-3 text-muted-foreground" />
    </a>
  );
}
