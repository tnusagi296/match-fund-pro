import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, User, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/demo")({
  head: () => ({ meta: [{ title: "Demo — MatchFund" }] }),
  component: DemoSwitcher,
});

// The ONLY place in the product where a role switcher is exposed. It jumps
// to a role's home so the entire mounted UI, navigation, and route change with it.
function DemoSwitcher() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
          Demo mode
        </div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
          Preview MatchFund
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Isolated preview only. Real users sign in and are routed by their account role.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          to="/investor/discover"
          className="rounded-2xl glass p-5 transition hover:bg-white/[0.06]"
        >
          <Building2 className="h-5 w-5 text-mint" />
          <div className="mt-3 text-sm font-medium">Investor view</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Discover, Pipeline, Settings.
          </div>
        </Link>
        <Link
          to="/demo/founder/profile"
          className="rounded-2xl glass p-5 transition hover:bg-white/[0.06]"
        >
          <User className="h-5 w-5 text-mint" />
          <div className="mt-3 text-sm font-medium">Founder view</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Profile, Preview, Claim flow.
          </div>
        </Link>
        <Link
          to="/admin"
          className="rounded-2xl glass p-5 transition hover:bg-white/[0.06]"
        >
          <ShieldCheck className="h-5 w-5 text-mint" />
          <div className="mt-3 text-sm font-medium">Admin view</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Crawler + operator tools.
          </div>
        </Link>
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        You'll still hit role guards unless your account role matches.
      </p>
    </main>
  );
}
