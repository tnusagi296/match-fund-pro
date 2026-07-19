import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Github,
  Globe,
  Mail,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import type { DemoClaimStage } from "@/lib/demo-founder";

export const Route = createFileRoute("/demo/founder/claim")({
  head: () => ({ meta: [{ title: "Demo — Claim your profile — MatchFund" }] }),
  component: DemoClaim,
});

type Candidate = {
  id: string;
  name: string;
  headline: string;
  location: string;
  github: string;
  site?: string;
  reason: string;
};

const CANDIDATES: Candidate[] = [
  {
    id: "c1",
    name: "Alex Chen",
    headline: "Open-source telemetry for climate infrastructure",
    location: "Berlin, Germany",
    github: "alex-chen",
    site: "https://fluxline.io",
    reason: "Matched by GitHub handle and personal site",
  },
  {
    id: "c2",
    name: "Alex Chen",
    headline: "ML infra @ ex-DeepMind, exploring dev tools",
    location: "London, UK",
    github: "achen-ml",
    reason: "Matched by name and prior company",
  },
  {
    id: "c3",
    name: "Alexandra Chen",
    headline: "Robotics founder, MIT Media Lab",
    location: "Boston, MA",
    github: "alexandrachen",
    site: "https://alexandra.dev",
    reason: "Matched by name and website",
  },
];

function DemoClaim() {
  const [stage, setStage] = useState<DemoClaimStage>("search");
  const [query, setQuery] = useState("Alex Chen");
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [method, setMethod] = useState<"email" | "github" | "manual" | null>(null);

  return (
    <div className="relative min-h-screen bg-aurora text-foreground">
      <div className="sticky top-0 z-40 border-b border-amber-400/30 bg-amber-500/10 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-[1400px] items-center justify-between gap-4 px-6 text-xs">
          <div className="flex items-center gap-2 text-amber-200">
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-medium uppercase tracking-[0.15em]">
              Demo mode
            </span>
            <span>Isolated claim walkthrough — no real records are created.</span>
          </div>
          <Link to="/demo" className="text-muted-foreground hover:text-foreground">
            Exit
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        <header className="mb-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
            Founder onboarding
          </div>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
            Claim your founder profile
          </h1>
        </header>

        <Steps stage={stage} />

        <div className="mt-6">
          {stage === "search" && (
            <SearchStep
              query={query}
              setQuery={setQuery}
              onFindMatches={() => setStage("matches")}
            />
          )}
          {stage === "matches" && (
            <MatchesStep
              candidates={CANDIDATES}
              onBack={() => setStage("search")}
              onClaim={(c) => {
                setSelected(c);
                setStage("verify");
              }}
            />
          )}
          {stage === "verify" && selected && (
            <VerifyStep
              candidate={selected}
              method={method}
              setMethod={setMethod}
              onBack={() => setStage("matches")}
              onSubmit={() => setStage("submitted")}
            />
          )}
          {stage === "submitted" && selected && (
            <SubmittedStep
              candidate={selected}
              onContinue={() => setStage("verified")}
            />
          )}
          {stage === "verified" && selected && (
            <VerifiedStep candidate={selected} />
          )}
        </div>
      </main>
    </div>
  );
}

function Steps({ stage }: { stage: DemoClaimStage }) {
  const order: DemoClaimStage[] = ["search", "matches", "verify", "submitted", "verified"];
  const labels: Record<DemoClaimStage, string> = {
    search: "Search",
    matches: "Matches",
    verify: "Verify",
    submitted: "Submitted",
    verified: "Verified",
  };
  const idx = order.indexOf(stage);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {order.map((key, i) => (
        <li
          key={key}
          className={`flex items-center gap-2 rounded-full border px-3 py-1 ${
            i === idx
              ? "border-mint bg-mint-soft text-mint"
              : i < idx
                ? "border-white/20 bg-white/5 text-white/80"
                : "border-white/10 text-white/50"
          }`}
        >
          <span className="tabular-nums">{i + 1}</span>
          <span>{labels[key]}</span>
        </li>
      ))}
    </ol>
  );
}

function SearchStep({
  query,
  setQuery,
  onFindMatches,
}: {
  query: string;
  setQuery: (v: string) => void;
  onFindMatches: () => void;
}) {
  return (
    <div className="rounded-2xl glass p-6">
      <div className="flex items-start gap-3">
        <Search className="mt-0.5 h-5 w-5 text-mint" />
        <div>
          <h2 className="font-display text-lg font-medium">Find your existing profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Search by name, GitHub, company, or website. Our crawler may have already discovered
            you.
          </p>
        </div>
      </div>
      <div className="mt-4">
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Alex Chen · github.com/alex-chen · fluxline.io"
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Link to="/demo/founder/profile" className="btn-ghost">
          Skip and create new
        </Link>
        <button className="btn-primary" onClick={onFindMatches}>
          Find matches <ChevronRight className="ml-1.5 h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MatchesStep({
  candidates,
  onBack,
  onClaim,
}: {
  candidates: Candidate[];
  onBack: () => void;
  onClaim: (c: Candidate) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {candidates.length} potential matches from our public crawl.
      </p>
      {candidates.map((c) => (
        <div key={c.id} className="rounded-2xl glass p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-display text-lg font-medium">{c.name}</div>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  Unclaimed public profile
                </span>
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">{c.headline}</div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {c.location}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Github className="h-3 w-3" />@{c.github}
                </span>
                {c.site && (
                  <span className="inline-flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {c.site.replace(/^https?:\/\//, "")}
                  </span>
                )}
              </div>
              <p className="mt-2 text-[11px] text-mint">{c.reason}</p>
            </div>
            <button className="btn-primary shrink-0" onClick={() => onClaim(c)}>
              Claim this profile
            </button>
          </div>
        </div>
      ))}
      <div className="flex justify-between pt-2">
        <button className="btn-ghost" onClick={onBack}>
          Back
        </button>
        <Link to="/demo/founder/profile" className="btn-ghost">
          None of these are me
        </Link>
      </div>
    </div>
  );
}

function VerifyStep({
  candidate,
  method,
  setMethod,
  onBack,
  onSubmit,
}: {
  candidate: Candidate;
  method: "email" | "github" | "manual" | null;
  setMethod: (m: "email" | "github" | "manual") => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl glass p-5">
        <div className="flex items-center gap-2 text-sm">
          <BadgeCheck className="h-4 w-4 text-mint" />
          Claiming <strong className="mx-1">{candidate.name}</strong> · @{candidate.github}
        </div>
      </div>
      <div className="rounded-2xl glass p-6">
        <h2 className="font-display text-lg font-medium">Verify ownership</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose one verification method. Investors only see verified profiles as “Verified
          founder”.
        </p>
        <div className="mt-4 grid gap-3">
          <VerifyOption
            active={method === "email"}
            onClick={() => setMethod("email")}
            icon={<Mail className="h-4 w-4" />}
            title="Professional email"
            body="We'll send a verification link to an email address on your company domain."
          />
          <VerifyOption
            active={method === "github"}
            onClick={() => setMethod("github")}
            icon={<Github className="h-4 w-4" />}
            title="GitHub ownership"
            body={`Sign in as @${candidate.github} on GitHub to confirm you control the account.`}
          />
          <VerifyOption
            active={method === "manual"}
            onClick={() => setMethod("manual")}
            icon={<UserCheck className="h-4 w-4" />}
            title="Manual review"
            body="Our team reviews your submission — typically within one business day."
          />
        </div>
      </div>
      <div className="flex justify-between">
        <button className="btn-ghost" onClick={onBack}>
          Back
        </button>
        <button className="btn-primary" disabled={!method} onClick={onSubmit}>
          Submit claim
        </button>
      </div>
    </div>
  );
}

function VerifyOption({
  active,
  onClick,
  icon,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
        active
          ? "border-mint bg-mint-soft/40"
          : "border-white/10 bg-white/5 hover:bg-white/[0.08]"
      }`}
    >
      <div className={`mt-0.5 ${active ? "text-mint" : "text-muted-foreground"}`}>{icon}</div>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{body}</div>
      </div>
    </button>
  );
}

function SubmittedStep({
  candidate,
  onContinue,
}: {
  candidate: Candidate;
  onContinue: () => void;
}) {
  return (
    <div className="rounded-2xl glass p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-mint-soft text-mint">
        <Sparkles className="h-5 w-5" />
      </div>
      <h2 className="mt-4 font-display text-2xl font-semibold">Profile claim submitted</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        We've received your claim for <strong>{candidate.name}</strong>. In the real product,
        verification would run against your chosen method.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <button className="btn-primary" onClick={onContinue}>
          Simulate verification success
        </button>
        <Link to="/demo/founder/profile" className="btn-ghost">
          Continue to profile
        </Link>
      </div>
    </div>
  );
}

function VerifiedStep({ candidate }: { candidate: Candidate }) {
  return (
    <div className="rounded-2xl glass p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-mint-soft text-mint">
        <ShieldCheck className="h-5 w-5" />
      </div>
      <h2 className="mt-4 font-display text-2xl font-semibold">Verified founder</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        <strong>{candidate.name}</strong> is now marked as a Verified founder in this demo.
        Investors would see the verification badge on your public profile.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link to="/demo/founder/profile" className="btn-primary inline-flex">
          <CheckCircle2 className="mr-1.5 h-4 w-4" /> Go to my demo profile
        </Link>
        <Link to="/demo/founder/preview" className="btn-ghost">
          Preview investor view
        </Link>
      </div>
    </div>
  );
}
