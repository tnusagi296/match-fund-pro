import { createFileRoute, Link } from "@tanstack/react-router";
import { Edit3 } from "lucide-react";
import { FounderInvestorView } from "@/components/matchfund/FounderInvestorView";
import { useDemoFounderProfile } from "@/lib/demo-founder";

export const Route = createFileRoute("/demo/founder/preview")({
  head: () => ({ meta: [{ title: "Demo — How Investors See Me — MatchFund" }] }),
  component: DemoFounderPreview,
});

function DemoFounderPreview() {
  const { profile } = useDemoFounderProfile();
  return (
    <div className="relative min-h-screen bg-aurora text-foreground">
      <div className="sticky top-0 z-40 border-b border-amber-400/30 bg-amber-500/10 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-[1400px] items-center justify-between gap-4 px-6 text-xs">
          <div className="flex items-center gap-2 text-amber-200">
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-medium uppercase tracking-[0.15em]">
              Demo mode
            </span>
            <span>Isolated preview using synthesized founder data.</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/demo/founder/profile"
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-foreground hover:bg-white/10"
            >
              <Edit3 className="h-3 w-3" /> Edit demo profile
            </Link>
            <Link to="/demo" className="text-muted-foreground hover:text-foreground">
              Exit
            </Link>
          </div>
        </div>
      </div>
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-8">
        <div className="mb-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
            Founder
          </div>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
            How Investors See Me
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            This is how your public profile appears to investors.
          </p>
        </div>
        <FounderInvestorView profile={profile} />
      </main>
    </div>
  );
}
