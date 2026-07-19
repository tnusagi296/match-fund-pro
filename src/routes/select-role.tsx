import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/select-role")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { next: "/select-role" } });
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("account_role")
      .eq("user_id", data.user.id)
      .maybeSingle();
    if (profile?.account_role === "investor")
      throw redirect({ to: "/investor/discover" });
    if (profile?.account_role === "founder")
      throw redirect({ to: "/founder/profile" });
    if (profile?.account_role === "admin") throw redirect({ to: "/admin" });
  },
  component: SelectRolePage,
});

function SelectRolePage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState<"investor" | "founder" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ensure a user_profiles row exists in case the signup trigger didn't fire.
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      await supabase
        .from("user_profiles")
        .upsert(
          { user_id: data.user.id, email: data.user.email ?? null },
          { onConflict: "user_id" },
        );
    });
  }, []);

  async function pick(role: "investor" | "founder") {
    setSaving(role);
    setError(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error: err } = await supabase
        .from("user_profiles")
        .update({ account_role: role })
        .eq("user_id", u.user.id);
      if (err) throw err;
      navigate({ to: role === "investor" ? "/investor/discover" : "/founder/profile" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">
          Welcome to MatchFund
        </div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
          How will you use MatchFund?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a role to continue. You can request a role change later.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => pick("investor")}
          disabled={saving !== null}
          className="rounded-2xl glass p-6 text-left transition hover:bg-white/[0.06] disabled:opacity-60"
        >
          <Building2 className="h-6 w-6 text-mint" />
          <div className="mt-4 text-lg font-semibold">I'm an investor</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Discover founders matched to your investment thesis and build a pipeline.
          </p>
          {saving === "investor" && (
            <div className="mt-3 text-xs text-mint">Setting up…</div>
          )}
        </button>
        <button
          onClick={() => pick("founder")}
          disabled={saving !== null}
          className="rounded-2xl glass p-6 text-left transition hover:bg-white/[0.06] disabled:opacity-60"
        >
          <User className="h-6 w-6 text-mint" />
          <div className="mt-4 text-lg font-semibold">I'm a founder</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Build your public profile, apply for grants, and preview how investors see you.
          </p>
          {saving === "founder" && (
            <div className="mt-3 text-xs text-mint">Setting up…</div>
          )}
        </button>
      </div>
      {error && <p className="mt-4 text-center text-sm text-red-400">{error}</p>}
    </main>
  );
}
