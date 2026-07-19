import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { FounderProfileWorkspace } from "@/components/matchfund/FounderProfileWorkspace";
import { useDemoFounderProfile } from "@/lib/demo-founder";

export const Route = createFileRoute("/demo/founder/profile")({
  head: () => ({ meta: [{ title: "Demo — Founder profile — MatchFund" }] }),
  component: DemoFounderProfilePage,
});

function DemoFounderProfilePage() {
  const { profile, setProfile, reset } = useDemoFounderProfile();
  const [publishState, setPublishState] = useState<
    "idle" | "publishing" | "published" | "error"
  >("idle");

  async function publish() {
    setPublishState("publishing");
    await new Promise((r) => setTimeout(r, 700));
    setProfile((p) => ({ ...p, published: true, lastUpdatedAt: new Date().toISOString() }));
    setPublishState("published");
    setTimeout(() => setPublishState("idle"), 5000);
  }

  return (
    <div className="relative min-h-screen bg-aurora text-foreground">
      <DemoBanner onReset={reset} />
      <main className="mx-auto max-w-[1400px] px-6 pb-24 pt-8">
        <FounderProfileWorkspace
          profile={profile}
          onChange={(updater) => setProfile(updater)}
          onPublish={publish}
          publishState={publishState}
          publishMessage="Demo profile published — investors would now see this."
          demoMode
          previewHref="/demo/founder/preview"
        />
      </main>
    </div>
  );
}

function DemoBanner({ onReset }: { onReset: () => void }) {
  return (
    <div className="sticky top-0 z-40 border-b border-amber-400/30 bg-amber-500/10 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-[1400px] items-center justify-between gap-4 px-6 text-xs">
        <div className="flex items-center gap-2 text-amber-200">
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-medium uppercase tracking-[0.15em]">
            Demo mode
          </span>
          <span>Isolated demo — no production data is written.</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/demo/founder/preview"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-foreground hover:bg-white/10"
          >
            Preview investor view
          </Link>
          <Link
            to="/demo/founder/claim"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-foreground hover:bg-white/10"
          >
            Claim flow
          </Link>
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" /> Reset demo
          </button>
          <Link to="/demo" className="text-muted-foreground hover:text-foreground">
            Exit
          </Link>
        </div>
      </div>
    </div>
  );
}
