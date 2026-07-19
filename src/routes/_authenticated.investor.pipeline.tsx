import { AppShell } from "@/components/matchfund/AppShell";
import { createFileRoute } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";

export const Route = createFileRoute("/_authenticated/investor/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline — MatchFund" }] }),
  component: PipelinePlaceholder,
});

function PipelinePlaceholder() {
  return (
    <AppShell><div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
          Pipeline
        </div>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
          Your pipeline
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Monitoring, Shortlisted, and Passed founders will live here.
        </p>
      </div>
      <div className="rounded-2xl glass p-8 text-sm text-muted-foreground">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-mint-soft px-3 py-1 text-xs text-mint">
          <Bookmark className="h-3.5 w-3.5" /> Coming next
        </div>
        <p>
          Monitoring and Shortlisted tabs backed by <code>investor_founder_actions</code>{" "}
          are on the roadmap. Your current shortlist decisions still live in this browser
          and remain visible on Discover.
        </p>
      </div>
    </div></AppShell>
  );
}
