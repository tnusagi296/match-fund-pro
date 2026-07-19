// Founder profile workspace — the single-page editor shown at
// /founder/profile and /demo/founder/profile.
//
// Reuses the existing draft persistence path (`useDraft`) so nothing here
// touches the backend contract. The Signal Crawl action calls the same
// `runFounderCrawl` service the previous wizard used; failure never blocks
// the founder from completing/publishing their profile.

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Eye,
  Github,
  Globe,
  Info,
  Linkedin,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  CONTACT_AVAILABILITIES,
  FOUNDER_STAGES,
  FUNDRAISING_STATUSES,
  type FounderProfile,
  type FounderProject,
  type FounderSignal,
  computeCompletion,
  provenanceFor,
} from "@/lib/founder-profile";
import { PROVENANCE_COPY, type Provenance } from "@/lib/founder-metrics";
import { validateIdentityLinks, type GithubResult } from "@/lib/identity";
import { runFounderCrawl, CrawlError } from "@/services/crawlService";

type CrawlState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "success";
      github: GithubResult;
      signalCount: number;
      profileId: string;
      alreadyPublished: boolean;
    }
  | { kind: "timeout"; requestId: string }
  | { kind: "error"; requestId?: string; reason: "network" | "server" | "invalid_response" };

export type FounderWorkspaceProps = {
  profile: FounderProfile;
  onChange: (updater: (prev: FounderProfile) => FounderProfile) => void;
  onPublish?: () => void | Promise<void>;
  publishState?: "idle" | "publishing" | "published" | "error";
  publishMessage?: string;
  demoMode?: boolean;
  saveStatus?: React.ReactNode;
  // Optional: a hook to invoke the crawl through the isolated service.
  // Provided in production; the demo route passes a mock implementation
  // so /demo works without live third-party APIs.
  invokeCrawl?: Parameters<typeof runFounderCrawl>[1]["invoke"];
  previewHref?: string;
};

export function FounderProfileWorkspace({
  profile,
  onChange,
  onPublish,
  publishState = "idle",
  publishMessage,
  demoMode,
  saveStatus,
  invokeCrawl,
  previewHref = "/founder/preview",
}: FounderWorkspaceProps) {
  const completion = useMemo(() => computeCompletion(profile), [profile]);
  const [crawl, setCrawl] = useState<CrawlState>({ kind: "idle" });
  const [linkErrors, setLinkErrors] = useState<{
    github?: string;
    linkedin?: string;
    site?: string;
  }>({});
  const [sectorDraft, setSectorDraft] = useState("");
  const [skillDraft, setSkillDraft] = useState("");

  const set = <K extends keyof FounderProfile>(key: K, value: FounderProfile[K]) =>
    onChange((p) => ({ ...p, [key]: value }));

  function addChip(field: "sectors" | "skills", value: string) {
    const v = value.trim();
    if (!v) return;
    onChange((p) => {
      const existing = p[field];
      if (existing.includes(v)) return p;
      return { ...p, [field]: [...existing, v] };
    });
  }
  function removeChip(field: "sectors" | "skills", value: string) {
    onChange((p) => ({ ...p, [field]: p[field].filter((x) => x !== value) }));
  }

  async function runCrawl() {
    setCrawl({ kind: "loading" });
    const links = validateIdentityLinks({
      github: profile.github,
      linkedin: profile.linkedin,
      site: profile.site,
    });
    setLinkErrors(links.errors);
    if (!links.ok || !links.normalized.github) {
      setCrawl({ kind: "idle" });
      return;
    }
    if (!invokeCrawl) {
      // In demo mode with no invocation adapter, synthesize a mock success
      // so the walkthrough still lands on the "verified GitHub + signals"
      // state without touching production data.
      const mockSignals: FounderSignal[] = [
        {
          id: "demo-1",
          kind: "repo",
          label: `${links.normalized.github.handle} — top public repository`,
          source: "GitHub",
          url: links.normalized.github.profileUrl,
          provenance: "observed",
        },
        {
          id: "demo-2",
          kind: "site",
          label: "Personal site listed on GitHub profile",
          source: "Web",
          provenance: "observed",
        },
      ];
      onChange((p) => ({
        ...p,
        github: links.normalized.github!.handle,
        signals: mergeSignals(p.signals, mockSignals),
      }));
      setCrawl({
        kind: "success",
        github: links.normalized.github,
        signalCount: mockSignals.length,
        profileId: "demo",
        alreadyPublished: false,
      });
      return;
    }
    try {
      const result = await runFounderCrawl(
        {
          name: profile.name || links.normalized.github.handle,
          headline: profile.headline,
          github: links.normalized.github.handle,
          linkedin: links.normalized.linkedin,
          site: links.normalized.site,
          deckText: profile.deckText,
        },
        { invoke: invokeCrawl },
      );
      // Normalize the crawl result into our signal shape without inventing
      // fields — we only know the crawl surfaced `signalCount` signals.
      const observedSignals: FounderSignal[] = Array.from({
        length: Math.min(result.signalCount, 8),
      }).map((_, i) => ({
        id: `${result.profileId}-${i}`,
        kind: "observed",
        label: `Public signal #${i + 1}`,
        source: "GitHub",
        provenance: "observed",
      }));
      onChange((p) => ({
        ...p,
        github: links.normalized.github!.handle,
        signals: mergeSignals(p.signals, observedSignals),
      }));
      setCrawl({
        kind: "success",
        github: links.normalized.github,
        signalCount: result.signalCount,
        profileId: result.profileId,
        alreadyPublished: result.alreadyPublished,
      });
    } catch (error) {
      if (error instanceof CrawlError) {
        if (error.failure.kind === "timeout") {
          setCrawl({ kind: "timeout", requestId: error.failure.requestId });
        } else {
          setCrawl({
            kind: "error",
            requestId: error.failure.requestId,
            reason: error.failure.kind,
          });
        }
        return;
      }
      // eslint-disable-next-line no-console
      console.warn("[founder-workspace] crawl failed", error);
      setCrawl({ kind: "error", reason: "server" });
    }
  }

  const canPublish =
    completion.percent >= 60 &&
    profile.name.trim().length > 0 &&
    publishState !== "publishing";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* Main column */}
      <div className="space-y-6">
        <header>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
                Founder
              </div>
              <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
                My profile
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                Your workspace. Investors only see fields once you publish — everything else
                stays private.
              </p>
            </div>
            {saveStatus}
          </div>
        </header>

        {/* Basics */}
        <Section title="Basics" description="Who you are and what you're working on.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Full name"
              required
              prov={provenanceFor(profile, "name")}
            >
              <input
                className="input"
                value={profile.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Alex Chen"
              />
            </Field>
            <Field label="Location" prov={provenanceFor(profile, "location")}>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="input pl-8"
                  value={profile.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="Berlin, Germany"
                />
              </div>
            </Field>
            <Field
              label="Headline"
              prov={provenanceFor(profile, "headline")}
              className="sm:col-span-2"
            >
              <input
                className="input"
                value={profile.headline}
                onChange={(e) => set("headline", e.target.value)}
                placeholder="Building open-source infra for climate telemetry"
              />
            </Field>
            <Field
              label="Biography"
              prov={provenanceFor(profile, "biography")}
              className="sm:col-span-2"
              hint="A few sentences on your background and why you're building this."
            >
              <textarea
                className="input min-h-[120px]"
                value={profile.biography}
                onChange={(e) => set("biography", e.target.value)}
                placeholder="Ex-Foo Corp staff engineer. Now building…"
              />
            </Field>
            <Field
              label="Current company or project"
              prov={provenanceFor(profile, "currentCompany")}
            >
              <input
                className="input"
                value={profile.currentCompany}
                onChange={(e) => set("currentCompany", e.target.value)}
                placeholder="Fluxline (stealth)"
              />
            </Field>
            <Field label="Founder stage" prov={provenanceFor(profile, "stage")}>
              <select
                className="input"
                value={profile.stage}
                onChange={(e) => set("stage", e.target.value as FounderProfile["stage"])}
              >
                <option value="">Select stage…</option>
                {FOUNDER_STAGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        {/* Sectors & skills */}
        <Section title="Sectors & skills" description="What you invest your time in.">
          <div className="grid gap-4 sm:grid-cols-2">
            <ChipEditor
              label="Sectors"
              prov={provenanceFor(profile, "sectors")}
              values={profile.sectors}
              draft={sectorDraft}
              setDraft={setSectorDraft}
              onAdd={(v) => {
                addChip("sectors", v);
                setSectorDraft("");
              }}
              onRemove={(v) => removeChip("sectors", v)}
              placeholder="Climate, AI, Fintech…"
            />
            <ChipEditor
              label="Skills"
              prov={provenanceFor(profile, "skills")}
              values={profile.skills}
              draft={skillDraft}
              setDraft={setSkillDraft}
              onAdd={(v) => {
                addChip("skills", v);
                setSkillDraft("");
              }}
              onRemove={(v) => removeChip("skills", v)}
              placeholder="Rust, ML systems, Growth…"
            />
          </div>
        </Section>

        {/* Identity */}
        <Section
          title="Identity links"
          description="Public URLs investors will click through to verify."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="GitHub username"
              prov={provenanceFor(profile, "github")}
              error={linkErrors.github}
              icon={<Github className="h-3.5 w-3.5" />}
            >
              <input
                className="input"
                value={profile.github}
                onChange={(e) => set("github", e.target.value)}
                placeholder="octocat"
              />
            </Field>
            <Field
              label="LinkedIn"
              prov={provenanceFor(profile, "linkedin")}
              error={linkErrors.linkedin}
              icon={<Linkedin className="h-3.5 w-3.5" />}
            >
              <input
                className="input"
                value={profile.linkedin}
                onChange={(e) => set("linkedin", e.target.value)}
                placeholder="https://linkedin.com/in/alex"
              />
            </Field>
            <Field
              label="Personal site"
              prov={provenanceFor(profile, "site")}
              error={linkErrors.site}
              icon={<Globe className="h-3.5 w-3.5" />}
            >
              <input
                className="input"
                value={profile.site}
                onChange={(e) => set("site", e.target.value)}
                placeholder="https://alex.dev"
              />
            </Field>
          </div>
        </Section>

        {/* Signal Crawl */}
        <Section
          title="Public signal crawl"
          description="Analyze publicly observable evidence from your GitHub profile. Results attach to your draft — nothing is published until you publish."
        >
          <SignalCrawlPanel
            state={crawl}
            handle={profile.github}
            onRun={runCrawl}
            demoMode={demoMode}
          />
          {profile.signals.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {profile.signals.slice(0, 6).map((s) => (
                <div
                  key={s.id}
                  className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate font-medium">{s.label}</div>
                    <ProvenanceTag prov={s.provenance ?? "observed"} />
                  </div>
                  {s.source && (
                    <div className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      {s.source}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Projects */}
        <Section
          title="Projects"
          description="Highlight two or three shippable things. Populated automatically after crawl; you can edit or add your own."
        >
          <ProjectsEditor
            projects={profile.projects}
            onChange={(next) => set("projects", next)}
          />
        </Section>

        {/* Traction */}
        <Section
          title="Traction & strongest signal"
          description="Your best proof point in one line — the thing an investor should remember."
        >
          <Field label="Strongest signal" prov={provenanceFor(profile, "signals")}>
            <textarea
              className="input min-h-[80px]"
              value={profile.strongestSignal}
              onChange={(e) => set("strongestSignal", e.target.value)}
              placeholder="Open-source protocol adopted by 3 grid operators in 6 months."
            />
          </Field>
        </Section>

        {/* Fundraising & contact */}
        <Section title="Fundraising & contact">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Fundraising status"
              prov={provenanceFor(profile, "fundraisingStatus")}
            >
              <select
                className="input"
                value={profile.fundraisingStatus}
                onChange={(e) =>
                  set(
                    "fundraisingStatus",
                    e.target.value as FounderProfile["fundraisingStatus"],
                  )
                }
              >
                <option value="">Select…</option>
                {FUNDRAISING_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Contact availability"
              prov={provenanceFor(profile, "contactAvailability")}
            >
              <select
                className="input"
                value={profile.contactAvailability}
                onChange={(e) =>
                  set(
                    "contactAvailability",
                    e.target.value as FounderProfile["contactAvailability"],
                  )
                }
              >
                <option value="">Select…</option>
                {CONTACT_AVAILABILITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        {/* Publish */}
        <Section
          title="Publish"
          description="When you publish, investors can discover your public profile. Draft edits remain private until republished."
        >
          {onPublish ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="btn-primary"
                disabled={!canPublish}
                onClick={() => void onPublish()}
              >
                {publishState === "publishing" ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Publishing…
                  </>
                ) : profile.published ? (
                  <>Republish profile</>
                ) : (
                  <>Publish profile</>
                )}
              </button>
              <Link to={previewHref} className="btn-ghost">
                <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview as investor
              </Link>
              {completion.percent < 60 && (
                <span className="text-xs text-muted-foreground">
                  Complete at least 60% of the profile to publish.
                </span>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-muted-foreground">
              Publishing is being connected. Your edits are saved as a draft.
            </div>
          )}
          {publishState === "published" && (
            <div className="mt-3 rounded-xl border border-mint/30 bg-mint-soft/60 p-3 text-sm text-mint">
              <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
              {publishMessage ?? "Profile published — investors can now discover you."}
            </div>
          )}
          {publishState === "error" && (
            <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-300">
              Publishing didn’t complete. Please try again in a moment.
            </div>
          )}
        </Section>
      </div>

      {/* Side rail */}
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <CompletionCard
          percent={completion.percent}
          verified={profile.verified}
          published={profile.published}
          previewHref={previewHref}
        />
        <ProvenanceLegend />
        {demoMode && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-xs text-amber-200">
            <div className="mb-1 font-medium uppercase tracking-[0.15em]">Demo mode</div>
            Isolated demo profile. Edits are not saved to your real profile and won't leave this
            demo.
          </div>
        )}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl glass p-6">
      <div className="mb-4">
        <h2 className="font-display text-lg font-medium">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  error,
  icon,
  hint,
  prov,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  icon?: React.ReactNode;
  hint?: string;
  prov?: Provenance;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          {icon}
          <span>
            {label}
            {required && <span className="text-mint"> *</span>}
          </span>
        </span>
        {prov && <ProvenanceTag prov={prov} />}
      </div>
      {children}
      {hint && !error && <div className="mt-1 text-[11px] text-muted-foreground/80">{hint}</div>}
      {error && <div className="mt-1 text-xs text-amber-400">{error}</div>}
    </label>
  );
}

function ProvenanceTag({ prov }: { prov: Provenance }) {
  const tone =
    prov === "verified"
      ? "border-mint/30 bg-mint-soft text-mint"
      : prov === "observed"
        ? "border-sky-400/30 bg-sky-500/10 text-sky-300"
        : prov === "self-reported"
          ? "border-white/10 bg-white/5 text-muted-foreground"
          : prov === "inferred"
            ? "border-amber-400/20 bg-amber-500/5 text-amber-200"
            : "border-white/5 bg-white/[0.02] text-muted-foreground/70";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] ${tone}`}
    >
      {PROVENANCE_COPY[prov]}
    </span>
  );
}

function ChipEditor({
  label,
  prov,
  values,
  draft,
  setDraft,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string;
  prov: Provenance;
  values: string[];
  draft: string;
  setDraft: (v: string) => void;
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <ProvenanceTag prov={prov} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs"
          >
            {v}
            <button
              type="button"
              onClick={() => onRemove(v)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${v}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          className="input flex-1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              onAdd(draft);
            }
          }}
          placeholder={placeholder}
        />
        <button type="button" className="btn-ghost" onClick={() => onAdd(draft)}>
          Add
        </button>
      </div>
    </div>
  );
}

function ProjectsEditor({
  projects,
  onChange,
}: {
  projects: FounderProject[];
  onChange: (next: FounderProject[]) => void;
}) {
  const [draft, setDraft] = useState({ name: "", description: "", url: "" });
  function add() {
    if (!draft.name.trim()) return;
    onChange([
      ...projects,
      {
        id: `p_${Date.now()}`,
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        url: draft.url.trim() || undefined,
        provenance: "self-reported",
      },
    ]);
    setDraft({ name: "", description: "", url: "" });
  }
  return (
    <div className="space-y-3">
      {projects.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-muted-foreground">
          No projects yet. Run the signal crawl or add one manually below.
        </div>
      )}
      {projects.map((p) => (
        <div
          key={p.id}
          className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-medium">{p.name}</div>
              <ProvenanceTag prov={p.provenance ?? "self-reported"} />
            </div>
            {p.description && (
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {p.description}
              </div>
            )}
            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex text-[11px] text-mint hover:underline"
              >
                {p.url}
              </a>
            )}
          </div>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onChange(projects.filter((x) => x.id !== p.id))}
            aria-label={`Remove ${p.name}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          className="input"
          placeholder="Project name"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <input
          className="input"
          placeholder="Short description"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
        <button type="button" className="btn-ghost" onClick={add}>
          Add project
        </button>
        <input
          className="input sm:col-span-3"
          placeholder="URL (optional)"
          value={draft.url}
          onChange={(e) => setDraft({ ...draft, url: e.target.value })}
        />
      </div>
    </div>
  );
}

function SignalCrawlPanel({
  state,
  handle,
  onRun,
  demoMode,
}: {
  state: CrawlState;
  handle: string;
  onRun: () => void;
  demoMode?: boolean;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {handle ? (
            <>
              We'll analyze <span className="text-foreground">@{handle}</span> and attach
              publicly observable signals to your draft.
            </>
          ) : (
            <>Add a GitHub username above to enable the signal crawl.</>
          )}
        </div>
        <button
          className="btn-primary"
          onClick={onRun}
          disabled={!handle || state.kind === "loading"}
        >
          {state.kind === "loading" ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Analyzing…
            </>
          ) : state.kind === "success" ? (
            <>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Re-run
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Run signal crawl
            </>
          )}
        </button>
      </div>

      {state.kind === "loading" && (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-xl border border-white/10 bg-white/[0.04]"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      )}

      {state.kind === "success" && (
        <div className="mt-4 rounded-xl border border-mint/30 bg-mint-soft/60 p-4 text-sm">
          <div className="flex items-center gap-2 text-mint">
            <BadgeCheck className="h-4 w-4" />
            <span className="font-medium">
              Verified public GitHub profile: @{state.github.handle}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <img
              src={state.github.avatarUrl}
              alt=""
              className="h-10 w-10 rounded-full border border-white/10"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="text-xs text-muted-foreground">
              {state.signalCount} public signal{state.signalCount === 1 ? "" : "s"} attached to
              your draft ·{" "}
              <a
                className="underline hover:text-foreground"
                href={state.github.profileUrl}
                target="_blank"
                rel="noreferrer"
              >
                {state.github.profileUrl}
              </a>
            </div>
          </div>
          {demoMode && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Demo mode uses synthesized signals — no live crawl was executed.
            </p>
          )}
        </div>
      )}

      {state.kind === "timeout" && (
        <CrawlFailure
          title="Analysis took too long to respond."
          body="Public sources can be slow. Try again — usually the second attempt completes."
          onRetry={onRun}
          reference={state.requestId}
        />
      )}
      {state.kind === "error" && (
        <CrawlFailure
          title="We couldn’t analyze your public signals right now."
          body={
            state.reason === "network"
              ? "Looks like a connection hiccup. Check your network and retry."
              : state.reason === "invalid_response"
                ? "The analysis returned an unexpected shape. Retry, or continue and finish later."
                : "You can retry, or continue setting up your profile and add public signals later."
          }
          onRetry={onRun}
          reference={state.requestId}
        />
      )}
    </div>
  );
}

function CrawlFailure({
  title,
  body,
  onRetry,
  reference,
}: {
  title: string;
  body: string;
  onRetry: () => void;
  reference?: string;
}) {
  return (
    <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
      <div className="flex items-center gap-2 text-amber-300">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      {reference && (
        <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">
          ref {reference}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button className="btn-ghost" onClick={onRetry}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try again
        </button>
        <span className="self-center text-xs text-muted-foreground">
          You can continue and finish later.
        </span>
      </div>
    </div>
  );
}

function CompletionCard({
  percent,
  verified,
  published,
  previewHref,
}: {
  percent: number;
  verified: boolean;
  published: boolean;
  previewHref: string;
}) {
  return (
    <div className="rounded-2xl glass p-5">
      <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Profile status
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-4xl font-semibold tabular-nums">{percent}%</span>
        <span className="text-xs text-muted-foreground">complete</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div className="h-full bg-mint" style={{ width: `${percent}%` }} />
      </div>
      <ul className="mt-4 space-y-2 text-xs">
        <StatusRow
          label="Verification"
          value={verified ? "Verified founder" : "Not verified"}
          ok={verified}
        />
        <StatusRow
          label="Publication"
          value={published ? "Published — investors can see it" : "Draft — private"}
          ok={published}
        />
      </ul>
      <Link
        to={previewHref}
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full glass-subtle px-3 py-2 text-xs font-medium hover:bg-white/[0.08]"
      >
        <Eye className="h-3.5 w-3.5" /> How investors see me
        <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`inline-flex items-center gap-1 ${
          ok ? "text-mint" : "text-muted-foreground"
        }`}
      >
        {ok ? <CheckCircle2 className="h-3 w-3" /> : <Info className="h-3 w-3" />}
        {value}
      </span>
    </li>
  );
}

function ProvenanceLegend() {
  return (
    <div className="rounded-2xl glass p-5">
      <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Provenance
      </div>
      <ul className="mt-3 space-y-2 text-xs">
        <li className="flex items-center justify-between">
          <span className="text-muted-foreground">Verified</span>
          <ProvenanceTag prov="verified" />
        </li>
        <li className="flex items-center justify-between">
          <span className="text-muted-foreground">Publicly observed</span>
          <ProvenanceTag prov="observed" />
        </li>
        <li className="flex items-center justify-between">
          <span className="text-muted-foreground">Founder-provided</span>
          <ProvenanceTag prov="self-reported" />
        </li>
        <li className="flex items-center justify-between">
          <span className="text-muted-foreground">Inferred</span>
          <ProvenanceTag prov="inferred" />
        </li>
        <li className="flex items-center justify-between">
          <span className="text-muted-foreground">Missing</span>
          <ProvenanceTag prov="missing" />
        </li>
      </ul>
    </div>
  );
}

function mergeSignals(existing: FounderSignal[], incoming: FounderSignal[]): FounderSignal[] {
  const byId = new Map(existing.map((s) => [s.id, s]));
  for (const s of incoming) byId.set(s.id, s);
  return Array.from(byId.values());
}
