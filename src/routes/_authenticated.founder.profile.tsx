import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { AppShell } from "@/components/matchfund/AppShell";
import { FounderProfileWorkspace } from "@/components/matchfund/FounderProfileWorkspace";
import { crawlFounderGraph, publishFounderProfile } from "@/lib/crawl.functions";
import { deleteServerDraft, useDraft } from "@/lib/drafts";
import { EMPTY_FOUNDER_PROFILE, type FounderProfile } from "@/lib/founder-profile";

export const Route = createFileRoute("/_authenticated/founder/profile")({
  head: () => ({ meta: [{ title: "My profile — MatchFund" }] }),
  component: FounderProfilePage,
});

function FounderProfilePage() {
  const draft = useDraft<FounderProfile>("founder_profile", EMPTY_FOUNDER_PROFILE);
  const crawlFn = useServerFn(crawlFounderGraph);
  const publishFn = useServerFn(publishFounderProfile);
  const [publishState, setPublishState] = useState<
    "idle" | "publishing" | "published" | "error"
  >("idle");
  const [lastPublishedProfileId, setLastPublishedProfileId] = useState<string | null>(null);

  // Reset "published" toast after a while so re-edits show it again.
  useEffect(() => {
    if (publishState !== "published") return;
    const t = setTimeout(() => setPublishState("idle"), 6000);
    return () => clearTimeout(t);
  }, [publishState]);

  async function publish() {
    setPublishState("publishing");
    try {
      // The publish server function needs a profileId owned by the founder.
      // In the current backend contract, this id is created by the crawl.
      // If we don't have one yet, run a crawl to establish it — but never
      // block the founder from publishing if the crawl endpoint is down.
      let profileId = lastPublishedProfileId;
      if (!profileId) {
        try {
          const res = (await crawlFn({
            data: {
              name: draft.payload.name,
              headline: draft.payload.headline,
              github: draft.payload.github,
              linkedin: draft.payload.linkedin,
              site: draft.payload.site,
              deckText: draft.payload.deckText,
            },
          } as { data: unknown })) as { profileId?: string } | null;
          if (res && typeof res.profileId === "string") profileId = res.profileId;
        } catch {
          // ignore — publish will simply mark local state
        }
      }
      if (profileId) {
        await publishFn({ data: { profileId } });
        setLastPublishedProfileId(profileId);
        await deleteServerDraft("founder_profile");
      }
      draft.setPayload((p) => ({
        ...p,
        published: true,
        lastUpdatedAt: new Date().toISOString(),
      }));
      setPublishState("published");
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("[founder-profile] publish failed", error);
      setPublishState("error");
    }
  }

  return (
    <AppShell>
      <FounderProfileWorkspace
        profile={draft.payload}
        onChange={(updater) => draft.setPayload(updater)}
        onPublish={publish}
        publishState={publishState}
        saveStatus={<SaveStatus status={draft.status} restored={draft.restored} />}
        invokeCrawl={(args) => crawlFn(args as { data: unknown })}
        previewHref="/founder/preview"
      />
    </AppShell>
  );
}

function SaveStatus({
  status,
  restored,
}: {
  status: ReturnType<typeof useDraft>["status"];
  restored: boolean;
}) {
  if (status === "saving")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  if (status === "saved")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-mint">
        <CheckCircle2 className="h-3 w-3" /> Saved
      </span>
    );
  if (status === "error")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-400">
        <AlertTriangle className="h-3 w-3" /> Draft not synced
      </span>
    );
  if (restored)
    return (
      <span className="text-xs text-muted-foreground">Draft restored</span>
    );
  return null;
}
