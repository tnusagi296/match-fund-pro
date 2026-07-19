import { createFileRoute, Link } from "@tanstack/react-router";
import { Info, PlusCircle, Search } from "lucide-react";
import { AppShell } from "@/components/matchfund/AppShell";

export const Route = createFileRoute("/_authenticated/founder/claim")({
  head: () => ({ meta: [{ title: "Claim your profile — MatchFund" }] }),
  component: FounderClaim,
});

// Production route: claim submission is owned by the CTO's backend and is
// not yet wired. We do NOT pretend a submission occurred. The demo variant
// at /demo/founder/claim exercises the full visual flow.
function FounderClaim() {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
            Founder onboarding
          </div>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
            Claim your founder profile
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            You can either claim an existing profile our crawler already discovered, or start a
            fresh one.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl glass p-6">
            <Search className="h-5 w-5 text-mint" />
            <h2 className="mt-3 font-display text-lg font-medium">Find & claim my profile</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Search by name, GitHub, company, or website.
            </p>
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-muted-foreground">
              <Info className="mr-1.5 inline h-3.5 w-3.5" />
              Profile claiming is being connected. You can preview the full flow in the demo.
            </div>
            <Link to="/demo/founder/claim" className="btn-ghost mt-3 inline-flex">
              Preview claim flow
            </Link>
          </div>

          <div className="rounded-2xl glass p-6">
            <PlusCircle className="h-5 w-5 text-mint" />
            <h2 className="mt-3 font-display text-lg font-medium">Create a new profile</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Start fresh — you'll fill in your basics and run a signal crawl to auto-populate
              projects.
            </p>
            <Link to="/founder/profile" className="btn-primary mt-3 inline-flex">
              Go to My profile
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-muted-foreground">
          Profile claiming is being connected. You can continue building your profile in the
          meantime — publishing will pick up your claim once it lands.
        </div>
      </div>
    </AppShell>
  );
}
