import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Flame, Github, MapPin, Sparkles, Trophy } from "lucide-react";
import { discoveredSources, type Founder } from "@/data/matchfund";
import type { MatchScore } from "@/lib/thesis";
import { ScoreBar } from "./ScoreRing";


export function FounderCard({
  founder,
  dragOffset = 0,
  match,
  hideScore = false,
}: {
  founder: Founder;
  dragOffset?: number;
  match?: MatchScore;
  hideScore?: boolean;
}) {
  const rot = dragOffset * 0.04;
  const tint =
    dragOffset > 40
      ? "var(--mint)"
      : dragOffset < -40
        ? "var(--rose)"
        : "transparent";

  return (
    <div
      className="relative w-full rounded-3xl glass shadow-2xl"
      style={{
        transform: `translateX(${dragOffset}px) rotate(${rot}deg)`,
        transition: dragOffset === 0 ? "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
        boxShadow: `0 30px 60px -30px oklch(0 0 0 / 0.6), 0 0 0 1px ${tint === "transparent" ? "transparent" : tint}`,
      }}
    >

      {/* header photo strip */}
      <div className="relative h-56 overflow-hidden rounded-t-3xl">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 30% 40%, oklch(0.86 0.17 155 / 0.35), transparent 60%),
              radial-gradient(circle at 80% 60%, oklch(0.55 0.18 250 / 0.5), transparent 55%),
              linear-gradient(160deg, oklch(0.28 0.05 240), oklch(0.22 0.04 260))`,
          }}
        />
        <div className="absolute -bottom-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full border-4 border-card bg-elevated">
          <img src={founder.avatar} alt={founder.name} className="h-full w-full rounded-full object-cover" />
        </div>
        {founder.openTo !== "not-open" && (
          <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint-soft px-3 py-1 text-[11px] font-medium text-mint">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" />
            {founder.openTo === "cofounder" ? "Seeking cofounder" : "Open to opportunities"}
          </div>
        )}
        <div className="absolute left-4 top-4 rounded-full glass/70 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur">
          {founder.stage}
        </div>
      </div>

      <div className="px-8 pb-8 pt-24">
        <div className="flex items-baseline justify-center gap-1.5">
          <h2 className="text-2xl font-semibold tracking-tight">{founder.name}</h2>
          {founder.verified && <CheckCircle2 className="h-4 w-4 text-mint" />}
        </div>
        <p className="mt-1 text-center text-sm text-muted-foreground">{founder.headline}</p>
        <div className="mt-2 flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {founder.location}
          </span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
          <span className="inline-flex items-center gap-1">
            <Trophy className="h-3 w-3" /> {founder.signals.hackathonWins} hackathon wins
          </span>
        </div>

        <p className="mt-5 text-center text-sm leading-relaxed text-foreground/80">
          {founder.bio}
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-1.5">
          {founder.skills.map((s) => (
            <span
              key={s}
              className="rounded-full border border-border bg-elevated px-2.5 py-0.5 text-[11px] text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>

        {/* Match reveal — variable reward. Shown blurred until swiped. */}
        <div className="mt-6 relative">
          {match && (
            <div
              className={`mb-3 flex items-center justify-between rounded-2xl border p-3 transition-all ${
                match.isRareFind
                  ? "border-amber/40 bg-amber/10"
                  : "border-mint/30 bg-mint-soft/40"
              }`}
            >
              <div className="flex items-center gap-2">
                {match.isRareFind ? (
                  <Flame className="h-4 w-4 text-amber" />
                ) : (
                  <Sparkles className="h-4 w-4 text-mint" />
                )}
                <div className="text-xs">
                  <div className="font-medium">
                    {match.isRareFind ? "Rare find" : "Thesis match"}
                  </div>
                  <div className="text-muted-foreground">
                    {match.reasons.join(" · ") || founder.matchReason}
                  </div>
                </div>
              </div>
              <div className="tabular text-2xl font-semibold" style={{ color: match.isRareFind ? "var(--amber)" : "var(--mint)" }}>
                {match.total}
              </div>
            </div>
          )}

          <div className={`grid grid-cols-4 gap-3 transition ${hideScore ? "blur-md opacity-40 pointer-events-none select-none" : ""}`}>
            {(
              [
                ["Fit", founder.scores.fit],
                ["Idea", founder.scores.idea],
                ["Traction", founder.scores.traction],
                ["Trust", founder.scores.trust],
              ] as const
            ).map(([label, val]) => (
              <div key={label}>
                <ScoreBar label={label} value={val} />
              </div>
            ))}
          </div>
          {hideScore && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="rounded-full border border-mint/30 bg-background/70 px-3 py-1 text-[11px] font-medium text-mint backdrop-blur">
                Swipe to reveal
              </div>
            </div>
          )}
        </div>

        {!match && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-mint/20 bg-mint-soft/40 p-3 text-xs">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint" />
            <span className="text-foreground/85">
              <span className="font-medium text-mint">Why matched · </span>
              {founder.matchReason}
            </span>
          </div>
        )}

        <div className="mt-5">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Discovered on
          </div>
          <div className="flex flex-wrap gap-1.5">
            {discoveredSources(founder).slice(0, 4).map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-elevated/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                title={s.detail}
              >
                {s.kind === "github" && <Github className="h-2.5 w-2.5" />}
                {s.kind === "hackathon" && <Trophy className="h-2.5 w-2.5 text-mint" />}
                {s.label}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <Link
            to="/founder/$id"
            params={{ id: founder.id }}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-mint px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_0_28px_var(--mint-soft)] transition hover:brightness-110"
            onPointerDown={(e) => e.stopPropagation()}
          >
            Open full profile <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          {founder.companyId && (
            <Link
              to="/company/$id"
              params={{ id: founder.companyId }}
              className="inline-flex items-center justify-center rounded-full border border-border bg-elevated px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground"
              onPointerDown={(e) => e.stopPropagation()}
            >
              Diligence
            </Link>
          )}
        </div>

      </div>

      {tint !== "transparent" && (
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl"
          style={{ boxShadow: `inset 0 0 80px ${tint}` }}
        />
      )}
    </div>
  );
}
