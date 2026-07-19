import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : "",
  }),
  component: AuthPage,
});

function isSafeRelative(next: string): boolean {
  return next.startsWith("/") && !next.startsWith("//");
}

function AuthPage() {
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<"investor" | "founder">("investor");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function go() {
    const target = next && isSafeRelative(next) ? next : "/";
    window.location.href = target;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        go();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { account_role: role, full_name: fullName },
          },
        });
        if (error) throw error;
        setMsg("Check your email to confirm, then sign in.");
        setMode("signin");
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setMsg(null);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setMsg(result.error.message ?? "Google sign-in failed");
        return;
      }
      if (result.redirected) return;
      go();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Google sign-in failed");
    }
  }

  return (
    <main className="relative min-h-screen bg-aurora">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <div className="glass rounded-2xl p-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Sign in to MatchFund" : "Create your MatchFund account"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Investors, founders, and admins use the same sign-in."
              : "Pick how you'll use MatchFund. You can request a change later."}
          </p>

          <button
            type="button"
            onClick={google}
            className="mt-6 w-full rounded-md border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/5"
          >
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-white/10" />
            or
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {(["investor", "founder"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`rounded-md px-3 py-2 text-sm font-medium capitalize ring-1 transition ${
                        role === r
                          ? "bg-mint-soft text-mint ring-mint/40"
                          : "bg-white/5 text-muted-foreground ring-white/10 hover:text-foreground"
                      }`}
                    >
                      I'm an {r}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-md bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-primary"
                />
              </>
            )}
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-primary"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md bg-white/5 px-3 py-2 text-sm outline-none ring-1 ring-white/10 focus:ring-primary"
            />
            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "signin"
              ? "Need an account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: "/demo" })}
          className="mt-4 text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Explore the demo without signing in →
        </button>
      </div>
    </main>
  );
}
