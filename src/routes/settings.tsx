import { createFileRoute, Link } from "@tanstack/react-router";
import { Pencil, ShieldCheck, User, Target } from "lucide-react";
import { AppShell } from "@/components/matchfund/AppShell";
import { useThesis, STAGE_OPTIONS } from "@/lib/thesis";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — MatchFund" }] }),
  component: SettingsPage,
});

function formatList(values: string[] | undefined, empty = "Not set"): string {
  if (!values || values.length === 0) return empty;
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;
}

function stageLabels(stages: string[]): string[] {
  return stages.map((s) => STAGE_OPTIONS.find((o) => o.value === s)?.label ?? s);
}

function SettingsPage() {
  const [thesis, , hydrated] = useThesis();

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
            Account
          </div>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Manage your investment thesis, account, and data preferences.
          </p>
        </div>

        {/* Investment Thesis */}
        <section className="mb-6 rounded-2xl glass p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border border-mint/30 bg-mint-soft">
                <Target className="h-4 w-4 text-mint" strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  Investment Thesis
                </h2>
                <p className="text-xs text-muted-foreground">
                  Drives which founders MatchFund surfaces in Discover.
                </p>
              </div>
            </div>
            <Link
              to="/onboard"
              search={{ return: "settings" }}
              className="inline-flex items-center gap-1.5 rounded-full bg-mint px-4 py-2 text-xs font-medium text-primary-foreground"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit thesis
            </Link>
          </div>

          {!hydrated ? (
            <div className="mt-5 text-sm text-muted-foreground">Loading…</div>
          ) : !thesis ? (
            <div className="mt-5 rounded-xl border border-dashed border-border bg-elevated/40 p-5 text-sm">
              <div className="font-medium">No thesis set yet</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Set up your investment thesis to unlock personalized founder discovery.
              </p>
              <Link
                to="/onboard"
                search={{ return: "settings" }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-mint px-4 py-2 text-xs font-medium text-primary-foreground"
              >
                Set up investment thesis
              </Link>
            </div>
          ) : (
            <dl className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <ThesisRow label="Stages" value={formatList(stageLabels(thesis.stages))} />
              <ThesisRow label="Sectors" value={formatList(thesis.sectors)} />
              <ThesisRow
                label="Geography"
                value={formatList(thesis.geos, "Global")}
              />
              <ThesisRow
                label="Preferred founder signals"
                value={preferredSignals(thesis.weights)}
              />
              <ThesisRow
                label="Initial check size"
                value={`$${thesis.checkMin}k – $${thesis.checkMax}k`}
              />
              <ThesisRow
                label="Morning shortlist email"
                value={thesis.digestEmail ? "On" : "Off"}
              />
            </dl>
          )}
        </section>

        {/* Account */}
        <section className="mb-6 rounded-2xl glass p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-elevated/60">
              <User className="h-4 w-4 text-foreground" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">Account</h2>
              <p className="text-xs text-muted-foreground">
                Your profile as it appears to founders you contact.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" placeholder="Alex Rivera" />
            <Field label="Email" placeholder="alex@fund.vc" type="email" />
            <Field label="Investor or fund name" placeholder="Northline Ventures" />
            <Field label="Role" placeholder="Partner" />
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Account sync is coming soon — changes are saved locally for now.
          </p>
        </section>

        {/* Data and Privacy */}
        <section className="rounded-2xl glass p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-elevated/60">
              <ShieldCheck className="h-4 w-4 text-foreground" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Data and Privacy
              </h2>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            MatchFund uses publicly available professional and project data to identify relevant
            builder and founder signals. Recommendations are discovery signals and should not be
            interpreted as investment advice.
          </p>
        </section>
      </div>
    </AppShell>
  );
}

function preferredSignals(w: { technical: number; traction: number; fmf: number }): string {
  const entries: [string, number][] = [
    ["Technical depth", w.technical],
    ["Traction & velocity", w.traction],
    ["Founder-market fit", w.fmf],
  ];
  const sorted = entries.sort((a, b) => b[1] - a[1]).map(([k]) => k);
  return formatList(sorted);
}

function ThesisRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-elevated/40 p-4">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1.5 text-sm text-foreground">{value}</div>
    </div>
  );
}

function Field({
  label,
  placeholder,
  type = "text",
}: {
  label: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border/60 bg-elevated/40 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-mint/50"
      />
    </label>
  );
}
