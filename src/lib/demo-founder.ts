// Isolated demo state for /demo/founder/*. Backed by sessionStorage so it
// never leaks into production Supabase tables and clears when the tab
// closes. NEVER used outside /demo.

import { useEffect, useState } from "react";
import { DEMO_FOUNDER_PROFILE, type FounderProfile } from "@/lib/founder-profile";

const KEY = "mf.demo.founder.v1";

export function useDemoFounderProfile(): {
  profile: FounderProfile;
  setProfile: (updater: (prev: FounderProfile) => FounderProfile) => void;
  reset: () => void;
} {
  const [profile, setProfileState] = useState<FounderProfile>(DEMO_FOUNDER_PROFILE);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as FounderProfile;
        setProfileState({ ...DEMO_FOUNDER_PROFILE, ...parsed });
      }
    } catch {
      // ignore
    }
  }, []);

  function setProfile(updater: (prev: FounderProfile) => FounderProfile) {
    setProfileState((p) => {
      const next = updater(p);
      try {
        window.sessionStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }
  function reset() {
    setProfileState(DEMO_FOUNDER_PROFILE);
    try {
      window.sessionStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  }
  return { profile, setProfile, reset };
}

export type DemoClaimStage =
  | "search"
  | "matches"
  | "verify"
  | "submitted"
  | "verified";
