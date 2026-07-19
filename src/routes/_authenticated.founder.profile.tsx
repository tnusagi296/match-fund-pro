import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Github,
  Globe,
  Linkedin,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/matchfund/AppShell";
import { crawlFounderGraph, publishFounderProfile } from "@/lib/crawl.functions";
import { useDraft, deleteServerDraft } from "@/lib/drafts";
import { validateIdentityLinks, type GithubResult } from "@/lib/identity";

export const Route = createFileRoute("/_authenticated/founder/profile")({
  head: () => ({ meta: [{ title: "My profile — MatchFund" }] }),
  component: FounderProfileEditor,
});

type FounderDraft = {
  name: string;
  headline: string;
  github: string;
  linkedin: string;
  site: string;
  deckText: string;
  reviewed: boolean; // set to true after user reaches the Review step
};

const INITIAL: FounderDraft = {
  name: "",
  headline: "",
  github: "",
  linkedin: "",
  site: "",
  deckText: "",
  reviewed: false,
};

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
  | { kind: "error" };

function FounderProfileEditor() {
  const draft = useDraft<FounderDraft>("founder_profile", INITIAL);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [errors, setErrors] = useState<{ github?: string; linkedin?: string; site?: string }>({});
  const [crawl, setCrawl] = useState<CrawlState>({ kind: "idle" });
  const [publishState, setPublishState] = useState<"idle" | "publishing" | "published" | "error">(
    "idle",
  );

  const crawlFn = useServerFn(crawlFounderGraph);
  const publishFn = useServerFn(publishFounderProfile);

  const set = <K extends keyof FounderDraft>(key: K, value: FounderDraft[K]) =>
    draft.setPayload((p) => ({ ...p, [key]: value }));

  function validateAndAdvanceLinks() {
    const check = validateIdentityLinks({
      github: draft.payload.github,
      linkedin: draft.payload.linkedin,
      site: draft.payload.site,
    });
    setErrors(check.errors);
    if (!check.ok) return;
    if (check.normalized.github) set("github", check.normalized.github.handle);
    if (check.normalized.linkedin) set("linkedin", check.normalized.linkedin);
    if (check.normalized.site) set("site", check.normalized.site);
    setStep(2);
  }

  async function runCrawl() {
    setCrawl({ kind: "loading" });
    try {
      const links = validateIdentityLinks({
        github: draft.payload.github,
        linkedin: draft.payload.linkedin,
        site: draft.payload.site,
      });
      if (!links.ok || !links.normalized.github) {
        setErrors(links.errors);
        setCrawl({ kind: "idle" });
        setStep(1);
        return;
      }
      const result = await crawlFn({
        data: {
          name: draft.payload.name || links.normalized.github.handle,
          headline: draft.payload.headline,
          github: links.normalized.github.handle,
          linkedin: links.normalized.linkedin,
          site: links.normalized.site,
          deckText: draft.payload.deckText,
        },
      });
      setCrawl({
        kind: "success",
        github: links.normalized.github,
        signalCount: result.signals.length,
        profileId: result.profileId,
        alreadyPublished: result.alreadyPublished,
      });
    } catch (error) {
      // Never expose stack traces / worker URLs / raw runtime messages.
      // Log for observability, show a stable user-facing copy.
      // eslint-disable-next-line no-console
      console.warn("[founder-profile] signal crawl failed", error);
      setCrawl({ kind: "error" });
    }
  }

  async function publish(profileId: string) {
    setPublishState("publishing");
    try {
      await publishFn({ data: { profileId } });
      await deleteServerDraft("founder_profile");
      setPublishState("published");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("[founder-profile] publish failed", error);
      setPublishState("error");
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
            Founder
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-4">
            <h1 className="font-display text-4xl font-semibold tracking-tight">My profile</h1>
            <SaveStatus status={draft.status} restored={draft.restored} />
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Set up your public profile. Investors see the published version — drafts are private
            and never shown until you publish.
          </p>
        </header>

        <Steps step={step} />

        <div className="mt-6 rounded-2xl glass p-6">
          {step === 0 && (
            <BasicsStep
              draft={draft.payload}
              onChange={set}
              onNext={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <LinksStep
              draft={draft.payload}
              errors={errors}
              onChange={set}
              onBack={() => setStep(0)}
              onNext={validateAndAdvanceLinks}
            />
          )}
          {step === 2 && (
            <SignalsStep
              state={crawl}
              onRun={runCrawl}
              onBack={() => setStep(1)}
              onContinue={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <ReviewStep
              draft={draft.payload}
              crawl={crawl}
              publishState={publishState}
              onBack={() => setStep(2)}
              onPublish={() => {
                if (crawl.kind === "success") void publish(crawl.profileId);
              }}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

function SaveStatus({
  status,
  restored,
}: {
  status: ReturnType<typeof useDraft>["status"];
  restored: boolean;
}) {
  if (status === "saving")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  if (status === "saved")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-mint">
        <CheckCircle2 className="h-3 w-3" /> Saved
      </span>
    );
  if (status === "error")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-400">
        <AlertTriangle className="h-3 w-3" /> Draft not synced
      </span>
    );
  if (restored)
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        Draft restored
      </span>
    );
  return null;
}

function Steps({ step }: { step: number }) {
  const items = ["Basics", "Identity links", "Public signals", "Review"];
  return (
    <ol className="flex items-center gap-2 text-xs">
      {items.map((label, i) => (
        <li
          key={label}
          className={`flex items-center gap-2 rounded-full border px-3 py-1 ${
            i === step
              ? "border-mint bg-mint-soft text-mint"
              : i < step
                ? "border-white/20 bg-white/5 text-white/80"
                : "border-white/10 text-white/50"
          }`}
        >
          <span className="tabular-nums">{i + 1}</span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

function BasicsStep({
  draft,
  onChange,
  onNext,
}: {
  draft: FounderDraft;
  onChange: <K extends keyof FounderDraft>(k: K, v: FounderDraft[K]) => void;
  onNext: () => void;
}) {
  const canContinue = draft.name.trim().length > 0;
  return (
    <div className="space-y-4">
      <Field label="Name" required>
        <input
          className="input"
          value={draft.name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="Alex Chen"
        />
      </Field>
      <Field label="Headline">
        <input
          className="input"
          value={draft.headline}
          onChange={(e) => onChange("headline", e.target.value)}
          placeholder="Building open-source infra for climate telemetry"
        />
      </Field>
      <Field label="Pitch / short deck notes">
        <textarea
          className="input min-h-[120px]"
          value={draft.deckText}
          onChange={(e) => onChange("deckText", e.target.value)}
          placeholder="Paste 3–5 lines about the problem, wedge, and traction."
        />
      </Field>
      <div className="flex justify-end">
        <button
          className="btn-primary"
          disabled={!canContinue}
          onClick={onNext}
        >
          Continue <ArrowRight className="ml-1.5 h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function LinksStep({
  draft,
  errors,
  onChange,
  onBack,
  onNext,
}: {
  draft: FounderDraft;
  errors: { github?: string; linkedin?: string; site?: string };
  onChange: <K extends keyof FounderDraft>(k: K, v: FounderDraft[K]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="GitHub username or profile URL" required error={errors.github} icon={<Github className="h-4 w-4" />}>
        <input
          className="input"
          value={draft.github}
          onChange={(e) => onChange("github", e.target.value)}
          placeholder="octocat"
        />
      </Field>
      <Field label="LinkedIn URL (optional)" error={errors.linkedin} icon={<Linkedin className="h-4 w-4" />}>
        <input
          className="input"
          value={draft.linkedin}
          onChange={(e) => onChange("linkedin", e.target.value)}
          placeholder="https://linkedin.com/in/alexchen"
        />
      </Field>
      <Field label="Personal website (optional)" error={errors.site} icon={<Globe className="h-4 w-4" />}>
        <input
          className="input"
          value={draft.site}
          onChange={(e) => onChange("site", e.target.value)}
          placeholder="https://alexchen.dev"
        />
      </Field>
      <div className="flex justify-between">
        <button className="btn-ghost" onClick={onBack}>
          Back
        </button>
        <button className="btn-primary" onClick={onNext}>
          Continue <ArrowRight className="ml-1.5 h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SignalsStep({
  state,
  onRun,
  onBack,
  onContinue,
}: {
  state: CrawlState;
  onRun: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 text-mint" />
        <div>
          <div className="font-display text-lg font-medium">Analyze your public signals</div>
          <p className="mt-1 text-sm text-muted-foreground">
            We pull publicly observable evidence from your GitHub profile and open academic
            sources. Nothing is published — the results are attached to your draft profile.
          </p>
        </div>
      </div>

      {state.kind === "idle" && (
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={onRun}>
            Start analysis
          </button>
          <button className="btn-ghost" onClick={onContinue}>
            Skip and continue
          </button>
        </div>
      )}

      {state.kind === "loading" && (
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Analyzing your public signals…
        </div>
      )}

      {state.kind === "success" && (
        <div className="rounded-xl border border-mint/30 bg-mint-soft/60 p-4">
          <div className="flex items-center gap-2 text-mint">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-sm font-medium">
              Verified public GitHub profile: @{state.github.handle}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <img
              src={state.github.avatarUrl}
              alt=""
              className="h-10 w-10 rounded-full border border-white/10"
              onError={(e) => {
                // If avatar fails, hide it — don't block onboarding.
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <div className="text-xs text-muted-foreground">
              {state.signalCount} public signal{state.signalCount === 1 ? "" : "s"} attached to
              your draft ·{" "}
              <a
                className="underline hover:text-white"
                href={state.github.profileUrl}
                target="_blank"
                rel="noreferrer"
              >
                {state.github.profileUrl}
              </a>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button className="btn-ghost" onClick={onRun}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Re-run
            </button>
            <button className="btn-primary" onClick={onContinue}>
              Continue <ArrowRight className="ml-1.5 h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {state.kind === "error" && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              We couldn’t analyze your public signals right now.
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            You can retry, or continue setting up your profile and add public signals later.
          </p>
          <div className="mt-3 flex gap-2">
            <button className="btn-ghost" onClick={onRun}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try again
            </button>
            <button className="btn-primary" onClick={onContinue}>
              Continue with profile setup
            </button>
          </div>
        </div>
      )}

      <div className="pt-2">
        <button className="btn-ghost" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}

function ReviewStep({
  draft,
  crawl,
  publishState,
  onBack,
  onPublish,
}: {
  draft: FounderDraft;
  crawl: CrawlState;
  publishState: "idle" | "publishing" | "published" | "error";
  onBack: () => void;
  onPublish: () => void;
}) {
  const canPublish = crawl.kind === "success" && publishState !== "publishing";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <ReviewRow label="Name" value={draft.name || "—"} />
        <ReviewRow label="Headline" value={draft.headline || "—"} />
        <ReviewRow label="GitHub" value={draft.github ? `@${draft.github}` : "—"} />
        <ReviewRow label="LinkedIn" value={draft.linkedin || "—"} />
        <ReviewRow label="Website" value={draft.site || "—"} />
        <ReviewRow
          label="Public signals"
          value={
            crawl.kind === "success"
              ? `${crawl.signalCount} attached`
              : crawl.kind === "error"
                ? "Not analyzed"
                : "Not yet run"
          }
        />
      </div>

      {publishState === "published" && (
        <div className="rounded-xl border border-mint/30 bg-mint-soft/60 p-4 text-sm text-mint">
          <CheckCircle2 className="mr-1.5 inline h-4 w-4" /> Profile published — investors can now
          discover you.
        </div>
      )}
      {publishState === "error" && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          Publishing didn’t complete. Please try again in a moment.
        </div>
      )}

      <div className="flex justify-between">
        <button className="btn-ghost" onClick={onBack}>
          Back
        </button>
        <button className="btn-primary" onClick={onPublish} disabled={!canPublish}>
          {publishState === "publishing" ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Publishing…
            </>
          ) : (
            <>Publish profile</>
          )}
        </button>
      </div>
      {crawl.kind !== "success" && (
        <p className="text-right text-xs text-muted-foreground">
          Run the public signals analysis before publishing.
        </p>
      )}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate">{value}</div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  icon,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>
          {label}
          {required && <span className="text-mint"> *</span>}
        </span>
      </div>
      {children}
      {error && <div className="mt-1 text-xs text-amber-400">{error}</div>}
    </label>
  );
}
