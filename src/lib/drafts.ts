import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Server-persisted onboarding drafts with a localStorage fallback for the
// short window before the initial save completes.
//
// - A draft is unfinished work — never treated as a published Founder profile
//   or a committed Investment Thesis. Publishing/committing is a separate step
//   and should delete the draft.
// - Auth users get server truth. Unauthed users (should be blocked by route
//   guards) fall back to localStorage-only.

export type DraftKind = "investor_thesis" | "founder_profile";
export type DraftStatus = "idle" | "loading" | "saving" | "saved" | "error";

const LOCAL_KEY = (k: DraftKind) => `mf.draft.${k}.v1`;

function readLocal<T>(k: DraftKind): { payload: T | null; step: number } {
  if (typeof window === "undefined") return { payload: null, step: 0 };
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY(k));
    if (!raw) return { payload: null, step: 0 };
    const parsed = JSON.parse(raw) as { payload: T; step: number };
    return { payload: parsed.payload ?? null, step: parsed.step ?? 0 };
  } catch {
    return { payload: null, step: 0 };
  }
}

function writeLocal<T>(k: DraftKind, payload: T, step: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_KEY(k), JSON.stringify({ payload, step }));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export function clearLocalDraft(k: DraftKind) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LOCAL_KEY(k));
  } catch {
    // ignore
  }
}

export async function deleteServerDraft(kind: DraftKind) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("onboarding_drafts").delete().eq("user_id", data.user.id).eq("kind", kind);
  clearLocalDraft(kind);
}

/**
 * Draft state hook. Loads server draft on mount, syncs local as a fallback,
 * and auto-saves changes with debounce.
 */
export function useDraft<T extends Record<string, unknown>>(
  kind: DraftKind,
  initial: T,
): {
  payload: T;
  step: number;
  setPayload: (updater: (prev: T) => T) => void;
  setStep: (step: number) => void;
  status: DraftStatus;
  restored: boolean;
} {
  const [payload, setPayloadState] = useState<T>(initial);
  const [step, setStepState] = useState<number>(0);
  const [status, setStatus] = useState<DraftStatus>("loading");
  const [restored, setRestored] = useState(false);
  const initialPayloadRef = useRef(initial);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressSaveRef = useRef(true); // don't save the initial load-back

  // Initial load: server first, fall back to local
  useEffect(() => {
    let alive = true;
    (async () => {
      const local = readLocal<T>(kind);
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!alive) return;

      if (!user) {
        if (local.payload) {
          setPayloadState({ ...initialPayloadRef.current, ...local.payload });
          setStepState(local.step);
          setRestored(true);
        }
        setStatus("idle");
        // allow autosave now (local only)
        setTimeout(() => (suppressSaveRef.current = false), 0);
        return;
      }

      const { data, error } = await supabase
        .from("onboarding_drafts")
        .select("payload,current_step")
        .eq("user_id", user.id)
        .eq("kind", kind)
        .maybeSingle();

      if (!alive) return;
      if (error) {
        setStatus("error");
      } else if (data) {
        const serverPayload = (data.payload ?? {}) as Partial<T>;
        setPayloadState({ ...initialPayloadRef.current, ...serverPayload });
        setStepState(data.current_step ?? 0);
        setRestored(true);
        setStatus("idle");
      } else if (local.payload) {
        // Seed server from any pre-auth local scratch
        setPayloadState({ ...initialPayloadRef.current, ...local.payload });
        setStepState(local.step);
        setRestored(true);
        setStatus("idle");
      } else {
        setStatus("idle");
      }
      setTimeout(() => (suppressSaveRef.current = false), 0);
    })();
    return () => {
      alive = false;
    };
  }, [kind]);

  // Debounced autosave
  useEffect(() => {
    if (suppressSaveRef.current) return;
    writeLocal(kind, payload, step);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setStatus("saving");
    saveTimer.current = setTimeout(async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        // local-only fallback for unauthed users
        setStatus("saved");
        return;
      }
      const { error } = await supabase.from("onboarding_drafts").upsert(
        {
          user_id: data.user.id,
          kind,
          payload: payload as never,
          current_step: step,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,kind" },
      );
      setStatus(error ? "error" : "saved");
    }, 450);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [kind, payload, step]);

  const api = useMemo(
    () => ({
      payload,
      step,
      setPayload: (updater: (prev: T) => T) => setPayloadState((p) => updater(p)),
      setStep: (s: number) => setStepState(s),
      status,
      restored,
    }),
    [payload, step, status, restored],
  );
  return api;
}
