import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Award,
  Check,
  Cloud,
  FileUp,
  Github,
  Globe,
  Linkedin,
  Radar,
  Sparkles,
  Trophy,
  Upload,
  Zap,
  AlertCircle,
} from "lucide-react";
import { AppShell } from "@/components/matchfund/AppShell";
import { ScoreRing, ScoreBar } from "@/components/matchfund/ScoreRing";
import { crawlAndScoreFounder, publishFounderProfile } from "@/lib/crawl.functions";

export const Route = createFileRoute("/me")({
  head: () => ({ meta: [{ title: "My founder profile — Match Fund" }] }),
  component: FounderOnboarding,
});

const STEPS = ["Identity", "Signal Crawl", "Pitch", "Preview"] as const;

type Signal = {
  source: string;
  kind: string;
  title: string;
  detail?: string;
  weight: number;
  evidence_url?: string;
};

type Scores = {
  founder_fit: number;
  technical_moat: number;
  traction: number;
  trust: number;
  overall: number;
  summary: string;
  highlights: string[];
};

const SOURCE_LABEL: Record<string, string> = {
  github: "GitHub",
  arxiv: "arXiv",
  semantic_scholar: "Semantic Scholar",
  profile: "Profile",
  deck: "Deck",
};

function FounderOnboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [links, setLinks] = useState({ linkedin: "", github: "", site: "" });
  const [deckName, setDeckName] = useState("");
  const [deckText, setDeckText] = useState("");
  const [crawling, setCrawling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [scores, setScores] = useState<Scores | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const crawlFn = useServerFn(crawlAndScoreFounder);
  const publishFn = useServerFn(publishFounderProfile);

  async function runCrawl() {
    if (!name.trim()) {
      setError("Add your name on step 1 first.");
      return;
    }
    setError(null);
    setCrawling(true);
    setSignals([]);
    setScores(null);
    try {
      const result = await crawlFn({
        data: {
          name,
          headline,
          github: links.github,
          linkedin: links.linkedin,
          site: links.site,
          deckText,
        },
      });
      setSignals(result.signals);
      setScores(result.scores);
      setProfileId(result.profileId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Crawl failed");
    } finally {
      setCrawling(false);
    }
  }

  async function handleDeck(file: File | undefined) {
    if (!file) return;
    setDeckName(file.name);
    if (file.type === "application/pdf" || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
      try {
        const text = await file.text();
        // strip binary noise; keep ASCII-ish
        setDeckText(text.replace(/[^\x20-\x7E\n]+/g, " ").slice(0, 8000));
      } catch {
        // ignore
      }
    }
  }

  async function handlePublish() {
    if (!profileId) return;
    setPublishing(true);
    try {
      await publishFn({ data: { profileId } });
      setPublished(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">Founder</div>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Build your profile</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Match Fund crawls your public signals — GitHub, arXiv, Semantic Scholar — and scores you with AI.
        </p>
      </div>

      <div className="mb-8 flex items-center gap-2 rounded-2xl glass p-2">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i)}
            className={`flex-1 rounded-xl px-3 py-2 text-left transition ${
              i === step ? "bg-elevated" : "hover:bg-elevated/60"
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold ${
                  i < step
                    ? "bg-mint text-primary-foreground"
                    : i === step
                      ? "border-2 border-mint text-mint"
                      : "border border-border text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Step {i + 1}</div>
                <div className="text-xs font-medium">{s}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8 rounded-2xl glass p-6">
          {step === 0 && (
            <div>
              <h2 className="text-lg font-medium">Who are you building?</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                A few basics. We'll pull the rest from your links.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <Field label="Full name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Priya Patel"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                  />
                </Field>
                <Field label="Headline">
                  <input
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="Solo builder — climate x AI"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                  />
                </Field>
                <Field label="LinkedIn" icon={Linkedin}>
                  <input
                    value={links.linkedin}
                    onChange={(e) => setLinks({ ...links, linkedin: e.target.value })}
                    placeholder="linkedin.com/in/…"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                  />
                </Field>
                <Field label="GitHub" icon={Github}>
                  <input
                    value={links.github}
                    onChange={(e) => setLinks({ ...links, github: e.target.value })}
                    placeholder="github.com/…"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                  />
                </Field>
                <Field label="Personal site" icon={Globe}>
                  <input
                    value={links.site}
                    onChange={(e) => setLinks({ ...links, site: e.target.value })}
                    placeholder="yoursite.com"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                  />
                </Field>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radar className="h-4 w-4 text-mint" />
                  <h2 className="text-lg font-medium">Crawl public signals</h2>
                </div>
                <button
                  onClick={runCrawl}
                  disabled={crawling}
                  className="rounded-full bg-mint px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {crawling ? "Crawling…" : scores ? "Re-run crawl" : "Start crawl"}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Live pull from GitHub (repos, stars, velocity), arXiv, and Semantic Scholar. Gemini scores the evidence.
              </p>

              {error && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4" /> {error}
                </div>
              )}

              <div className="relative mt-6 overflow-hidden rounded-xl glass-subtle p-6">
                {crawling && (
                  <div
                    className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite]"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, oklch(0.86 0.17 155 / 0.15), transparent)",
                    }}
                  />
                )}
                <div className="space-y-2">
                  {signals.map((s, i) => (
                    <a
                      key={i}
                      href={s.evidence_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-lg border border-mint/20 bg-mint-soft/40 p-2.5 text-xs hover:border-mint/40"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-mint" />
                      <span className="rounded-full border border-mint/30 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-mint">
                        {SOURCE_LABEL[s.source] ?? s.source}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium">{s.title}</div>
                        {s.detail && <div className="text-muted-foreground">{s.detail}</div>}
                      </div>
                    </a>
                  ))}
                  {!crawling && signals.length === 0 && (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No signals yet. Add your GitHub handle on step 1, then click Start crawl.
                    </div>
                  )}
                </div>
              </div>

              {scores && (
                <div className="mt-4 grid grid-cols-12 gap-4 rounded-xl border border-mint/30 bg-mint-soft/30 p-4">
                  <div className="col-span-4 flex items-center justify-center">
                    <ScoreRing value={scores.overall} size={140} stroke={8} sublabel="Overall" />
                  </div>
                  <div className="col-span-8 space-y-2">
                    <ScoreBar label="Founder fit" value={scores.founder_fit} />
                    <ScoreBar label="Technical moat" value={scores.technical_moat} />
                    <ScoreBar label="Traction" value={scores.traction} />
                    <ScoreBar label="Trust" value={scores.trust} />
                  </div>
                  <div className="col-span-12 text-xs text-muted-foreground">{scores.summary}</div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-lg font-medium">Upload your pitch</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Text or PDF — we extract highlights and feed them into your score.
              </p>
              <label className="mt-6 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-elevated/30 p-12 text-center transition hover:border-mint/40">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-mint-soft">
                  <Upload className="h-5 w-5 text-mint" />
                </div>
                <div className="text-sm font-medium">
                  {deckName ? deckName : "Drop your deck or click to browse"}
                </div>
                <div className="text-[11px] text-muted-foreground">PDF, TXT, MD · up to 25MB</div>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => handleDeck(e.target.files?.[0])}
                />
              </label>

              {deckText && (
                <div className="mt-4 rounded-lg glass-subtle p-3 text-[11px] text-muted-foreground max-h-40 overflow-auto">
                  {deckText.slice(0, 600)}…
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                Re-run the crawl on step 2 after uploading to include deck signals in the score.
              </p>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-lg font-medium">Preview your profile</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                This is exactly what investors will see when they swipe on you.
              </p>
              <div className="mt-5 flex items-start gap-5 rounded-2xl glass-subtle p-5">
                <div className="grid h-16 w-16 place-items-center rounded-xl bg-mint text-lg font-bold text-primary-foreground">
                  {(name || "You").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-lg font-semibold">{name || "Your name"}</div>
                  <div className="text-xs text-muted-foreground">{headline || "Your headline"}</div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {signals.slice(0, 4).map((s, i) => (
                      <span key={i} className="rounded-full border border-mint/30 bg-mint-soft px-2 py-0.5 text-[10px] text-mint">
                        {s.title}
                      </span>
                    ))}
                  </div>
                </div>
                <ScoreRing value={scores?.overall ?? 0} size={90} stroke={6} />
              </div>
              {scores?.highlights && (
                <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                  {scores.highlights.map((h, i) => (
                    <li key={i} className="flex gap-2">
                      <Check className="h-3.5 w-3.5 text-mint shrink-0 mt-0.5" /> {h}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <Perk icon={Trophy} title="Signals found" value={String(signals.length)} />
                <Perk icon={Award} title="Overall score" value={scores ? String(scores.overall) : "—"} />
                <Perk icon={Cloud} title="Deck attached" value={deckName ? "Yes" : "No"} />
              </div>

              {published && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-mint/30 bg-mint-soft/40 p-3 text-xs text-mint">
                  <Check className="h-4 w-4" /> Published. Investors can now discover your profile.
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
            <button
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="rounded-full border border-border bg-elevated px-4 py-1.5 text-xs disabled:opacity-40"
            >
              Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="rounded-full bg-mint px-5 py-1.5 text-xs font-medium text-primary-foreground"
              >
                Continue →
              </button>
            ) : profileId && !published ? (
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="rounded-full bg-mint px-5 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {publishing ? "Publishing…" : "Publish profile →"}
              </button>
            ) : (
              <Link
                to="/grants"
                className="rounded-full bg-mint px-5 py-1.5 text-xs font-medium text-primary-foreground"
              >
                Find grants →
              </Link>
            )}
          </div>
        </div>

        <aside className="col-span-4 space-y-4">
          <div className="rounded-2xl glass p-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4 text-mint" /> Real pipeline
            </div>
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <li>· GitHub API — repos, stars, velocity</li>
              <li>· Semantic Scholar — papers, citations, h-index</li>
              <li>· arXiv — preprints under your name</li>
              <li>· Gemini 3.5 Flash — scoring & summary</li>
            </ul>
          </div>
          <div className="rounded-2xl glass p-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileUp className="h-4 w-4 text-mint" /> Optional uploads
            </div>
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <li>· Pitch deck (PDF / TXT)</li>
              <li>· Demo video link on your site</li>
            </ul>
          </div>
        </aside>
      </div>

      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
      `}</style>
    </AppShell>
  );
}

function Field({
  label,
  children,
  icon: Icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2 rounded-lg glass-subtle px-3 py-2 focus-within:border-mint/40">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {children}
      </div>
    </label>
  );
}

function Perk({ icon: Icon, title, value }: { icon: React.ComponentType<{ className?: string }>; title: string; value: string }) {
  return (
    <div className="rounded-lg glass-subtle p-3">
      <Icon className="h-3.5 w-3.5 text-mint" />
      <div className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}
