import { createFileRoute } from "@tanstack/react-router";
import { User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/founder/profile")({
  head: () => ({ meta: [{ title: "My profile — MatchFund" }] }),
  component: FounderProfilePlaceholder,
});

function FounderProfilePlaceholder() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
          Founder
        </div>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">My profile</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Edit your public profile, projects, and pitch materials.
        </p>
      </div>
      <div className="rounded-2xl glass p-8 text-sm text-muted-foreground">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-mint-soft px-3 py-1 text-xs text-mint">
          <User className="h-3.5 w-3.5" /> Coming next
        </div>
        <p>
          The full founder profile editor — including bio, projects, hackathon evidence,
          pitch deck upload, and claim verification for crawler-discovered profiles — is on
          the roadmap.
        </p>
      </div>
    </div>
  );
}
