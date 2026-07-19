import { createFileRoute, Link } from "@tanstack/react-router";
import { Edit3 } from "lucide-react";
import { AppShell } from "@/components/matchfund/AppShell";
import { FounderInvestorView } from "@/components/matchfund/FounderInvestorView";
import { useDraft } from "@/lib/drafts";
import {
  EMPTY_FOUNDER_PROFILE,
  computeCompletion,
  type FounderProfile,
} from "@/lib/founder-profile";

export const Route = createFileRoute("/_authenticated/founder/preview")({
  head: () => ({ meta: [{ title: "How Investors See Me — MatchFund" }] }),
  component: FounderPreview,
});

function FounderPreview() {
  const draft = useDraft<FounderProfile>("founder_profile", EMPTY_FOUNDER_PROFILE);
  const { percent } = computeCompletion(draft.payload);
  const hasProfile = percent > 0 && draft.payload.name.trim().length > 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
              Founder
            </div>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
              How Investors See Me
            </h1>
          </div>
          <Link to="/founder/profile" className="btn-ghost">
            <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Edit profile
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
          This is how your public profile appears to investors. Investment thesis, discover feed,
          and private investor notes are never shown here.
        </div>

        {hasProfile ? (
          <FounderInvestorView profile={draft.payload} />
        ) : (
          <div className="rounded-2xl glass p-10 text-center">
            <h2 className="font-display text-xl font-medium">
              Complete your profile to preview how investors will see you.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Add your name, headline, and public links to unlock the preview.
            </p>
            <Link to="/founder/profile" className="btn-primary mt-6 inline-flex">
              Go to My profile
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}
