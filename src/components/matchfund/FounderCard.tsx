import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Flame,
  Github,
  MapPin,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import { discoveredSources, type Founder } from "@/data/matchfund";
import type { GraphFounderCard as GraphFounderCardData, ThesisFitResult } from "@/lib/graph/types";
import { profileProvenanceLabel } from "@/lib/graph/profile-provenance";
import type { MatchScore } from "@/lib/thesis";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ScoreBar } from "./ScoreRing";

type DemoFounderCardProps = {
  founder: Founder;
  dragOffset?: number;
  match?: MatchScore;
  hideScore?: boolean;
};

type GraphFounderCardProps = {
  founder: GraphFounderCardData;
  dragOffset?: number;
  thesisFit: ThesisFitResult;
  discoveryPriority: number;
  hideScore?: boolean;
};

export function FounderCard(props: DemoFounderCardProps | GraphFounderCardProps) {
  if ("kind" in props.founder && props.founder.kind === "graph") {
    return <GraphFounderSignalCard {...(props as GraphFounderCardProps)} />;
  }
  return <DemoFounderCard {...(props as DemoFounderCardProps)} />;
}

function DemoFounderCard({
  founder,
  dragOffset = 0,
  match,
  hideScore = false,
}: DemoFounderCardProps) {
  const rot = dragOffset * 0.04;
  const tint = dragOffset > 40 ? "var(--mint)" : dragOffset < -40 ? "var(--rose)" : "transparent";

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
          <img
            src={founder.avatar}
            alt={founder.name}
            className="h-full w-full rounded-full object-cover"
          />
        </div>
        {founder.openTo !== "not-open" && (
          <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint-soft px-3 py-1 text-[11px] font-medium text-mint">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" />
            {founder.openTo === "cofounder" ? "Seeking cofounder" : "Open to opportunities"}
          </div>
        )}
        <div className="absolute left-4 top-4 flex items-center gap-1.5">
          <span className="rounded-full glass/70 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur">
            {founder.stage}
          </span>
          <span className="rounded-full border border-amber/30 bg-background/70 px-2.5 py-1 text-[10px] font-medium text-amber backdrop-blur">
            Demo profile
          </span>
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

        <p className="mt-5 text-center text-sm leading-relaxed text-foreground/80">{founder.bio}</p>

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
                match.isRareFind ? "border-amber/40 bg-amber/10" : "border-mint/30 bg-mint-soft/40"
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
              <div
                className="tabular text-2xl font-semibold"
                style={{ color: match.isRareFind ? "var(--amber)" : "var(--mint)" }}
              >
                {match.total}
              </div>
            </div>
          )}

          <div
            className={`grid grid-cols-4 gap-3 transition ${hideScore ? "blur-md opacity-40 pointer-events-none select-none" : ""}`}
          >
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
            {discoveredSources(founder)
              .slice(0, 4)
              .map((s, i) => (
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

function formatDate(value: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toLocaleDateString();
}

function GraphFounderSignalCard({
  founder,
  dragOffset = 0,
  thesisFit,
  discoveryPriority,
  hideScore = false,
}: GraphFounderCardProps) {
  const rot = dragOffset * 0.04;
  const tint = dragOffset > 40 ? "var(--mint)" : dragOffset < -40 ? "var(--rose)" : "transparent";
  const initials = founder.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="relative w-full rounded-3xl glass shadow-2xl"
      style={{
        transform: `translateX(${dragOffset}px) rotate(${rot}deg)`,
        transition: dragOffset === 0 ? "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
        boxShadow: `0 30px 60px -30px oklch(0 0 0 / 0.6), 0 0 0 1px ${tint === "transparent" ? "transparent" : tint}`,
      }}
    >
      <div className="relative h-48 overflow-hidden rounded-t-3xl">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 30% 40%, oklch(0.86 0.17 155 / 0.35), transparent 60%),
              radial-gradient(circle at 80% 60%, oklch(0.72 0.16 220 / 0.35), transparent 55%),
              linear-gradient(160deg, oklch(0.2 0.04 240), oklch(0.14 0.03 260))`,
          }}
        />
        <div className="absolute left-4 top-4 rounded-full border border-mint/30 bg-background/70 px-2.5 py-1 text-[10px] font-medium text-mint backdrop-blur">
          {profileProvenanceLabel(founder)}
        </div>
        <div className="absolute right-4 top-4 rounded-full border border-border bg-background/70 px-2.5 py-1 text-[10px] text-muted-foreground backdrop-blur">
          {founder.repositoryCount} repos · {founder.projects.length} projects ·{" "}
          {founder.sourceCount} sources
        </div>
        <div className="absolute -bottom-14 left-1/2 grid h-32 w-32 -translate-x-1/2 place-items-center overflow-hidden rounded-full border-4 border-card bg-elevated text-2xl font-semibold text-mint">
          {founder.avatarUrl ? (
            <img
              src={founder.avatarUrl}
              alt={founder.name}
              className="h-full w-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
      </div>

      <div className="px-7 pb-7 pt-20">
        <div className="flex items-center justify-center gap-1.5">
          <h2 className="text-2xl font-semibold tracking-tight">{founder.name}</h2>
          <ShieldCheck className="h-4 w-4 text-cyan-300" aria-label="Graph-backed evidence" />
        </div>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          {founder.headline || "Founder with public GitHub evidence"}
        </p>
        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" /> {founder.location ?? "Geography unknown"}
          <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
          <span>Updated {formatDate(founder.recentActivityAt)}</span>
        </div>

        <p className="mt-4 text-center text-sm leading-relaxed text-foreground/80">
          {founder.summary}
        </p>

        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {[...founder.mainLanguages, ...founder.technologies, ...founder.topics]
            .slice(0, 7)
            .map((value, index) => (
              <span
                key={`${value}-${index}`}
                className="rounded-full border border-border bg-elevated px-2.5 py-0.5 text-[11px] text-muted-foreground"
              >
                {value}
              </span>
            ))}
        </div>

        {founder.projects.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {founder.projects.slice(0, 2).map((project) => (
              <div
                key={project.entityId}
                className="rounded-lg border border-border/60 bg-elevated/30 px-3 py-2 text-[10px] text-muted-foreground"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground/90">
                    {project.name}
                    {project.eventName ? ` · ${project.eventName}` : ""}
                  </span>
                  <span className="shrink-0 uppercase tracking-wider">
                    {project.contributionTrust} contribution trust
                  </span>
                </div>
                {(project.role || project.resultType !== "unknown") && (
                  <div className="mt-1">
                    {project.role ? `Role: ${project.role}` : "Role unknown"}
                    {project.resultType !== "unknown"
                      ? ` · Result: ${project.resultLabel ?? project.resultType} (${project.resultTrust} trust)`
                      : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {founder.unsupportedClaims.length > 0 && (
          <div className="mt-2 rounded-lg border border-dashed border-amber/30 bg-amber/5 px-3 py-2 text-[10px] leading-relaxed text-amber/90">
            Unsupported or unresolved · {founder.unsupportedClaims.slice(0, 2).join(" · ")}
          </div>
        )}

        <div className="mt-5 rounded-2xl border border-mint/30 bg-mint-soft/30 p-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5 text-mint" /> Thesis Fit
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {thesisFit.matchedCriteria.slice(0, 2).join(" · ") ||
                  "No supported criterion match yet"}
              </div>
            </div>
            <div className={hideScore ? "blur-md opacity-40" : ""}>
              <div className="tabular text-2xl font-semibold text-mint">{thesisFit.score}</div>
            </div>
          </div>
          {hideScore && (
            <div className="mt-2 text-right text-[10px] font-medium text-mint">
              Swipe to reveal score
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <CardMetric
            label="Discovery Priority"
            value={hideScore ? "—" : String(discoveryPriority)}
          />
          <CardMetric label="Evidence Confidence" value={founder.evidenceConfidence} />
          <CardMetric label="Founder Score" value={founder.founderScoreLabel} />
        </div>

        <div className="mt-4 space-y-2">
          {founder.topSignals.map((signal) => (
            <div
              key={signal.title}
              className="rounded-xl border border-border/60 bg-elevated/50 p-3"
            >
              <div className="flex items-start justify-between gap-3 text-xs">
                <span className="font-medium">{signal.title}</span>
                <span className="shrink-0 text-[9px] uppercase tracking-wider text-cyan-300">
                  {signal.trustLevel} trust
                </span>
              </div>
              <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                {signal.detail}
              </div>
            </div>
          ))}
        </div>

        {founder.discoveryProvenance.length > 0 && (
          <details
            className="mt-4 rounded-xl border border-border/70 bg-elevated/30 p-3"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <summary className="cursor-pointer text-xs font-medium text-foreground">
              Why discovered · {founder.discoveryProvenance.length} public-source introduction
              {founder.discoveryProvenance.length === 1 ? "" : "s"}
            </summary>
            <div className="mt-3 space-y-2">
              {founder.discoveryProvenance.map((provenance, index) => (
                <div
                  key={`${provenance.source}-${provenance.sourceUrl}-${index}`}
                  className="rounded-lg border border-border/60 bg-background/40 p-3 text-[11px]"
                >
                  <div className="font-medium capitalize text-foreground">
                    {provenance.source.replace("_", " ")}
                  </div>
                  {provenance.reasons.slice(0, 3).map((reason, reasonIndex) => (
                    <div
                      key={`${reason.query}-${reasonIndex}`}
                      className="mt-1 text-muted-foreground"
                    >
                      {reason.reason}
                      {reason.query ? ` · theme/query: ${reason.query}` : ""}
                    </div>
                  ))}
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <a
                      href={provenance.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-w-0 items-center gap-1 truncate text-cyan-300 hover:underline"
                    >
                      Open discovery source <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    <span className="shrink-0 text-muted-foreground">
                      {formatDate(provenance.introducedAt)}
                    </span>
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground/80">
                    Discovery provenance only—not matching evidence.
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        <Drawer shouldScaleBackground={false}>
          <DrawerTrigger asChild>
            <button
              type="button"
              className="mt-4 flex w-full items-center justify-between rounded-xl border border-cyan-300/25 bg-cyan-300/5 p-3 text-xs font-medium text-cyan-200"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <span>Why matched · {thesisFit.evidencePaths.length} evidence paths</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[88vh] border-cyan-300/25 bg-background/95 backdrop-blur-xl">
            <DrawerHeader className="mx-auto w-full max-w-3xl px-6 pb-3">
              <DrawerTitle>Why {founder.name} matched</DrawerTitle>
              <DrawerDescription>
                Deterministic thesis criteria connected to stored graph relationships, claims, and
                source evidence.
              </DrawerDescription>
            </DrawerHeader>
            <div className="mx-auto w-full max-w-3xl space-y-3 overflow-y-auto px-6 pb-4">
              {thesisFit.evidencePaths.map((path, index) => (
                <div
                  key={`${path.criterion}-${path.sourceUrl}-${index}`}
                  className="rounded-xl border border-border/60 bg-elevated/40 p-4"
                >
                  <div className="text-sm font-medium text-foreground">{path.criterion}</div>
                  <div className="my-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-mint" /> {path.graphStep}
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/50 p-3 text-xs leading-relaxed text-foreground/80">
                    {path.evidenceExcerpt}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                    <a
                      href={path.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-w-0 items-center gap-1 truncate text-cyan-300 hover:underline"
                    >
                      {path.sourceName} <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    <span className="shrink-0">
                      {path.trustLevel} trust · observed {formatDate(path.observedAt)}
                    </span>
                  </div>
                </div>
              ))}
              {thesisFit.evidencePaths.length === 0 && (
                <p className="rounded-xl border border-dashed border-border p-4 text-xs leading-relaxed text-muted-foreground">
                  No stored evidence path supports a selected thesis criterion yet. Missing criteria
                  remain unknown.
                </p>
              )}
              {thesisFit.unknownCriteria.length + founder.unknowns.length > 0 && (
                <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Unknowns · </span>
                  {[...new Set([...thesisFit.unknownCriteria, ...founder.unknowns])]
                    .slice(0, 8)
                    .join(" · ")}
                </div>
              )}
            </div>
            <DrawerFooter className="mx-auto w-full max-w-3xl px-6 pt-0">
              <DrawerClose asChild>
                <button
                  type="button"
                  className="rounded-full border border-border bg-elevated px-4 py-2 text-sm"
                >
                  Close evidence
                </button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        <div className="mt-4">
          {founder.githubUrl ? (
            <a
              href={founder.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-mint px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_0_28px_var(--mint-soft)] transition hover:brightness-110"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <Github className="h-3.5 w-3.5" /> Open source profile
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <div className="rounded-full border border-border px-4 py-2.5 text-center text-xs text-muted-foreground">
              Source profile unavailable
            </div>
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

function CardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-elevated/50 p-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-[11px] font-medium leading-tight">{value}</div>
    </div>
  );
}
