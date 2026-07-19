import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Calendar, Copy, MapPin, Send, Sparkles } from "lucide-react";
import { AppShell } from "@/components/matchfund/AppShell";
import { grants, type Grant } from "@/data/matchfund";

export const Route = createFileRoute("/_authenticated/founder/grants")({
  head: () => ({ meta: [{ title: "Grants & programs — Match Fund" }] }),
  component: GrantsPage,
});

const TYPES: Grant["type"][] = ["Accelerator", "Grant", "Angel", "Hackathon"];

function GrantsPage() {
  const [type, setType] = useState<Grant["type"] | "All">("All");
  const [selected, setSelected] = useState<Grant | null>(null);

  const filtered = useMemo(
    () => grants.filter((g) => type === "All" || g.type === type).sort((a, b) => b.matchScore - a.matchScore),
    [type],
  );

  return (
    <AppShell>
      <div className="mb-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">Programs</div>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Grants, accelerators & angels</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Non-dilutive and pre-seed capital sources — ranked against your founder profile.
        </p>
      </div>

      <div className="mb-6 flex items-center gap-2 rounded-full glass p-1 w-fit">
        {(["All", ...TYPES] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-full px-3.5 py-1.5 text-xs transition ${
              type === t ? "bg-mint text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {filtered.map((g) => (
          <div
            key={g.id}
            className="group flex flex-col rounded-2xl glass p-5 transition hover:border-mint/40"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="grid h-11 w-11 place-items-center rounded-xl text-sm font-bold text-primary-foreground"
                  style={{ background: g.logoColor }}
                >
                  {g.initials}
                </div>
                <div>
                  <div className="font-medium">{g.name}</div>
                  <div className="text-[11px] text-muted-foreground">{g.type}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold tabular text-mint">{g.matchScore}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Fit</div>
              </div>
            </div>

            <p className="mt-3 text-sm text-foreground/80">{g.description}</p>

            <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
              <div className="rounded-lg border border-border/60 bg-elevated/50 p-2">
                <div className="text-[9px] uppercase text-muted-foreground">Amount</div>
                <div className="mt-0.5 font-medium">{g.amount}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-elevated/50 p-2">
                <div className="text-[9px] uppercase text-muted-foreground">Deadline</div>
                <div className="mt-0.5 font-medium">{g.deadline}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-elevated/50 p-2">
                <div className="text-[9px] uppercase text-muted-foreground">Location</div>
                <div className="mt-0.5 truncate font-medium">{g.location}</div>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-1.5 text-[11px] text-mint">
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="text-foreground/70">{g.matchReason}</span>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setSelected(g)}
                className="flex-1 rounded-lg bg-mint py-2 text-xs font-medium text-primary-foreground"
              >
                Apply
              </button>
              <button className="rounded-lg border border-border bg-elevated px-3 py-2 text-xs">
                Save
              </button>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-xl rounded-2xl glass p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-mint">Apply</div>
                <div className="mt-1 text-lg font-semibold">{selected.name}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground">
                ×
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Deadline {selected.deadline}</span>
              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {selected.location}</span>
            </div>
            <div className="mt-5 rounded-xl border border-border bg-elevated/60 p-4 text-xs">
              <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                Prefilled from your founder profile
              </div>
              <p className="text-foreground/85 leading-relaxed">
                Hi {selected.name} team — I'm a technical founder building at the intersection of AI and applied
                systems. I've shipped multiple hackathon-winning MVPs with active pilot users and I'm seeking capital
                and community for the next 12 months. My work spans deep-tech and product execution — I'd love to be
                considered for {selected.name} on the strength of evidence over pedigree.
              </p>
            </div>
            <div className="mt-5 flex gap-2">
              <button className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-mint py-2 text-xs font-medium text-primary-foreground">
                <Send className="h-3.5 w-3.5" /> Submit application
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-elevated px-3 py-2 text-xs">
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
