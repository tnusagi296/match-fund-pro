// -----------------------------------------------------------------------------
// pipelineService — Phase 3 frontend-only adapter
//
// Frontend adapter for the investor Pipeline (Shortlisted + Monitoring).
// Persistence is deliberately isolated to localStorage during this demo pass
// so we can iterate on UX without touching the frozen backend contract.
//
// TODO(CTO): Replace localStorage persistence with a proper backend contract.
// Suggested shape:
//   POST   /api/investor/pipeline           { founderId, status, note?, contactStatus? }
//   PATCH  /api/investor/pipeline/:founderId { status? note? contactStatus? }
//   DELETE /api/investor/pipeline/:founderId
//   GET    /api/investor/pipeline           -> PipelineEntry[]
// Table sketch: investor_pipeline_entries (
//   id uuid pk,
//   investor_user_id uuid references auth.users(id),
//   founder_id text,
//   status text check (status in ('shortlist','monitor')),
//   contact_status text,
//   note text,
//   snapshot jsonb,
//   added_at timestamptz,
//   last_moved_at timestamptz,
//   unique (investor_user_id, founder_id)
// )
// Row-level security: investor sees only their own rows.
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PipelineStatus = "shortlist" | "monitor";

export type ContactStatus =
  | "not_contacted"
  | "researching"
  | "contact_planned"
  | "contacted"
  | "meeting_scheduled";

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  not_contacted: "Not contacted",
  researching: "Researching",
  contact_planned: "Contact planned",
  contacted: "Contacted",
  meeting_scheduled: "Meeting scheduled",
};

export type FounderSnapshot = {
  id: string;
  name: string;
  headline: string;
  avatarUrl: string | null;
  sector: string | null;
  location: string | null;
  stage: string | null;
  thesisMatch: number | null;
  founderFit: number | null;
  evidenceConfidence: string | null;
  verified: boolean;
  dataMode: "live" | "demo";
  sourceCount: number;
  lastSignalAt: string | null;
  matchReason: string | null;
};

export type PipelineEntry = {
  founderId: string;
  status: PipelineStatus;
  contactStatus: ContactStatus;
  note: string;
  addedAt: string; // ISO
  lastMovedAt: string; // ISO
  snapshot: FounderSnapshot;
};

const STORAGE_PREFIX = "mf.pipeline.v1";
const CHANGE_EVENT = "mf:pipeline:changed";

function storageKey(userKey: string): string {
  return `${STORAGE_PREFIX}:${userKey}`;
}

function safeRead(key: string): PipelineEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PipelineEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function safeWrite(key: string, entries: PipelineEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key } }));
  } catch {
    // storage may be blocked; keep UI reactive via returned state
  }
}

// -----------------------------------------------------------------------------
// Core service (pure over a userKey — the hook owns the userKey lifecycle).
// -----------------------------------------------------------------------------
export const pipelineService = {
  list(userKey: string): PipelineEntry[] {
    return safeRead(storageKey(userKey));
  },

  get(userKey: string, founderId: string): PipelineEntry | null {
    return this.list(userKey).find((e) => e.founderId === founderId) ?? null;
  },

  /** Add or move a founder to a status. Preserves note + contactStatus if already present. */
  upsert(
    userKey: string,
    status: PipelineStatus,
    snapshot: FounderSnapshot,
  ): { entry: PipelineEntry; previous: PipelineEntry | null } {
    const key = storageKey(userKey);
    const entries = safeRead(key);
    const existing = entries.find((e) => e.founderId === snapshot.id) ?? null;
    const now = new Date().toISOString();
    const entry: PipelineEntry = {
      founderId: snapshot.id,
      status,
      contactStatus: existing?.contactStatus ?? "not_contacted",
      note: existing?.note ?? "",
      addedAt: existing?.addedAt ?? now,
      lastMovedAt: now,
      snapshot: { ...snapshot },
    };
    const next = [entry, ...entries.filter((e) => e.founderId !== snapshot.id)];
    safeWrite(key, next);
    return { entry, previous: existing };
  },

  /** Remove founder from pipeline. Returns the removed entry for Undo. */
  remove(userKey: string, founderId: string): PipelineEntry | null {
    const key = storageKey(userKey);
    const entries = safeRead(key);
    const removed = entries.find((e) => e.founderId === founderId) ?? null;
    if (!removed) return null;
    safeWrite(
      key,
      entries.filter((e) => e.founderId !== founderId),
    );
    return removed;
  },

  /** Restore a previously removed entry (Undo). */
  restore(userKey: string, entry: PipelineEntry) {
    const key = storageKey(userKey);
    const entries = safeRead(key);
    if (entries.some((e) => e.founderId === entry.founderId)) return;
    safeWrite(key, [entry, ...entries]);
  },

  updateNote(userKey: string, founderId: string, note: string) {
    const key = storageKey(userKey);
    const entries = safeRead(key);
    safeWrite(
      key,
      entries.map((e) => (e.founderId === founderId ? { ...e, note } : e)),
    );
  },

  updateContact(userKey: string, founderId: string, contactStatus: ContactStatus) {
    const key = storageKey(userKey);
    const entries = safeRead(key);
    safeWrite(
      key,
      entries.map((e) => (e.founderId === founderId ? { ...e, contactStatus } : e)),
    );
  },
};

// -----------------------------------------------------------------------------
// React hooks
// -----------------------------------------------------------------------------

/**
 * Resolve the current investor's namespace key. Uses the authenticated user id
 * when available. Falls back to `demo:<sessionId>` for /demo/* routes.
 */
export function useInvestorKey(demo = false): string | null {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    if (demo) {
      setUid("demo");
      return;
    }
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setUid(data.user?.id ?? "anon");
    });
    return () => {
      alive = false;
    };
  }, [demo]);
  return uid;
}

/** Subscribe to pipeline changes for the given user key, across tabs and in-page. */
export function usePipeline(userKey: string | null) {
  const [entries, setEntries] = useState<PipelineEntry[]>([]);

  useEffect(() => {
    if (!userKey) {
      setEntries([]);
      return;
    }
    const key = storageKey(userKey);
    setEntries(safeRead(key));

    const onLocal = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail;
      if (detail?.key === key) setEntries(safeRead(key));
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setEntries(safeRead(key));
    };
    window.addEventListener(CHANGE_EVENT, onLocal as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onLocal as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [userKey]);

  return useMemo(() => {
    const shortlisted = entries.filter((e) => e.status === "shortlist");
    const monitoring = entries.filter((e) => e.status === "monitor");
    const withThesis = entries.filter(
      (e) => typeof e.snapshot.thesisMatch === "number" && e.snapshot.dataMode !== "demo",
    );
    const avgThesisMatch =
      withThesis.length >= 2
        ? Math.round(
            withThesis.reduce((acc, e) => acc + (e.snapshot.thesisMatch as number), 0) /
              withThesis.length,
          )
        : null;
    return { entries, shortlisted, monitoring, avgThesisMatch };
  }, [entries]);
}
