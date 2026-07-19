import { createFileRoute, Link } from "@tanstack/react-router";
import { Radar, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — MatchFund" }] }),
  component: AdminHome,
});

function AdminHome() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
          Admin
        </div>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
          Admin console
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Operator-only tools. Not visible to investors or founders.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/admin/discover"
          className="rounded-2xl glass p-5 hover:bg-white/[0.06] transition"
        >
          <Radar className="h-5 w-5 text-mint" />
          <div className="mt-3 text-sm font-medium">Crawler</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Plan and run public-source founder discovery.
          </div>
        </Link>
        <div className="rounded-2xl glass p-5 opacity-70">
          <ShieldCheck className="h-5 w-5 text-mint" />
          <div className="mt-3 text-sm font-medium">Claim review</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Review founder claim requests. Coming soon.
          </div>
        </div>
      </div>
    </div>
  );
}
