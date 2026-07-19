import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Search, ExternalLink, AlertTriangle, Github } from "lucide-react";
import { discoverGitHubCandidates } from "@/lib/discovery.functions";

export const Route = createFileRoute("/admin/discover")({
  head: () => ({ meta: [{ title: "GitHub discovery — Match Fund" }] }),
  component: DiscoverAdminPage,
});

const SUGGESTED_QUERY = "topic:ai stars:>100 pushed:>2026-04-01";

type RunResult = Awaited<ReturnType<typeof discoverGitHubCandidates>>;

function DiscoverAdminPage() {
  const run = useServerFn(discoverGitHubCandidates);
  const [query, setQuery] = useState(SUGGESTED_QUERY);
  const [limit, setLimit] = useState(5);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await run({ data: { query, limit } });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-6">
      <header className="space-y-2">
        <div className="text-xs uppercase tracking-widest text-white/50">
          Stage 1 — GitHub-first
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Discover public builders</h1>
        <p className="text-sm text-white/60 max-w-2xl">
          Search GitHub by topic/stars/activity, then ingest each repo owner into the evidence graph
          as a <em>Potential builder — founder status unverified</em>. Ingested profiles are made
          discoverable as public-source, unclaimed profiles with real GitHub evidence attached.
        </p>
      </header>

      <div className="glass rounded-2xl p-5 space-y-4">
        <label className="block text-xs uppercase tracking-widest text-white/50">
          GitHub search query
        </label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm font-mono"
          placeholder={SUGGESTED_QUERY}
          spellCheck={false}
        />
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            "topic:ai stars:>100 pushed:>2026-04-01",
            "topic:climate-tech stars:>50",
            "topic:developer-tools stars:>100",
            "topic:robotics language:Python",
          ].map((q) => (
            <button
              key={q}
              onClick={() => setQuery(q)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 hover:bg-white/10 font-mono"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <label className="text-xs text-white/60">
            Candidates
            <input
              type="number"
              min={1}
              max={10}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value) || 5)}
              className="ml-2 w-16 rounded bg-white/5 border border-white/10 px-2 py-1 text-sm"
            />
          </label>
          <button
            onClick={handleRun}
            disabled={running}
            className="ml-auto inline-flex items-center gap-2 rounded-full bg-emerald-400/90 px-5 py-2.5 text-sm font-medium text-black hover:bg-emerald-300 disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {running ? "Crawling GitHub…" : "Run discovery"}
          </button>
        </div>
        <p className="text-[11px] text-white/40">
          Unauthenticated GitHub calls are limited to 10 searches/minute and 60 requests/hour.
          Linking the GitHub connector (env <code>GITHUB_API_KEY</code>) raises this to 5000/hour.
        </p>
      </div>

      {error && (
        <div className="glass rounded-2xl p-4 border border-red-400/30 text-sm text-red-200 flex gap-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Discovery failed</div>
            <div className="text-red-200/80 mt-1 font-mono text-xs">{error}</div>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="glass rounded-2xl p-5 flex flex-wrap gap-6 text-sm">
            <Stat label="Scanned repos" value={result.scanned} />
            <Stat label="Ingested" value={result.ingested} tone="good" />
            <Stat
              label="Failed"
              value={result.failed}
              tone={result.failed > 0 ? "warn" : undefined}
            />
            <Stat
              label="GitHub auth"
              value={result.authenticated ? "Token" : "Anonymous"}
              tone={result.authenticated ? "good" : "warn"}
            />
            <Stat
              label="Rate remaining"
              value={
                result.rateLimit.remaining !== null
                  ? `${result.rateLimit.remaining}/${result.rateLimit.limit ?? "?"}`
                  : "—"
              }
            />
          </div>

          <div className="space-y-2">
            {result.candidates.map((c) => (
              <div
                key={`${c.login}-${c.githubUserId}`}
                className="glass rounded-xl p-4 flex gap-4 items-start"
              >
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <Github className="w-5 h-5 text-white/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium">@{c.login}</div>
                    <span
                      className={`text-[10px] uppercase tracking-widest rounded-full px-2 py-0.5 border ${
                        c.status === "ingested"
                          ? "border-emerald-400/40 text-emerald-300"
                          : "border-red-400/40 text-red-300"
                      }`}
                    >
                      {c.status}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest rounded-full px-2 py-0.5 border border-amber-400/40 text-amber-300">
                      Founder status unverified
                    </span>
                  </div>
                  <div className="text-xs text-white/50 mt-1 truncate">
                    {c.topRepo.fullName} · ★ {c.topRepo.stars}
                  </div>
                  {c.topRepo.description && (
                    <div className="text-sm text-white/70 mt-2 line-clamp-2">
                      {c.topRepo.description}
                    </div>
                  )}
                  {c.topRepo.topics.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {c.topRepo.topics.slice(0, 6).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] rounded bg-white/5 border border-white/10 px-2 py-0.5 text-white/60"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {c.error && (
                    <div className="text-xs text-red-300/80 mt-2 font-mono">{c.error}</div>
                  )}
                  <div className="mt-3 flex gap-3 text-xs">
                    <a
                      href={c.topRepo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-white/60 hover:text-white"
                    >
                      Repo <ExternalLink className="w-3 h-3" />
                    </a>
                    {c.status === "ingested" && (
                      <Link
                        to="/founder/$id"
                        params={{ id: c.profileId }}
                        className="text-emerald-300 hover:text-emerald-200"
                      >
                        Open profile →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Link to="/" className="text-sm text-white/70 hover:text-white">
              Go to Discover feed →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "good" | "warn";
}) {
  const color =
    tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : "text-white";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
