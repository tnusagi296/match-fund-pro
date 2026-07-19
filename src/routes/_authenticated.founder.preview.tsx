import { createFileRoute } from "@tanstack/react-router";
import { Eye } from "lucide-react";

export const Route = createFileRoute("/_authenticated/founder/preview")({
  head: () => ({ meta: [{ title: "How investors see me — MatchFund" }] }),
  component: FounderPreviewPlaceholder,
});

function FounderPreviewPlaceholder() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
          Founder
        </div>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
          How investors see me
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Preview your public profile as it appears in the investor Discover feed.
        </p>
      </div>
      <div className="rounded-2xl glass p-8 text-sm text-muted-foreground">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-mint-soft px-3 py-1 text-xs text-mint">
          <Eye className="h-3.5 w-3.5" /> Coming next
        </div>
        <p>
          Preview mode renders the same public card investors see — with investment-thesis
          fit scoring hidden. Wire-in ships alongside the founder editor.
        </p>
      </div>
    </div>
  );
}
