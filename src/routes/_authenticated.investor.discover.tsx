import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Database,
  Eye,
  FileWarning,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { AppShell } from "@/components/matchfund/AppShell";
import { FounderCard } from "@/components/matchfund/FounderCard";
import { ScoreHelpButton } from "@/components/matchfund/ScoreHelp";
import { discoveredSources, founders, type Founder } from "@/data/matchfund";
import { previewDiscoveryPlan, startFounderDiscovery } from "@/lib/discovery/discovery.functions";
import type { DiscoveryPlan, DiscoveryRunSummary } from "@/lib/discovery/types";
import { getPublishedGraphFounders } from "@/lib/graph/feed.functions";
import { selectFounderFeed } from "@/lib/graph/feed-selection";
import { rankGraphFounders } from "@/lib/graph/thesis-fit";
import type {
  GraphFounderCard as GraphFounderCardData,
  RankedGraphFounder,
} from "@/lib/graph/types";
import { rankFounders, useThesis, saveThesis, type MatchScore } from "@/lib/thesis";
import {
  pipelineService,
  useInvestorKey,
  type FounderSnapshot,
} from "@/services/pipelineService";

export const Route = createFileRoute("/_authenticated/investor/discover")({
  head: () => ({ meta: [{ title: "Discover — MatchFund" }] }),
  component: TodayDeck,
});

type Decision = "pass" | "monitor" | "shortlist";

type RankedDiscovery =
  | ({ kind: "graph" } & RankedGraphFounder)
  | { kind: "demo"; founder: Founder; match: MatchScore; discoveryPriority: number };

const WATCHLIST_KEY = "matchfund:watchlist";
const DECISIONS_KEY = "mf.decisions";

function TodayDeck() {
  const [thesis, setThesis, hydrated] = useThesis();
  const userKey = useInvestorKey();
  const graphFeedFn = useServerFn(getPublishedGraphFounders);
  const previewDiscoveryFn = useServerFn(previewDiscoveryPlan);
  const startDiscoveryFn = useServerFn(startFounderDiscovery);
  const [graphFounders, setGraphFounders] = useState<GraphFounderCardData[]>([]);
  const [graphLoading, setGraphLoading] = useState(true);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [discoveryPlan, setDiscoveryPlan] = useState<DiscoveryPlan | null>(null);
  const [discoverySummary, setDiscoverySummary] = useState<DiscoveryRunSummary | null>(null);
  const [discoveryRunning, setDiscoveryRunning] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const discoveryAutostarted = useRef(false);

  // Do NOT auto-redirect. Show a proper "missing thesis" state so investors
  // can also try demo matches without setting a thesis first.
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    setGraphLoading(true);
    setGraphError(null);
    graphFeedFn()
      .then((records) => {
        if (active) setGraphFounders(records);
      })
      .catch((error) => {
        if (active) {
          setGraphFounders([]);
          setGraphError(
            error instanceof Error ? error.message : "Graph founder feed failed to load.",
          );
        }
      })
      .finally(() => {
        if (active) setGraphLoading(false);
      });
    return () => {
      active = false;
    };
  }, [graphFeedFn, hydrated]);

  const runDiscovery = useCallback(async () => {
    if (!thesis || discoveryRunning) return;
    setDiscoveryRunning(true);
    setDiscoveryError(null);
    setDiscoverySummary(null);
    try {
      const plan = await previewDiscoveryFn({ data: thesis });
      setDiscoveryPlan(plan);
      const summary = await startDiscoveryFn({ data: thesis });
      setDiscoverySummary(summary);
      setDiscoveryPlan(summary.plan);
      const records = await graphFeedFn();
      setGraphFounders(records);
      setGraphError(null);
      setIdx(0);
    } catch (error) {
      setDiscoveryError(
        error instanceof Error ? error.message : "Public founder discovery failed.",
      );
    } finally {
      setDiscoveryRunning(false);
    }
  }, [discoveryRunning, graphFeedFn, previewDiscoveryFn, startDiscoveryFn, thesis]);

  useEffect(() => {
    if (!hydrated || !thesis || discoveryAutostarted.current) return;
    if (window.sessionStorage.getItem("matchfund:discovery-autostart") !== "true") return;
    discoveryAutostarted.current = true;
    window.sessionStorage.removeItem("matchfund:discovery-autostart");
    void runDiscovery();
  }, [hydrated, runDiscovery, thesis]);

  const ranked = useMemo<RankedDiscovery[]>(() => {
    // In demo mode (or when there's no thesis but user asked for demo), fall
    // back to a permissive default so the rank still works and demo founders
    // always render.
    const effectiveThesis = thesis ?? {
      stages: [],
      sectors: [],
      weights: { technical: 34, traction: 33, fmf: 33 },
      geos: [],
      checkMin: 25,
      checkMax: 250,
      digestEmail: false,
    };
    if (!thesis && !demoMode) return [];
    if (graphError && !demoMode) {
      // Even on error, if user opted into demo, show demo results.
      return [];
    }
    const graphRanked = rankGraphFounders(graphFounders, effectiveThesis);
    const demoRanked = rankFounders(founders, effectiveThesis).map(({ founder, match }) => ({
      kind: "demo" as const,
      founder,
      match,
      discoveryPriority: match.total,
    }));
    const selection = selectFounderFeed(graphRanked, demoRanked);
    return selection.mode === "graph"
      ? selection.records.map((r) => ({ kind: "graph" as const, ...r }))
      : selection.records;
  }, [graphError, graphFounders, thesis, demoMode]);

  // Data mode: live if there are any graph records, demo if only demo,
  // mixed if the feed contains both kinds.
  const dataMode: "live" | "demo" | "mixed" | "empty" = useMemo(() => {
    if (ranked.length === 0) return "empty";
    const hasGraph = ranked.some((r) => r.kind === "graph");
    const hasDemo = ranked.some((r) => r.kind === "demo");
    if (hasGraph && hasDemo) return "mixed";
    return hasGraph ? "live" : "demo";
  }, [ranked]);

  const [idx, setIdx] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [drag, setDrag] = useState(0);
  const [exiting, setExiting] = useState<Decision | null>(null);
  const [thesisToast, setThesisToast] = useState<string | null>(null);
  const startX = useRef<number | null>(null);

  useEffect(() => setIdx(0), [ranked.length]);

  const current = ranked[idx];

  function snapshotOf(item: RankedDiscovery): FounderSnapshot {
    if (item.kind === "graph") {
      return {
        id: item.founder.id,
        name: item.founder.name,
        headline: item.founder.headline || "Founder",
        avatarUrl: item.founder.avatarUrl,
        sector: item.founder.topics[0] ?? null,
        location: item.founder.location,
        stage: item.founder.stage,
        thesisMatch: item.thesisFit.score,
        founderFit: null,
        evidenceConfidence: item.founder.evidenceConfidence,
        verified: item.founder.claimStatus === "claimed",
        dataMode: "live",
        sourceCount: item.founder.sourceCount,
        lastSignalAt: item.founder.recentActivityAt,
        matchReason: item.thesisFit.matchedCriteria[0] ?? null,
      };
    }
    return {
      id: item.founder.id,
      name: item.founder.name,
      headline: item.founder.headline,
      avatarUrl: item.founder.avatar ?? null,
      sector: item.founder.sector,
      location: item.founder.location,
      stage: item.founder.stage,
      thesisMatch: Math.round(item.match.total),
      founderFit: item.founder.scores.fit,
      evidenceConfidence: "Demo",
      verified: item.founder.verified,
      dataMode: "demo",
      sourceCount: discoveredSources(item.founder).length,
      lastSignalAt: null,
      matchReason: item.match.reasons[0] ?? item.founder.matchReason,
    };
  }

  const record = (decision: Decision) => {
    if (!current) return;
    const founderId = current.founder.id;
    const snapshot = snapshotOf(current);
    setDecisions((d) => ({ ...d, [founderId]: decision }));
    if (typeof window !== "undefined") {
      const prev = JSON.parse(window.localStorage.getItem(DECISIONS_KEY) || "{}");
      prev[founderId] = decision;
      window.localStorage.setItem(DECISIONS_KEY, JSON.stringify(prev));
    }

    if (decision === "pass") {
      if (userKey) {
        const removed = pipelineService.remove(userKey, founderId);
        toast(`${snapshot.name} passed.`, {
          action: removed
            ? { label: "Undo", onClick: () => pipelineService.restore(userKey, removed) }
            : undefined,
        });
      } else {
        toast(`${snapshot.name} passed.`);
      }
    } else if (userKey) {
      const { previous } = pipelineService.upsert(userKey, decision, snapshot);
      toast.success(
        decision === "shortlist"
          ? `${snapshot.name} added to your Shortlist.`
          : `${snapshot.name} added to Monitoring.`,
        {
          action: {
            label: "Undo",
            onClick: () => {
              if (previous) pipelineService.upsert(userKey, previous.status, previous.snapshot);
              else pipelineService.remove(userKey, founderId);
            },
          },
        },
      );
      // Legacy watchlist mirror — kept until CTO wires backend.
      if (typeof window !== "undefined") {
        const list: string[] = JSON.parse(window.localStorage.getItem(WATCHLIST_KEY) || "[]");
        if (!list.includes(founderId)) {
          list.push(founderId);
          window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
        }
      }
    }

    setExiting(decision);

    if (thesis) {
      const nextCount = (thesis.swipeCount ?? 0) + 1;
      const updated = { ...thesis, swipeCount: nextCount };
      saveThesis(updated);
      setThesis(updated);
      if (nextCount === 5) {
        setThesisToast("Nice — your match model just got sharper.");
        setTimeout(() => setThesisToast(null), 3500);
      }
    }

    setTimeout(() => {
      setIdx((i) => i + 1);
      setDrag(0);
      setExiting(null);
    }, 260);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") record("pass");
      if (e.key === "ArrowRight") record("shortlist");
      if (e.key === "ArrowUp") record("monitor");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.founder.id]);

  const stats = useMemo(() => {
    const values = Object.values(decisions);
    return {
      reviewed: values.length,
      shortlisted: values.filter((d) => d === "shortlist").length,
      monitored: values.filter((d) => d === "monitor").length,
    };
  }, [decisions]);

  // 1) Still hydrating localStorage — skeleton, not a blocker.
  if (!hydrated) {
    return (
      <AppShell>
        <DiscoverSkeleton message="Loading your workspace…" />
      </AppShell>
    );
  }

  // 2) No thesis yet, and user hasn't opted into demo — friendly onboarding CTA.
  if (!thesis && !demoMode) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl py-16 text-center">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
            Discover
          </div>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
            Discover exceptional founders before they start fundraising.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground">
            MatchFund turns public builder signals into thesis-matched founder opportunities for
            early-stage investors.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/onboard"
              className="inline-flex items-center gap-1.5 rounded-full bg-mint px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Set up investment thesis
            </Link>
            <button
              onClick={() => setDemoMode(true)}
              className="inline-flex items-center gap-1.5 rounded-full glass-subtle px-5 py-2.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Explore demo matches
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  // 3) Fetching graph feed — skeleton.
  if (graphLoading) {
    return (
      <AppShell>
        <DiscoverSkeleton message="Finding builders that match your investment thesis…" />
      </AppShell>
    );
  }

  // 4) Error — with retry + demo fallback.
  if (graphError && !demoMode) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg py-16 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-400" />
          <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight">
            We couldn't load your founder matches.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{graphError}</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 rounded-full bg-mint px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Try again
            </button>
            <button
              onClick={() => setDemoMode(true)}
              className="inline-flex items-center gap-1.5 rounded-full glass-subtle px-5 py-2.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Explore demo matches
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  const total = ranked.length;
  const positionLabel = total === 0 ? "0 of 0" : `${Math.min(idx + 1, total)} of ${total}`;
  const upNext = ranked.slice(idx + 1, idx + 6);
  const recentShortlisted = Object.entries(decisions)
    .filter(([, d]) => d === "shortlist")
    .slice(-4)
    .reverse()
    .map(([id]) => ranked.find((r) => r.founder.id === id))
    .filter(Boolean) as RankedDiscovery[];

  return (
    <AppShell>
      {/* Top row: title + data-mode badge + edit thesis */}
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
              Discover
            </div>
            <DataModeBadge mode={dataMode} />
          </div>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            {total} founders match your thesis
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Discovery Priority ranks Thesis Match against Evidence Confidence. Scores stay separate.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {thesis ? (
            <>
              <button
                type="button"
                onClick={() => void runDiscovery()}
                disabled={discoveryRunning}
                className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3.5 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {discoveryRunning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                {discoveryRunning ? "Finding founders…" : "Find founders"}
              </button>
              <Link
                to="/onboard"
                search={{ return: "settings" as const }}
                className="inline-flex items-center gap-1.5 rounded-full glass-subtle px-3.5 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <Target className="h-3.5 w-3.5" /> Edit thesis
              </Link>
            </>
          ) : (
            <Link
              to="/onboard"
              className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3.5 py-2 text-xs font-medium text-primary-foreground"
            >
              <Search className="h-3.5 w-3.5" /> Set thesis & find founders
            </Link>
          )}
        </div>
      </div>

      {(discoveryPlan || discoverySummary || discoveryRunning || discoveryError) && (
        <DiscoveryRunPanel
          plan={discoveryPlan}
          summary={discoverySummary}
          running={discoveryRunning}
          error={discoveryError}
        />
      )}

      {dataMode === "demo" && (
        <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-amber/30 bg-amber/10 p-3 text-xs text-amber">
          <span>
            Demo fallback · no discoverable graph-backed founders were found. Every card below is a
            Demo profile and does not represent a live crawl.
          </span>
          {thesis ? (
            <button
              type="button"
              onClick={() => void runDiscovery()}
              disabled={discoveryRunning}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber/40 bg-background/40 px-3 py-1.5 font-medium disabled:opacity-50"
            >
              {discoveryRunning ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              {discoveryRunning ? "Scanning…" : "Find founders"}
            </button>
          ) : (
            <Link
              to="/onboard"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber/40 bg-background/40 px-3 py-1.5 font-medium"
            >
              <Search className="h-3.5 w-3.5" /> Set thesis & find founders
            </Link>
          )}
        </div>
      )}

      {graphError && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">Live founder feed unavailable.</div>
            <div className="mt-1 text-xs text-rose-200/80">{graphError}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-[240px_minmax(0,1fr)_280px] gap-5">
        {/* LEFT — thesis + counters */}
        <aside className="space-y-4">
          <div className="rounded-2xl glass p-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Current thesis
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <ThesisRow label="Stage" values={thesis?.stages ?? ["Demo mode"]} />
              <ThesisRow label="Sector" values={thesis?.sectors ?? ["All sectors"]} />
              <ThesisRow
                label="Geography"
                values={thesis?.geos?.length ? thesis.geos : ["Global"]}
              />
            </div>
            <Link
              to={thesis ? "/onboard" : "/onboard"}
              search={thesis ? { return: "settings" as const } : undefined}
              className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-border/60 bg-elevated/50 py-1.5 text-[11px] font-medium text-mint hover:border-mint/40"
            >
              {thesis ? "Edit thesis" : "Set up thesis"}
            </Link>
          </div>

          <div className="rounded-2xl glass p-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              This session
            </div>
            <div className="mt-3 space-y-2">
              <CounterRow label="Reviewed" value={stats.reviewed} />
              <CounterRow label="Monitored" value={stats.monitored} tone="amber" />
              <CounterRow label="Shortlisted" value={stats.shortlisted} tone="mint" />
            </div>
          </div>
        </aside>

        {/* CENTER — decision card */}
        <div className="min-w-0">
          {current ? (
            <>
              <DecisionMeta item={current} />
              <div
                className="relative mt-3 cursor-grab touch-none active:cursor-grabbing"
                onPointerDown={(e) => {
                  startX.current = e.clientX;
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (startX.current == null) return;
                  setDrag(e.clientX - startX.current);
                }}
                onPointerUp={() => {
                  if (drag > 120) record("shortlist");
                  else if (drag < -120) record("pass");
                  else setDrag(0);
                  startX.current = null;
                }}
                style={{
                  transform: exiting
                    ? `translateX(${exiting === "pass" ? -800 : exiting === "shortlist" ? 800 : 0}px) translateY(${exiting === "monitor" ? -600 : 0}px) rotate(${exiting === "pass" ? -12 : exiting === "shortlist" ? 12 : 0}deg)`
                    : `translateX(${drag}px) rotate(${drag * 0.03}deg)`,
                  transition: exiting
                    ? "transform 260ms ease-in, opacity 260ms"
                    : drag === 0
                      ? "transform 240ms cubic-bezier(0.22,1,0.36,1)"
                      : undefined,
                  opacity: exiting ? 0 : 1,
                }}
              >
                {current.kind === "graph" ? (
                  <FounderCard
                    founder={current.founder}
                    thesisFit={current.thesisFit}
                    discoveryPriority={current.discoveryPriority}
                  />
                ) : (
                  <DecisionCard item={current} />
                )}
              </div>

              <ActionBar onDecide={record} />
            </>
          ) : (
            <div className="grid min-h-[520px] place-items-center rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
              <div>
                <div className="text-lg font-medium">You're through today's queue</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Refine your thesis for a broader match set, or review what you shortlisted.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <button
                    onClick={() => setIdx(0)}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-elevated px-4 py-2 text-sm hover:bg-accent"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Restart queue
                  </button>
                  <Link
                    to="/investor/pipeline"
                    className="rounded-full bg-mint px-4 py-2 text-sm font-medium text-primary-foreground"
                  >
                    Open Shortlist
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — queue + recent */}
        <aside className="space-y-4">
          <div className="rounded-2xl glass p-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Next up
              </div>
              <div className="tabular text-[10px] text-muted-foreground">{positionLabel}</div>
            </div>
            <div className="mt-3 space-y-1.5">
              {upNext.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                  End of queue.
                </div>
              )}
              {upNext.map((item, i) => (
                <QueueRow key={item.founder.id} item={item} rank={idx + 2 + i} />
              ))}
            </div>
          </div>

          <div className="rounded-2xl glass p-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Recently shortlisted
            </div>
            <div className="mt-3 space-y-1.5">
              {recentShortlisted.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                  <Bookmark className="h-3.5 w-3.5" /> Nothing yet.
                </div>
              ) : (
                recentShortlisted.map((item) => (
                  <Link
                    key={item.founder.id}
                    to="/founder/$id"
                    params={{ id: item.founder.id }}
                    className="flex items-center gap-2 rounded-lg border border-border/60 bg-elevated/60 p-2 text-xs hover:border-mint/40"
                  >
                    <Avatar item={item} size={7} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{item.founder.name}</div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {founderSubtitle(item)}
                      </div>
                    </div>
                    <BookmarkCheck className="h-3.5 w-3.5 text-mint" />
                  </Link>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>

      {thesisToast && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full border border-mint/30 bg-background/90 px-5 py-2.5 text-sm shadow-lg backdrop-blur">
          <Sparkles className="mr-2 inline h-3.5 w-3.5 text-mint" />
          {thesisToast}
        </div>
      )}
    </AppShell>
  );
}

function DiscoveryRunPanel({
  plan,
  summary,
  running,
  error,
}: {
  plan: DiscoveryPlan | null;
  summary: DiscoveryRunSummary | null;
  running: boolean;
  error: string | null;
}) {
  const queries =
    plan?.sources.flatMap((source) =>
      source.queries.map((query) => ({ ...query, source: source.source })),
    ) ?? [];
  const stats = summary?.stats;
  const status = running ? "Running" : (summary?.status ?? (error ? "Failed" : "Planned"));
  return (
    <section className="mb-5 rounded-2xl border border-cyan-300/25 bg-cyan-300/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
            ) : (
              <Database className="h-4 w-4 text-cyan-300" />
            )}
            Public founder discovery · {status}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Thesis-specific source plans → public candidates → bounded enrichment → stored graph
            evidence. Discovery inclusion is not founder-quality evidence.
          </p>
        </div>
        {summary && (
          <Link
            to="/"
            className="rounded-full border border-cyan-300/30 px-3 py-1.5 text-[11px] font-medium text-cyan-200"
          >
            View results in Today
          </Link>
        )}
      </div>

      {queries.length > 0 && (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {queries.map((query, index) => (
            <div key={`${query.query}-${index}`} className="rounded-lg border border-border/60 p-3">
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                {query.source.replace("_", " ")} theme/query {index + 1} · limit {query.limit}
              </div>
              <div className="mt-1 break-words font-mono text-[10px] text-cyan-100">
                {query.query}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">{query.reason}</div>
            </div>
          ))}
        </div>
      )}

      {plan && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {plan.capabilities.map((capability) => {
            const source = plan.sources.find((item) => item.source === capability.id);
            const result = summary?.sourceResults.find((item) => item.source === capability.id);
            const sourceStatus =
              running && capability.enabled
                ? "running"
                : (result?.status ??
                  source?.status ??
                  (capability.enabled ? "planned" : "disabled_unconfigured"));
            return (
              <div key={capability.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between gap-2 text-[10px] font-medium uppercase tracking-wider">
                  <span>{capability.id.replace("_", " ")}</span>
                  <span className="text-cyan-200">{sourceStatus.replace("_", " ")}</span>
                </div>
                {result ? (
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    {result.recordsEvaluated} evaluated · {result.candidatesDiscovered} discovered ·{" "}
                    {result.candidatesIngested} profiles · {result.candidatesEnriched} enriched
                  </div>
                ) : (
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    {source?.disabledReason ??
                      capability.disabledReason ??
                      (source
                        ? `${source.queries.length} bounded queries planned`
                        : "Runs only after a candidate exposes a supported identifier.")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {stats && (
        <div className="mt-4 grid grid-cols-3 gap-2 md:grid-cols-7">
          <DiscoveryMetric
            label="Queries"
            value={`${stats.queriesExecuted}/${stats.queriesPlanned}`}
          />
          <DiscoveryMetric label="Records" value={stats.recordsEvaluated} />
          <DiscoveryMetric label="Candidates" value={stats.candidateFoundersDiscovered} />
          <DiscoveryMetric label="Ingested" value={stats.profilesIngested} />
          <DiscoveryMetric label="Enriched" value={stats.candidatesEnriched} />
          <DiscoveryMetric label="Skipped" value={stats.skipped} />
          <DiscoveryMetric label="Failed" value={stats.failed} />
        </div>
      )}

      {plan && plan.unsupportedFilters.length > 0 && (
        <div className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
          Unknown / post-fetch ·{" "}
          {plan.unsupportedFilters.map((item) => `${item.field}: ${item.reason}`).join(" · ")}
        </div>
      )}
      {(error || (summary?.issues.length ?? 0) > 0) && (
        <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-[11px] text-rose-200">
          {[error, ...(summary?.issues.map((issue) => issue.message) ?? [])]
            .filter(Boolean)
            .join(" · ")}
          {summary?.issues.some((issue) => issue.rateLimitResetAt) && (
            <div className="mt-1 text-[10px] text-rose-200/75">
              GitHub reset ·{" "}
              {new Date(
                summary.issues.find((issue) => issue.rateLimitResetAt)?.rateLimitResetAt ?? "",
              ).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function DiscoveryMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-elevated/40 p-2.5">
      <div className="tabular text-lg font-semibold">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

// ---------- Center card ----------

function DecisionMeta({ item }: { item: RankedDiscovery }) {
  const thesisMatch = item.kind === "graph" ? item.thesisFit.score : Math.round(item.match.total);
  const evidenceConfidence = item.kind === "graph" ? item.founder.evidenceConfidence : "Demo";
  const sourceCount =
    item.kind === "graph" ? item.founder.sourceCount : discoveredSources(item.founder).length;
  const latest =
    item.kind === "graph"
      ? formatShortDate(item.founder.recentActivityAt)
      : (item.founder.updates[0]?.when ?? "—");
  const why =
    item.kind === "graph"
      ? (item.thesisFit.matchedCriteria[0] ?? "Ranked by evidence coverage")
      : (item.match.reasons[0] ?? item.founder.matchReason);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl glass-subtle px-4 py-3 text-xs">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-mint" />
        <span className="text-foreground/85">Why:</span> {why}
      </span>
      <span className="ml-auto flex items-center gap-3 text-[11px]">
        <MetaChip label="Thesis Match" value={`${thesisMatch}`} tone="mint" />
        <MetaChip label="Evidence" value={evidenceConfidence} />
        <MetaChip label="Sources" value={String(sourceCount)} />
        <MetaChip label="Last signal" value={latest} />
      </span>
    </div>
  );
}

function DecisionCard({ item }: { item: RankedDiscovery }) {
  const name = item.founder.name;
  const isGraph = item.kind === "graph";
  const role = isGraph ? item.founder.headline || "Founder" : item.founder.headline;
  const status = isGraph
    ? item.founder.stage
      ? `${item.founder.stage} stage`
      : "Pre-company"
    : item.founder.companyId
      ? `${item.founder.stage} · Company`
      : "Pre-company";
  const location = isGraph ? (item.founder.location ?? "Location unknown") : item.founder.location;
  const currentProject = isGraph
    ? item.founder.projects[0]?.name
      ? `Building ${item.founder.projects[0].name}${item.founder.projects[0].eventName ? ` at ${item.founder.projects[0].eventName}` : ""}`
      : item.founder.summary || "Current build not disclosed."
    : item.founder.bio;
  const tags = isGraph
    ? [...item.founder.mainLanguages, ...item.founder.technologies, ...item.founder.topics].slice(
        0,
        6,
      )
    : item.founder.skills.slice(0, 6);

  const founderFit = isGraph ? null : item.founder.scores.fit;
  const ideaStrength = isGraph ? null : item.founder.scores.idea;
  const tractionStrength = isGraph ? null : item.founder.scores.traction;

  const mainPositive = isGraph
    ? item.founder.topSignals[0]
      ? {
          title: item.founder.topSignals[0].title,
          detail: item.founder.topSignals[0].detail,
        }
      : item.founder.verifiedResults[0]
        ? { title: "Verified result", detail: item.founder.verifiedResults[0] }
        : {
            title: "Public code activity",
            detail: `${item.founder.repositoryCount} public repositories on GitHub`,
          }
    : {
        title:
          item.founder.signals.hackathonWins >= 2
            ? `${item.founder.signals.hackathonWins}× hackathon wins`
            : "Strong technical signal",
        detail: item.founder.matchReason,
      };

  const mainMissing = isGraph
    ? (item.thesisFit.unknownCriteria[0] ??
      item.founder.unknowns[0] ??
      "No blocking evidence gap detected")
    : item.founder.companyId
      ? "Post-launch traction metrics not yet shared"
      : "Company entity not established — early stage";

  return (
    <div className="rounded-2xl glass p-5 shadow-2xl">
      <div className="flex items-start gap-4">
        <Avatar item={item} size={16} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="truncate font-display text-2xl font-semibold tracking-tight">{name}</h2>
            <span className="rounded-full border border-mint/30 bg-mint-soft/40 px-2 py-0.5 text-[10px] font-medium text-mint">
              {status}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{role}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">{location}</p>
        </div>
        <Link
          to="/founder/$id"
          params={{ id: item.founder.id }}
          className="shrink-0 inline-flex items-center gap-1 rounded-full border border-border/60 bg-elevated/60 px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:border-mint/40 hover:text-foreground"
          onPointerDown={(e) => e.stopPropagation()}
        >
          Full profile <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-foreground/85">
        {currentProject}
      </p>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-border/60 bg-elevated/60 px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <ScorePill label="Founder Fit" value={founderFit} />
        <ScorePill label="Idea Strength" value={ideaStrength} />
        <ScorePill label="Traction Strength" value={tractionStrength} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <SignalBlock tone="positive" title={mainPositive.title} detail={mainPositive.detail} />
        <SignalBlock tone="missing" title="Missing evidence" detail={mainMissing} />
      </div>
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: number | null }) {
  const has = typeof value === "number";
  return (
    <div className="rounded-xl border border-border/60 bg-elevated/40 px-3 py-2">
      <div className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span
          className="tabular text-xl font-semibold"
          style={{ color: has ? "var(--mint)" : "oklch(0.65 0 0)" }}
        >
          {has ? value : "—"}
        </span>
        {!has && <span className="text-[9px] text-muted-foreground">insufficient evidence</span>}
      </div>
    </div>
  );
}

function SignalBlock({
  tone,
  title,
  detail,
}: {
  tone: "positive" | "missing";
  title: string;
  detail: string;
}) {
  const isPositive = tone === "positive";
  return (
    <div
      className={`rounded-xl border p-3 text-xs ${
        isPositive ? "border-mint/25 bg-mint-soft/25" : "border-amber/25 bg-amber/5"
      }`}
    >
      <div
        className={`flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider ${
          isPositive ? "text-mint" : "text-amber"
        }`}
      >
        {isPositive ? <Sparkles className="h-3 w-3" /> : <FileWarning className="h-3 w-3" />}
        {isPositive ? "Strongest signal" : "Gap"}
      </div>
      <div className="mt-1 font-medium text-foreground/90">{title}</div>
      <div className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
        {detail}
      </div>
    </div>
  );
}

// ---------- Action bar ----------

function ActionBar({ onDecide }: { onDecide: (d: Decision) => void }) {
  return (
    <div className="mt-4 flex items-center gap-2">
      <ActionButton
        onClick={() => onDecide("pass")}
        icon={<X className="h-4 w-4" />}
        label="Pass"
        shortcut="←"
        tone="rose"
      />
      <ActionButton
        onClick={() => onDecide("monitor")}
        icon={<Eye className="h-4 w-4" />}
        label="Monitor"
        shortcut="↑"
        tone="amber"
      />
      <ActionButton
        onClick={() => onDecide("shortlist")}
        icon={<BookmarkCheck className="h-4 w-4" />}
        label="Shortlist"
        shortcut="→"
        primary
      />
    </div>
  );
}

function ActionButton({
  onClick,
  icon,
  label,
  shortcut,
  tone,
  primary,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  tone?: "rose" | "amber";
  primary?: boolean;
}) {
  const color = tone === "rose" ? "var(--rose)" : tone === "amber" ? "var(--amber)" : "var(--mint)";
  return (
    <button
      onClick={onClick}
      title={`${label} · ${shortcut}`}
      className={`group inline-flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition ${
        primary
          ? "border-mint bg-mint text-primary-foreground shadow-[0_0_30px_var(--mint-soft)]"
          : "border-border bg-elevated/70 text-foreground hover:border-white/20"
      }`}
      style={{ color: primary ? undefined : color }}
    >
      {icon}
      <span>{label}</span>
      <kbd
        className={`ml-1 grid h-5 min-w-5 place-items-center rounded border px-1 text-[10px] ${
          primary
            ? "border-white/30 bg-white/10 text-primary-foreground/90"
            : "border-border/60 bg-background/40 text-muted-foreground"
        }`}
      >
        {shortcut}
      </kbd>
    </button>
  );
}

// ---------- Rails ----------

function QueueRow({ item, rank }: { item: RankedDiscovery; rank: number }) {
  return (
    <Link
      to="/founder/$id"
      params={{ id: item.founder.id }}
      className="flex items-center gap-2 rounded-lg border border-border/60 bg-elevated/60 p-2 text-xs hover:border-mint/40"
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border/60 bg-background/40 text-[10px] tabular text-muted-foreground">
        {rank}
      </span>
      <Avatar item={item} size={7} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{item.founder.name}</div>
        <div className="truncate text-[10px] text-muted-foreground">{founderSubtitle(item)}</div>
      </div>
      <div className="tabular text-[11px] font-semibold text-mint">{item.discoveryPriority}</div>
    </Link>
  );
}

function ThesisRow({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {values.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">Any</span>
        ) : (
          values.map((v) => (
            <span
              key={v}
              className="rounded-full border border-mint/25 bg-mint-soft/30 px-2 py-0.5 text-[10px] text-mint"
            >
              {v}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function CounterRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "mint" | "amber";
}) {
  const color =
    tone === "mint" ? "var(--mint)" : tone === "amber" ? "var(--amber)" : "var(--foreground)";
  return (
    <div className="flex items-baseline justify-between rounded-lg border border-border/60 bg-elevated/40 px-3 py-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="tabular text-lg font-semibold" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function MetaChip({ label, value, tone }: { label: string; value: string; tone?: "mint" }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-elevated/60 px-2 py-1">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span
        className="tabular text-[11px] font-semibold"
        style={{ color: tone === "mint" ? "var(--mint)" : undefined }}
      >
        {value}
      </span>
    </span>
  );
}

function DataModeBadge({ mode }: { mode: "live" | "demo" | "mixed" | "empty" }) {
  const map = {
    live: { label: "Live data", color: "var(--mint)" },
    demo: { label: "Demo data", color: "var(--amber)" },
    mixed: { label: "Mixed data", color: "oklch(0.72 0.16 260)" },
    empty: { label: "No data", color: "oklch(0.65 0 0)" },
  } as const;
  const { label, color } = map[mode];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
      style={{ color, borderColor: `${color}55`, background: `${color}10` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function Avatar({ item, size }: { item: RankedDiscovery; size: number }) {
  const url = item.kind === "graph" ? item.founder.avatarUrl : item.founder.avatar;
  const cls = `h-${size} w-${size} shrink-0 overflow-hidden rounded-full bg-elevated`;
  if (url) return <img src={url} alt="" className={`${cls} object-cover`} />;
  return (
    <div className={`${cls} grid place-items-center text-[10px] font-medium text-mint`}>
      {item.founder.name
        .split(/\s+/)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()}
    </div>
  );
}

function founderSubtitle(item: RankedDiscovery): string {
  if (item.kind === "demo") return `${item.founder.sector} · ${item.founder.stage} · Demo`;
  if (item.founder.profileOrigin === "public_scan") {
    return `Public-source profile · Unclaimed · ${item.founder.evidenceConfidence} evidence`;
  }
  return `Founder-submitted profile · ${item.founder.evidenceConfidence} evidence`;
}

function formatShortDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// silence unused import warning if lint complains

function DiscoverSkeleton({ message }: { message: string }) {
  return (
    <div className="py-10">
      <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">Discover</div>
      <div className="mt-2 h-8 w-2/3 animate-pulse rounded-lg bg-white/5" />
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      <div className="mt-6 grid grid-cols-[240px_minmax(0,1fr)_280px] gap-5">
        <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
        <div className="h-[520px] animate-pulse rounded-2xl bg-white/5" />
        <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}
