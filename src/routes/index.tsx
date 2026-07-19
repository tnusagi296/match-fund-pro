import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Bookmark,
  Eye,
  Github,
  Heart,
  MessageCircle,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  X,
} from "lucide-react";
import { AppShell } from "@/components/matchfund/AppShell";
import { FounderCard } from "@/components/matchfund/FounderCard";
import { discoveredSources, founders, type Founder } from "@/data/matchfund";
import { getPublishedGraphFounders } from "@/lib/graph/feed.functions";
import { selectFounderFeed } from "@/lib/graph/feed-selection";
import { rankGraphFounders } from "@/lib/graph/thesis-fit";
import type {
  GraphFounderCard as GraphFounderCardData,
  RankedGraphFounder,
} from "@/lib/graph/types";
import { rankFounders, useThesis, saveThesis, type MatchScore } from "@/lib/thesis";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Today — MatchFund" }],
  }),
  component: TodayDeck,
});

type Decision = "pass" | "watch" | "shortlist" | "contact";

type RankedDiscovery =
  | ({ kind: "graph" } & RankedGraphFounder)
  | {
      kind: "demo";
      founder: Founder;
      match: MatchScore;
      discoveryPriority: number;
    };

const WATCHLIST_KEY = "matchfund:watchlist";

function TodayDeck() {
  const navigate = useNavigate();
  const [thesis, setThesis, hydrated] = useThesis();
  const graphFeedFn = useServerFn(getPublishedGraphFounders);
  const [graphFounders, setGraphFounders] = useState<GraphFounderCardData[]>([]);
  const [graphLoading, setGraphLoading] = useState(true);
  const [graphError, setGraphError] = useState<string | null>(null);

  // Hooked · Trigger + Investment: send new investor into onboarding first.
  useEffect(() => {
    if (hydrated && !thesis) navigate({ to: "/onboard" });
  }, [hydrated, thesis, navigate]);

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

  const ranked = useMemo<RankedDiscovery[]>(() => {
    if (!thesis || graphError) return [];
    const graphRanked = rankGraphFounders(graphFounders, thesis);
    const demoRanked = rankFounders(founders, thesis).map(({ founder, match }) => ({
      kind: "demo" as const,
      founder,
      match,
      discoveryPriority: match.total,
    }));
    const selection = selectFounderFeed(graphRanked, demoRanked);
    return selection.mode === "graph"
      ? selection.records.map((record) => ({ kind: "graph" as const, ...record }))
      : selection.records;
  }, [graphError, graphFounders, thesis]);

  const usingDemoFallback = !graphError && !graphLoading && graphFounders.length === 0;

  const [idx, setIdx] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [drag, setDrag] = useState(0);
  const [exiting, setExiting] = useState<Decision | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const startX = useRef<number | null>(null);

  useEffect(() => setIdx(0), [ranked.length]);
  // Reset the reward reveal each time we advance to the next card — the
  // variable reward has to be earned per swipe, not once per session.
  useEffect(() => {
    setRevealed(false);
  }, [idx]);

  const current = ranked[idx];
  const next1 = ranked[idx + 1];
  const next2 = ranked[idx + 2];

  const record = (decision: Decision) => {
    if (!current) return;
    const founderId = current.founder.id;
    setDecisions((d) => ({ ...d, [founderId]: decision }));
    if (typeof window !== "undefined") {
      const prev = JSON.parse(window.localStorage.getItem("mf.decisions") || "{}");
      prev[founderId] = decision;
      window.localStorage.setItem("mf.decisions", JSON.stringify(prev));
      if (decision === "shortlist" || decision === "watch") {
        const list: string[] = JSON.parse(window.localStorage.getItem(WATCHLIST_KEY) || "[]");
        if (!list.includes(founderId)) {
          list.push(founderId);
          window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
        }
      }
    }

    // Reveal the score with the exit animation — the reward comes AFTER
    // the action, so the outcome is a surprise, not a filter.
    setRevealed(true);
    setExiting(decision);

    // Milestone toast at 5 swipes — makes Investment feedback visible.
    if (thesis) {
      const nextCount = (thesis.swipeCount ?? 0) + 1;
      const updated = { ...thesis, swipeCount: nextCount };
      saveThesis(updated);
      setThesis(updated);
      if (nextCount === 5) {
        setToast("Nice — your match model just got 12% sharper.");
        setTimeout(() => setToast(null), 3500);
      }
    }

    setTimeout(() => {
      setIdx((i) => i + 1);
      setDrag(0);
      setExiting(null);
    }, 320);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") record("pass");
      if (e.key === "ArrowRight") record("shortlist");
      if (e.key === "ArrowUp") record("watch");
      if (e.key === "ArrowDown") record("contact");
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
      watched: values.filter((d) => d === "watch").length,
    };
  }, [decisions]);

  const dismissCoachMark = () => {
    if (thesis) {
      const updated = { ...thesis, seenCoachMark: true };
      saveThesis(updated);
      setThesis(updated);
    }
  };

  if (!hydrated || !thesis) {
    return (
      <AppShell>
        <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">
          Loading your thesis…
        </div>
      </AppShell>
    );
  }

  if (graphLoading) {
    return (
      <AppShell>
        <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">
          Loading published founder evidence…
        </div>
      </AppShell>
    );
  }

  const showCoachMark = !thesis.seenCoachMark && stats.reviewed === 0;

  return (
    <AppShell>
      {graphError && (
        <div className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          <div className="font-medium">The graph-backed founder feed is unavailable.</div>
          <div className="mt-1 text-xs text-rose-200/80">
            {graphError} Demo profiles are not shown because an error does not prove the graph feed
            is empty.
          </div>
        </div>
      )}
      {usingDemoFallback && (
        <div className="mb-5 rounded-xl border border-amber/30 bg-amber/10 p-3 text-xs text-amber">
          Demo fallback · no published graph-backed founders were found. Every card below is a Demo
          profile and does not represent a live crawl.
        </div>
      )}
      {/* Trigger — the daily count that pulls the investor back */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">Today</div>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
            {ranked.length} founders match your thesis
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sorted by Discovery Priority · Thesis Fit and evidence coverage remain separate from
            Founder Score
          </p>
        </div>
        <Link
          to="/onboard"
          className="inline-flex items-center gap-1.5 rounded-full glass-subtle px-3.5 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Target className="h-3.5 w-3.5" /> Edit thesis
        </Link>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left rail — Session (Investment record made visible) */}
        <aside className="col-span-3 space-y-4">
          <div className="rounded-2xl glass p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Session
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                ["Reviewed", stats.reviewed],
                ["Saved", stats.shortlisted],
                ["Watch", stats.watched],
              ].map(([l, v]) => (
                <div
                  key={l as string}
                  className="rounded-xl border border-border/60 bg-elevated/60 p-3"
                >
                  <div className="tabular text-2xl font-semibold">{v}</div>
                  <div className="text-[11px] text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl glass p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Your thesis
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <ThesisChips label="Stage" values={thesis.stages} />
              <ThesisChips label="Sector" values={thesis.sectors} />
              <ThesisChips label="Geo" values={thesis.geos.length ? thesis.geos : ["Global"]} />
            </div>
            <Link
              to="/onboard"
              className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-mint"
            >
              Refine →
            </Link>
          </div>

          <div className="rounded-2xl glass p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Keyboard
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              {[
                ["←", "Pass"],
                ["→", "Save"],
                ["↑", "Watch"],
              ].map(([k, l]) => (
                <li key={k} className="flex items-center gap-3">
                  <kbd className="grid h-6 w-6 place-items-center rounded border border-border bg-elevated text-[11px] text-foreground">
                    {k}
                  </kbd>
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Center — the card stack (Action) */}
        <div className="col-span-6">
          <div className="relative mx-auto min-h-[900px] max-w-md">
            {showCoachMark && current && (
              <div className="absolute -top-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-mint/30 bg-background/90 px-4 py-2 text-xs shadow-lg backdrop-blur">
                Swipe <span className="font-semibold text-mint">right</span> to save,{" "}
                <span className="font-semibold">left</span> to pass · score reveals after each swipe
                <button
                  onClick={dismissCoachMark}
                  className="ml-2 rounded-full text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </div>
            )}

            {next2 && (
              <div
                className="absolute inset-x-0 top-0 origin-top scale-[0.92] opacity-40"
                style={{ transform: "translateY(28px) scale(0.9)" }}
              >
                <DiscoveryFounderCard item={next2} hideScore />
              </div>
            )}
            {next1 && (
              <div
                className="absolute inset-x-0 top-0 origin-top scale-[0.96] opacity-70"
                style={{ transform: "translateY(14px) scale(0.95)" }}
              >
                <DiscoveryFounderCard item={next1} hideScore />
              </div>
            )}
            {current ? (
              <div
                className="absolute inset-x-0 top-0 cursor-grab touch-none active:cursor-grabbing"
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
                    ? `translateX(${exiting === "pass" ? -800 : exiting === "shortlist" ? 800 : 0}px) translateY(${exiting === "watch" ? -800 : exiting === "contact" ? 800 : 0}px) rotate(${exiting === "pass" ? -20 : exiting === "shortlist" ? 20 : 0}deg)`
                    : undefined,
                  transition: exiting ? "transform 320ms ease-in" : undefined,
                  opacity: exiting ? 0 : 1,
                }}
              >
                <DiscoveryFounderCard
                  item={current}
                  dragOffset={drag}
                  hideScore={!revealed && !exiting}
                />
              </div>
            ) : (
              <div className="grid h-full place-items-center rounded-3xl border border-dashed border-border bg-card/40 p-10 text-center">
                <div>
                  <div className="text-lg font-medium">You're through today's matches</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Come back tomorrow for a fresh batch, refine your thesis, or open Saved.
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <button
                      onClick={() => setIdx(0)}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-elevated px-4 py-2 text-sm hover:bg-accent"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restart
                    </button>
                    <Link
                      to="/watchlist"
                      className="rounded-full bg-mint px-4 py-2 text-sm font-medium text-primary-foreground"
                    >
                      Open Saved
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action bar — the three primary verbs */}
          <div className="mt-8 flex items-center justify-center gap-4">
            {[
              { key: "pass" as const, Icon: X, color: "var(--rose)", label: "Pass" },
              { key: "watch" as const, Icon: Eye, color: "var(--amber)", label: "Watch" },
              {
                key: "shortlist" as const,
                Icon: Heart,
                color: "var(--mint)",
                label: "Save",
                primary: true,
              },
              {
                key: "contact" as const,
                Icon: MessageCircle,
                color: "oklch(0.72 0.16 260)",
                label: "Contact",
              },
            ].map(({ key, Icon, color, label, primary }) => (
              <button
                key={key}
                onClick={() => record(key)}
                disabled={!current}
                className="group flex flex-col items-center gap-1.5 disabled:opacity-30"
              >
                <span
                  className={`grid h-14 w-14 place-items-center rounded-full border transition group-hover:scale-105 ${
                    primary
                      ? "border-mint bg-mint text-primary-foreground"
                      : "border-border bg-card"
                  }`}
                  style={{
                    color: primary ? undefined : color,
                    boxShadow: primary ? `0 0 30px ${color}55` : undefined,
                  }}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <span className="text-[11px] text-muted-foreground">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right rail — Up next queue */}
        <aside className="col-span-3 space-y-4">
          <div className="rounded-2xl glass p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Up next
            </div>
            <div className="mt-3 space-y-2">
              {ranked.slice(idx + 1, idx + 6).map((item) => (
                <div
                  key={item.founder.id}
                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-elevated/60 p-2 text-xs"
                >
                  <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-elevated">
                    {founderAvatar(item) ? (
                      <img
                        src={founderAvatar(item) ?? undefined}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-[9px] font-medium text-mint">
                        {founderInitials(item.founder.name)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{item.founder.name}</div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {founderSubtitle(item)}
                    </div>
                  </div>
                  <div
                    className="tabular text-[11px] font-semibold text-mint blur-sm"
                    title="Reveals when you reach this card"
                  >
                    {item.discoveryPriority}
                  </div>
                </div>
              ))}
              {ranked.slice(idx + 1).length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                  End of today's queue.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl glass p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Saved this session
            </div>
            <div className="mt-3 space-y-2">
              {Object.entries(decisions)
                .filter(([, d]) => d === "shortlist" || d === "watch")
                .slice(-3)
                .map(([id, d]) => {
                  const item = ranked.find((candidate) => candidate.founder.id === id);
                  if (!item) return null;
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-2 rounded-lg border border-border/60 bg-elevated/60 p-2 text-xs"
                    >
                      <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-elevated">
                        {founderAvatar(item) ? (
                          <img
                            src={founderAvatar(item) ?? undefined}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-[9px] font-medium text-mint">
                            {founderInitials(item.founder.name)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{item.founder.name}</div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {item.founder.headline}
                        </div>
                      </div>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                        style={{
                          color: d === "shortlist" ? "var(--mint)" : "var(--amber)",
                          borderColor: d === "shortlist" ? "var(--mint)" : "var(--amber)",
                          borderWidth: 1,
                        }}
                      >
                        {d}
                      </span>
                    </div>
                  );
                })}
              {Object.keys(decisions).length === 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                  <Bookmark className="h-3.5 w-3.5" /> Nothing saved yet.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Discovered founders — sourced from the web (secondary surface) */}
      <section className="mt-14">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
              Sourced
            </div>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">
              Founder evidence in this feed
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {usingDemoFallback
                ? "Demo profiles are shown only because the published graph feed is empty."
                : "Published founders projected from stored GitHub graph evidence."}
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ranked.slice(0, 9).map((item) => (
            <div key={item.founder.id} className="rounded-2xl glass p-4">
              <div className="flex items-start gap-3">
                {founderAvatar(item) ? (
                  <img
                    src={founderAvatar(item) ?? undefined}
                    alt=""
                    className="h-11 w-11 rounded-full object-cover"
                  />
                ) : (
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-elevated text-xs font-medium text-mint">
                    {founderInitials(item.founder.name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="truncate text-sm font-medium">{item.founder.name}</div>
                    <div className="tabular text-xs font-semibold text-mint">
                      {item.discoveryPriority}
                    </div>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {item.founder.headline}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.kind === "graph" ? (
                  <>
                    <SourceChip
                      icon="github"
                      label={`${item.founder.repositoryCount} GitHub repositories`}
                    />
                    <SourceChip label={`${item.founder.sourceCount} evidence sources`} />
                    <SourceChip label={`${item.founder.evidenceConfidence} Evidence Confidence`} />
                  </>
                ) : (
                  <>
                    <SourceChip label="Demo profile" />
                    {discoveredSources(item.founder)
                      .slice(0, 2)
                      .map((source, index) => (
                        <SourceChip key={index} icon={source.kind} label={source.label} />
                      ))}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {toast && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full border border-mint/30 bg-background/90 px-5 py-2.5 text-sm shadow-lg backdrop-blur">
          <Sparkles className="mr-2 inline h-3.5 w-3.5 text-mint" />
          {toast}
        </div>
      )}
    </AppShell>
  );
}

function DiscoveryFounderCard({
  item,
  dragOffset = 0,
  hideScore = false,
}: {
  item: RankedDiscovery;
  dragOffset?: number;
  hideScore?: boolean;
}) {
  return item.kind === "graph" ? (
    <FounderCard
      founder={item.founder}
      thesisFit={item.thesisFit}
      discoveryPriority={item.discoveryPriority}
      dragOffset={dragOffset}
      hideScore={hideScore}
    />
  ) : (
    <FounderCard
      founder={item.founder}
      match={item.match}
      dragOffset={dragOffset}
      hideScore={hideScore}
    />
  );
}

function founderAvatar(item: RankedDiscovery): string | null {
  return item.kind === "graph" ? item.founder.avatarUrl : item.founder.avatar;
}

function founderInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function founderSubtitle(item: RankedDiscovery): string {
  if (item.kind === "demo") return `${item.founder.sector} · ${item.founder.stage} · Demo`;
  return `${item.founder.topics[0] ?? "Topic unknown"} · ${item.founder.evidenceConfidence} evidence`;
}

function SourceChip({ icon, label }: { icon?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-elevated/60 px-2 py-0.5 text-[10px] text-muted-foreground">
      {icon === "github" && <Github className="h-2.5 w-2.5" />}
      {icon === "hackathon" && <Trophy className="h-2.5 w-2.5 text-mint" />}
      {label}
    </span>
  );
}

function ThesisChips({ label, values }: { label: string; values: string[] }) {
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
              className="rounded-full border border-mint/25 bg-mint-soft/40 px-2 py-0.5 text-[10px] text-mint"
            >
              {v}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
