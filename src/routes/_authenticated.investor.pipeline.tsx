import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowLeftRight,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  Eye,
  ExternalLink,
  Mail,
  PenLine,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
} from "lucide-react";
import { AppShell } from "@/components/matchfund/AppShell";
import { ScoreHelpButton } from "@/components/matchfund/ScoreHelp";
import {
  CONTACT_STATUS_LABELS,
  pipelineService,
  useInvestorKey,
  usePipeline,
  type ContactStatus,
  type PipelineEntry,
  type PipelineStatus,
} from "@/services/pipelineService";

export const Route = createFileRoute("/_authenticated/investor/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline — MatchFund" }] }),
  component: PipelinePage,
});

type Tab = PipelineStatus;

function PipelinePage() {
  const userKey = useInvestorKey();
  const { shortlisted, monitoring, avgThesisMatch } = usePipeline(userKey);
  const [tab, setTab] = useState<Tab>("shortlist");
  const active = tab === "shortlist" ? shortlisted : monitoring;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
              Pipeline
            </div>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
              Your pipeline
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Shortlisted founders reflect active interest. Monitoring keeps an eye on future
              signals.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ScoreHelpButton />
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard
            label="Shortlisted"
            value={shortlisted.length}
            tone="mint"
            icon={<BookmarkCheck className="h-3.5 w-3.5" />}
          />
          <SummaryCard
            label="Monitoring"
            value={monitoring.length}
            tone="amber"
            icon={<Eye className="h-3.5 w-3.5" />}
          />
          <AvgMatchCard value={avgThesisMatch} sampleSize={shortlisted.length + monitoring.length} />
        </div>

        <div className="mb-5 inline-flex rounded-full glass-subtle p-1">
          <TabButton
            active={tab === "shortlist"}
            onClick={() => setTab("shortlist")}
            tone="mint"
            label="Shortlisted"
            count={shortlisted.length}
          />
          <TabButton
            active={tab === "monitor"}
            onClick={() => setTab("monitor")}
            tone="amber"
            label="Monitoring"
            count={monitoring.length}
          />
        </div>

        {active.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="space-y-3">
            {active.map((entry) => (
              <EntryRow
                key={entry.founderId}
                entry={entry}
                userKey={userKey}
                tab={tab}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

// -----------------------------------------------------------------------------
// Row
// -----------------------------------------------------------------------------

function EntryRow({
  entry,
  userKey,
  tab,
}: {
  entry: PipelineEntry;
  userKey: string | null;
  tab: Tab;
}) {
  const s = entry.snapshot;
  const toneRing =
    tab === "shortlist"
      ? "border-mint/40 shadow-[0_0_0_1px_var(--mint-soft)]"
      : "border-amber/40";
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(entry.note);

  function move() {
    if (!userKey) return;
    const nextStatus: PipelineStatus = tab === "shortlist" ? "monitor" : "shortlist";
    pipelineService.upsert(userKey, nextStatus, entry.snapshot);
    toast.success(
      nextStatus === "shortlist"
        ? `${s.name} moved to Shortlist`
        : `${s.name} moved to Monitoring`,
    );
  }

  function remove() {
    if (!userKey) return;
    const removed = pipelineService.remove(userKey, entry.founderId);
    if (!removed) return;
    toast(`${s.name} removed from Pipeline`, {
      action: {
        label: "Undo",
        onClick: () => pipelineService.restore(userKey, removed),
      },
    });
  }

  function markContacted() {
    if (!userKey) return;
    pipelineService.updateContact(userKey, entry.founderId, "contacted");
    toast.success(`${s.name} marked as contacted`);
  }

  function requestIntro() {
    if (!userKey) return;
    pipelineService.updateContact(userKey, entry.founderId, "contact_planned");
    toast(
      "Introduction request queued. TODO(CTO): wire to real intro workflow when backend is ready.",
    );
  }

  function saveNote() {
    if (!userKey) return;
    pipelineService.updateNote(userKey, entry.founderId, noteDraft);
    setNoteOpen(false);
    toast.success("Note saved");
  }

  const dateAdded = formatDate(entry.addedAt);
  const lastSignal = s.lastSignalAt ? formatDate(s.lastSignalAt) : "—";

  return (
    <article className={`rounded-2xl glass p-4 ${toneRing}`}>
      <div className="flex items-start gap-4">
        <Avatar name={s.name} url={s.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={entry.status} />
            {s.verified && (
              <span className="inline-flex items-center gap-1 rounded-full border border-mint/30 bg-mint-soft/40 px-2 py-0.5 text-[10px] font-medium text-mint">
                <ShieldCheck className="h-3 w-3" /> Verified
              </span>
            )}
            {s.dataMode === "demo" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 text-[10px] font-medium text-amber">
                Demo profile
              </span>
            )}
            <ContactPill
              status={entry.contactStatus}
              onChange={(next) => {
                if (!userKey) return;
                pipelineService.updateContact(userKey, entry.founderId, next);
              }}
            />
          </div>
          <h3 className="mt-2 font-display text-xl font-semibold tracking-tight">{s.name}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">{s.headline}</p>

          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
            {s.sector && <Tag label={s.sector} />}
            {s.stage && <Tag label={s.stage} />}
            {s.location && <Tag label={s.location} />}
          </div>
        </div>

        <div className="hidden shrink-0 flex-col items-end gap-1 text-right sm:flex">
          <Metric label="Thesis Match" value={s.thesisMatch} tone="mint" />
          <Metric label="Founder Fit" value={s.founderFit} />
          <Metric label="Evidence" value={s.evidenceConfidence ?? "—"} isText />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
        <Meta label="Added" value={dateAdded} />
        <Meta label="Last signal" value={lastSignal} />
        <Meta label="Sources" value={s.sourceCount ? String(s.sourceCount) : "—"} />
        <Meta label="Status" value={entry.status === "shortlist" ? "Shortlisted" : "Monitoring"} />
      </div>

      {entry.note && !noteOpen && (
        <div className="mt-3 rounded-lg border border-border/60 bg-elevated/40 p-3 text-xs">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Private note
          </div>
          <div className="mt-1 whitespace-pre-wrap text-foreground/90">{entry.note}</div>
        </div>
      )}

      {noteOpen && (
        <div className="mt-3">
          <textarea
            className="input min-h-[90px] w-full"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Private note — visible only to you."
          />
          <div className="mt-2 flex gap-2">
            <button className="btn-primary" onClick={saveNote}>
              Save note
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                setNoteDraft(entry.note);
                setNoteOpen(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to="/founder/$id"
          params={{ id: s.id }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-elevated/60 px-3 py-1.5 text-xs font-medium hover:border-mint/40"
        >
          View profile <ExternalLink className="h-3 w-3" />
        </Link>
        <button
          onClick={() => {
            setNoteDraft(entry.note);
            setNoteOpen((v) => !v);
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-elevated/60 px-3 py-1.5 text-xs font-medium hover:border-mint/40"
        >
          <PenLine className="h-3 w-3" /> {entry.note ? "Edit note" : "Add note"}
        </button>

        {tab === "shortlist" ? (
          <>
            <button
              onClick={requestIntro}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-elevated/60 px-3 py-1.5 text-xs font-medium hover:border-mint/40"
            >
              <Mail className="h-3 w-3" /> Request intro
            </button>
            <button
              onClick={markContacted}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-elevated/60 px-3 py-1.5 text-xs font-medium hover:border-mint/40"
            >
              <UserCheck className="h-3 w-3" /> Mark contacted
            </button>
            <button
              onClick={move}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber/30 bg-amber/10 px-3 py-1.5 text-xs font-medium text-amber hover:border-amber/50"
            >
              <ArrowLeftRight className="h-3 w-3" /> Move to Monitoring
            </button>
          </>
        ) : (
          <>
            <Link
              to="/investor/discover"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-elevated/60 px-3 py-1.5 text-xs font-medium hover:border-mint/40"
            >
              <Sparkles className="h-3 w-3" /> View new signals
            </Link>
            <button
              onClick={move}
              className="inline-flex items-center gap-1.5 rounded-full border border-mint/40 bg-mint px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              <BookmarkCheck className="h-3 w-3" /> Move to Shortlist
            </button>
          </>
        )}

        <button
          onClick={remove}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-elevated/60 px-3 py-1.5 text-xs text-muted-foreground hover:border-rose-400/40 hover:text-rose-300"
        >
          <Trash2 className="h-3 w-3" />
          {tab === "shortlist" ? "Remove" : "Stop monitoring"}
        </button>
      </div>
    </article>
  );
}

// -----------------------------------------------------------------------------
// Sub components
// -----------------------------------------------------------------------------

function TabButton({
  active,
  onClick,
  tone,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  tone: "mint" | "amber";
  label: string;
  count: number;
}) {
  const activeCls =
    tone === "mint"
      ? "bg-mint text-primary-foreground shadow-[0_0_20px_var(--mint-soft)]"
      : "bg-amber/20 text-amber border border-amber/40";
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition ${
        active ? activeCls : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {tone === "mint" ? (
        <BookmarkCheck className="h-3.5 w-3.5" />
      ) : (
        <Eye className="h-3.5 w-3.5" />
      )}
      <span>{label}</span>
      <span
        className={`tabular rounded-full px-1.5 text-[10px] ${
          active ? "bg-black/20" : "bg-white/5"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function StatusBadge({ status }: { status: PipelineStatus }) {
  if (status === "shortlist") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-mint/40 bg-mint-soft/60 px-2 py-0.5 text-[10px] font-medium text-mint">
        <BookmarkCheck className="h-3 w-3" /> Shortlisted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber/40 bg-amber/10 px-2 py-0.5 text-[10px] font-medium text-amber">
      <Eye className="h-3 w-3" /> Monitoring
    </span>
  );
}

function ContactPill({
  status,
  onChange,
}: {
  status: ContactStatus;
  onChange: (next: ContactStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const options = useMemo(
    () => Object.entries(CONTACT_STATUS_LABELS) as [ContactStatus, string][],
    [],
  );
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-elevated/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
      >
        {CONTACT_STATUS_LABELS[status]}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-border bg-elevated/95 shadow-lg backdrop-blur"
          onMouseLeave={() => setOpen(false)}
        >
          {options.map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                onChange(value);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[11px] hover:bg-white/5"
            >
              <span>{label}</span>
              {value === status && <Check className="h-3 w-3 text-mint" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "mint" | "amber";
  icon: React.ReactNode;
}) {
  const color = tone === "mint" ? "var(--mint)" : "var(--amber)";
  return (
    <div className="rounded-2xl glass p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="mt-1 tabular text-3xl font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function AvgMatchCard({ value, sampleSize }: { value: number | null; sampleSize: number }) {
  return (
    <div className="rounded-2xl glass p-4">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Avg. thesis match
      </div>
      {value === null ? (
        <div className="mt-1">
          <div className="text-sm font-medium text-muted-foreground">Not enough data</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground/80">
            {sampleSize === 0
              ? "Add founders to your pipeline to see an average."
              : "Need at least 2 live founders in your pipeline."}
          </div>
        </div>
      ) : (
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="tabular text-3xl font-semibold text-mint">{value}</span>
          <span className="text-[10px] text-muted-foreground">/ 100</span>
        </div>
      )}
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-border/60 bg-elevated/60 px-2 py-0.5">{label}</span>
  );
}

function Metric({
  label,
  value,
  tone,
  isText,
}: {
  label: string;
  value: number | string | null;
  tone?: "mint";
  isText?: boolean;
}) {
  const has = value !== null && value !== undefined && value !== "";
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span
        className="tabular text-sm font-semibold"
        style={{ color: has && tone === "mint" ? "var(--mint)" : undefined }}
      >
        {has ? (isText ? value : value) : "—"}
      </span>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/80">{label}</div>
      <div className="mt-0.5 text-foreground/90">{value}</div>
    </div>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return <img src={url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />;
  }
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-elevated text-xs font-medium text-mint">
      {initials}
    </div>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  const shortlist = tab === "shortlist";
  return (
    <div className="rounded-2xl border border-dashed border-border bg-elevated/30 p-10 text-center">
      <div
        className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl ${
          shortlist ? "bg-mint-soft text-mint" : "bg-amber/10 text-amber"
        }`}
      >
        {shortlist ? <Bookmark className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </div>
      <h2 className="mt-4 font-display text-xl font-semibold tracking-tight">
        {shortlist ? "No founders shortlisted yet." : "No founders being monitored."}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {shortlist
          ? "Shortlist founders when you are ready to actively evaluate or contact them."
          : "Monitor promising founders to follow future activity and traction signals."}
      </p>
      <Link
        to="/investor/discover"
        className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-mint px-5 py-2 text-sm font-medium text-primary-foreground"
      >
        Discover founders <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
