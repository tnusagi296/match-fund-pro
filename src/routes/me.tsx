import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
} from "lucide-react";
import { AppShell } from "@/components/matchfund/AppShell";
import { ScoreRing } from "@/components/matchfund/ScoreRing";

export const Route = createFileRoute("/me")({
  head: () => ({ meta: [{ title: "My founder profile — Match Fund" }] }),
  component: FounderOnboarding,
});

const STEPS = ["Identity", "Signal Crawl", "Pitch", "Preview"] as const;

function FounderOnboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [links, setLinks] = useState({ linkedin: "", github: "", site: "" });
  const [deckName, setDeckName] = useState("");
  const [crawling, setCrawling] = useState(false);
  const [crawlDone, setCrawlDone] = useState(false);
  const [foundSignals, setFoundSignals] = useState<string[]>([]);

  useEffect(() => {
    if (step === 1 && !crawlDone && (links.linkedin || links.github)) {
      setCrawling(true);
      const signals = [
        "GitHub: 12 repos · High commit velocity",
        "LinkedIn: 5 years at applied ML",
        "Hackathon: 2 wins in the last 12 months",
        "Publications: 3 papers on arXiv",
        "Community: Contributor to 4 OSS projects",
      ];
      let i = 0;
      const iv = setInterval(() => {
        i++;
        setFoundSignals(signals.slice(0, i));
        if (i >= signals.length) {
          clearInterval(iv);
          setCrawling(false);
          setCrawlDone(true);
        }
      }, 500);
      return () => clearInterval(iv);
    }
  }, [step, crawlDone, links.linkedin, links.github]);

  return (
    <AppShell>
      <div className="mb-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">Founder</div>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Build your profile</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Match Fund crawls public signals so investors see evidence over pedigree.
        </p>
      </div>

      {/* stepper */}
      <div className="mb-8 flex items-center gap-2 rounded-2xl border border-border bg-card p-2">
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
        <div className="col-span-8 rounded-2xl border border-border bg-card p-6">
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
              <div className="flex items-center gap-2">
                <Radar className="h-4 w-4 text-mint" />
                <h2 className="text-lg font-medium">Crawling public signals</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                We aggregate GitHub, hackathon results, papers, and community activity to build evidence.
              </p>

              <div className="relative mt-6 overflow-hidden rounded-xl border border-border bg-elevated/50 p-6">
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
                  {foundSignals.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border border-mint/20 bg-mint-soft/40 p-2.5 text-xs"
                      style={{
                        animation: "fadeInUp 0.3s ease-out",
                      }}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-mint" />
                      {s}
                    </div>
                  ))}
                  {!foundSignals.length && (
                    <div className="text-center text-xs text-muted-foreground py-6">
                      {links.linkedin || links.github
                        ? "Preparing crawl…"
                        : "Add a link on step 1 to start the crawl."}
                    </div>
                  )}
                </div>
              </div>

              {crawlDone && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-mint/30 bg-mint-soft/40 p-3 text-xs text-mint">
                  <Check className="h-4 w-4" />
                  Crawl complete. Evidence-backed profile is ready to review.
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-lg font-medium">Upload your pitch</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                PDF or Keynote — we extract highlights automatically for investors.
              </p>
              <label className="mt-6 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-elevated/30 p-12 text-center transition hover:border-mint/40">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-mint-soft">
                  <Upload className="h-5 w-5 text-mint" />
                </div>
                <div className="text-sm font-medium">
                  {deckName ? deckName : "Drop your deck or click to browse"}
                </div>
                <div className="text-[11px] text-muted-foreground">PDF, PPTX, KEY · up to 25MB</div>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setDeckName(e.target.files?.[0]?.name ?? "")}
                />
              </label>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {["Problem", "Solution", "Traction"].map((t) => (
                  <div key={t} className="rounded-lg border border-border bg-elevated/40 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t}</div>
                    <div className="mt-1 text-xs">
                      {deckName ? "Extracted ✓" : "Waiting for deck…"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-lg font-medium">Preview your profile</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                This is exactly what investors will see when they swipe on you.
              </p>
              <div className="mt-5 flex items-start gap-5 rounded-2xl border border-border bg-elevated/40 p-5">
                <div className="grid h-16 w-16 place-items-center rounded-xl bg-mint text-lg font-bold text-primary-foreground">
                  {(name || "You").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-lg font-semibold">{name || "Your name"}</div>
                  <div className="text-xs text-muted-foreground">{headline || "Your headline"}</div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {foundSignals.slice(0, 3).map((s, i) => (
                      <span key={i} className="rounded-full border border-mint/30 bg-mint-soft px-2 py-0.5 text-[10px] text-mint">
                        {s.split(":")[0]}
                      </span>
                    ))}
                  </div>
                </div>
                <ScoreRing value={foundSignals.length ? 78 : 42} size={90} stroke={6} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <Perk icon={Trophy} title="Hackathon wins" value={foundSignals.length ? "2" : "—"} />
                <Perk icon={Award} title="OSS contributions" value={foundSignals.length ? "4" : "—"} />
                <Perk icon={Cloud} title="Deck attached" value={deckName ? "Yes" : "No"} />
              </div>
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
            ) : (
              <Link
                to="/grants"
                className="rounded-full bg-mint px-5 py-1.5 text-xs font-medium text-primary-foreground"
              >
                Publish & find grants →
              </Link>
            )}
          </div>
        </div>

        <aside className="col-span-4 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4 text-mint" /> Why we crawl
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Investors on Match Fund see verified signals — hackathon results, open-source impact, and traction —
              not just resumes. Pre-seed founders shine here.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileUp className="h-4 w-4 text-mint" /> Optional uploads
            </div>
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <li>· Pitch deck (PDF)</li>
              <li>· Demo video</li>
              <li>· Cap table</li>
              <li>· Data room link</li>
            </ul>
          </div>
        </aside>
      </div>

      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes fadeInUp { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } }
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
      <div className="flex items-center gap-2 rounded-lg border border-border bg-elevated/50 px-3 py-2 focus-within:border-mint/40">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {children}
      </div>
    </label>
  );
}

function Perk({ icon: Icon, title, value }: { icon: React.ComponentType<{ className?: string }>; title: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-elevated/40 p-3">
      <Icon className="h-3.5 w-3.5 text-mint" />
      <div className="mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}
