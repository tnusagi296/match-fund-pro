import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  Eye,
  Filter,
  Heart,
  MessageCircle,
  RotateCcw,
  X,
} from "lucide-react";
import { AppShell } from "@/components/matchfund/AppShell";
import { FounderCard } from "@/components/matchfund/FounderCard";
import { founders, type Sector, type Stage } from "@/data/matchfund";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Discover founders — Match Fund" }],
  }),
  component: SwipeDeck,
});

type Decision = "pass" | "watch" | "shortlist" | "contact";
const SECTORS: Sector[] = ["AI", "Climate", "Fintech", "Bio", "Devtools", "Robotics", "Consumer"];
const STAGES: Stage[] = ["Idea", "Hackathon", "Prototype", "Pre-seed", "Seed"];

function SwipeDeck() {
  const [sectorFilter, setSectorFilter] = useState<Sector[]>([]);
  const [stageFilter, setStageFilter] = useState<Stage[]>([]);
  const [hackathonOnly, setHackathonOnly] = useState(false);
  const [minFit, setMinFit] = useState(0);

  const filtered = useMemo(() => {
    return founders.filter((f) => {
      if (sectorFilter.length && !sectorFilter.includes(f.sector)) return false;
      if (stageFilter.length && !stageFilter.includes(f.stage)) return false;
      if (hackathonOnly && f.signals.hackathonWins === 0) return false;
      if (f.scores.fit < minFit) return false;
      return true;
    });
  }, [sectorFilter, stageFilter, hackathonOnly, minFit]);

  const [idx, setIdx] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [drag, setDrag] = useState(0);
  const [exiting, setExiting] = useState<Decision | null>(null);
  const startX = useRef<number | null>(null);

  useEffect(() => setIdx(0), [filtered.length]);

  const current = filtered[idx];
  const next1 = filtered[idx + 1];
  const next2 = filtered[idx + 2];

  const record = (decision: Decision) => {
    if (!current) return;
    setDecisions((d) => ({ ...d, [current.id]: decision }));
    if (typeof window !== "undefined") {
      const key = `mf.decisions`;
      const prev = JSON.parse(window.localStorage.getItem(key) || "{}");
      prev[current.id] = decision;
      window.localStorage.setItem(key, JSON.stringify(prev));
    }
    setExiting(decision);
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
      if (e.key === "ArrowUp") record("watch");
      if (e.key === "ArrowDown") record("contact");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current?.id]);

  const stats = useMemo(() => {
    const values = Object.values(decisions);
    return {
      reviewed: values.length,
      shortlisted: values.filter((d) => d === "shortlist").length,
      watched: values.filter((d) => d === "watch").length,
      contacted: values.filter((d) => d === "contact").length,
    };
  }, [decisions]);

  const toggle = <T,>(arr: T[], v: T, set: (n: T[]) => void) => {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
            Discovery
          </div>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
            Today's matched founders
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Ranked against Horizon Fund thesis · {filtered.length} founders · pre-seed & seed
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" /> {sectorFilter.length + stageFilter.length + (hackathonOnly ? 1 : 0)} filters
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left rail: session stats + keys */}
        <aside className="col-span-3 space-y-4">
          <div className="rounded-2xl glass p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Session
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                ["Reviewed", stats.reviewed],
                ["Shortlisted", stats.shortlisted],
                ["Watched", stats.watched],
                ["Contacted", stats.contacted],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-xl border border-border/60 bg-elevated/60 p-3">
                  <div className="tabular text-2xl font-semibold">{v}</div>
                  <div className="text-[11px] text-muted-foreground">{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl glass p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Keyboard
            </div>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              {[
                ["←", "Pass"],
                ["→", "Shortlist"],
                ["↑", "Watch"],
                ["↓", "Contact"],
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

          <div className="rounded-2xl border border-mint/25 bg-mint-soft/30 p-5">
            <div className="text-xs font-medium text-mint">Founder mode</div>
            <p className="mt-2 text-xs text-foreground/80">
              You're a builder? Publish a profile — investors swipe on evidence, not warm intros.
            </p>
            <Link
              to="/me"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-mint"
            >
              Create founder profile →
            </Link>
          </div>
        </aside>

        {/* Center: card stack */}
        <div className="col-span-6">
          <div className="relative mx-auto h-[660px] max-w-md">
            {next2 && (
              <div
                className="absolute inset-x-0 top-0 origin-top scale-[0.92] opacity-40"
                style={{ transform: "translateY(28px) scale(0.9)" }}
              >
                <FounderCard founder={next2} />
              </div>
            )}
            {next1 && (
              <div
                className="absolute inset-x-0 top-0 origin-top scale-[0.96] opacity-70"
                style={{ transform: "translateY(14px) scale(0.95)" }}
              >
                <FounderCard founder={next1} />
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
                  transition: exiting ? "transform 260ms ease-in" : undefined,
                  opacity: exiting ? 0 : 1,
                }}
              >
                <FounderCard founder={current} dragOffset={drag} />
              </div>
            ) : (
              <div className="grid h-full place-items-center rounded-3xl border border-dashed border-border bg-card/40 p-10 text-center">
                <div>
                  <div className="text-lg font-medium">You've reviewed today's top matches</div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Refine your thesis to see more, or open your watchlist.
                  </p>
                  <button
                    onClick={() => setIdx(0)}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-elevated px-4 py-2 text-sm hover:bg-accent"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Restart deck
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="mt-8 flex items-center justify-center gap-4">
            {[
              { key: "pass" as const, Icon: X, color: "var(--rose)", label: "Pass" },
              { key: "watch" as const, Icon: Eye, color: "var(--amber)", label: "Watch" },
              { key: "shortlist" as const, Icon: Heart, color: "var(--mint)", label: "Shortlist", primary: true },
              { key: "contact" as const, Icon: MessageCircle, color: "oklch(0.72 0.16 260)", label: "Contact" },
            ].map(({ key, Icon, color, label, primary }) => (
              <button
                key={key}
                onClick={() => record(key)}
                disabled={!current}
                className="group flex flex-col items-center gap-1.5 disabled:opacity-30"
              >
                <span
                  className={`grid h-14 w-14 place-items-center rounded-full border transition group-hover:scale-105 ${
                    primary ? "border-mint bg-mint text-primary-foreground" : "border-border bg-card"
                  }`}
                  style={{
                    color: primary ? undefined : color,
                    boxShadow: primary ? `0 0 30px ${color}55` : undefined,
                  }}
                >
                  <Icon className={`h-5 w-5 ${primary ? "" : ""}`} strokeWidth={2.2} />
                </span>
                <span className="text-[11px] text-muted-foreground">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right rail: filters */}
        <aside className="col-span-3 space-y-4">
          <div className="rounded-2xl glass p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Thesis filters
              </div>
              <button
                className="text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSectorFilter([]);
                  setStageFilter([]);
                  setHackathonOnly(false);
                  setMinFit(0);
                }}
              >
                Reset
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-2 text-[11px] text-muted-foreground">Sector</div>
                <div className="flex flex-wrap gap-1.5">
                  {SECTORS.map((s) => {
                    const active = sectorFilter.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() => toggle(sectorFilter, s, setSectorFilter)}
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                          active
                            ? "border-mint bg-mint-soft text-mint"
                            : "border-border bg-elevated text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[11px] text-muted-foreground">Stage</div>
                <div className="flex flex-wrap gap-1.5">
                  {STAGES.map((s) => {
                    const active = stageFilter.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() => toggle(stageFilter, s, setStageFilter)}
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                          active
                            ? "border-mint bg-mint-soft text-mint"
                            : "border-border bg-elevated text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-baseline justify-between text-[11px] text-muted-foreground">
                  <span>Min. Founder Fit</span>
                  <span className="tabular font-medium text-foreground">{minFit}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={95}
                  value={minFit}
                  onChange={(e) => setMinFit(Number(e.target.value))}
                  className="w-full accent-[var(--mint)]"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-foreground/80">
                <input
                  type="checkbox"
                  checked={hackathonOnly}
                  onChange={(e) => setHackathonOnly(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--mint)]"
                />
                Hackathon-sourced only
              </label>
            </div>
          </div>

          <div className="rounded-2xl glass p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Watchlist
            </div>
            <div className="mt-3 space-y-2">
              {Object.entries(decisions)
                .filter(([, d]) => d === "shortlist" || d === "watch")
                .slice(-4)
                .map(([id, d]) => {
                  const f = founders.find((x) => x.id === id);
                  if (!f) return null;
                  return (
                    <Link
                      key={id}
                      to="/founder/$id"
                      params={{ id: f.id }}
                      className="flex items-center gap-2 rounded-lg border border-border/60 bg-elevated/60 p-2 text-xs hover:border-mint/40"
                    >
                      <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-elevated">
                        <img src={f.avatar} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{f.name}</div>
                        <div className="truncate text-[10px] text-muted-foreground">{f.headline}</div>
                      </div>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                          d === "shortlist"
                            ? "border border-mint/30 bg-mint-soft text-mint"
                            : "border border-amber/30 bg-amber/10 text-amber"
                        }`}
                        style={{ color: d === "shortlist" ? "var(--mint)" : "var(--amber)" }}
                      >
                        {d}
                      </span>
                    </Link>
                  );
                })}
              {Object.keys(decisions).length === 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                  <Bookmark className="h-3.5 w-3.5" /> No shortlist yet — swipe right.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
