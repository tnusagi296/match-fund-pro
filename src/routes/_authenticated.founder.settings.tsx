import { createFileRoute } from "@tanstack/react-router";
import { Settings as SettingsIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/founder/settings")({
  head: () => ({ meta: [{ title: "Settings — MatchFund" }] }),
  component: FounderSettingsPlaceholder,
});

function FounderSettingsPlaceholder() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
          Founder
        </div>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Manage your account, visibility, and notifications.
        </p>
      </div>
      <div className="rounded-2xl glass p-8 text-sm text-muted-foreground">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-mint-soft px-3 py-1 text-xs text-mint">
          <SettingsIcon className="h-3.5 w-3.5" /> Coming next
        </div>
        <p>
          Founder-specific settings, visibility controls, and contact preferences ship
          with the founder editor.
        </p>
      </div>
    </div>
  );
}
