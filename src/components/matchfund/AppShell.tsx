import { Link, useRouter, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, Search, Target } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type NavItem = { to: string; label: string };
type Role = "investor" | "founder" | "admin";

const NAV_INVESTOR: NavItem[] = [
  { to: "/investor/discover", label: "Discover" },
  { to: "/investor/pipeline", label: "Pipeline" },
  { to: "/investor/settings", label: "Settings" },
];
const NAV_FOUNDER: NavItem[] = [
  { to: "/founder/profile", label: "My Profile" },
  { to: "/founder/grants", label: "Grants" },
  { to: "/founder/preview", label: "How Investors See Me" },
  { to: "/founder/settings", label: "Settings" },
];
const NAV_ADMIN: NavItem[] = [
  { to: "/admin", label: "Home" },
  { to: "/admin/discover", label: "Crawler" },
];

function navForPath(pathname: string): {
  nav: NavItem[];
  searchHint: string;
  home: string;
  role: Role;
} {
  if (pathname.startsWith("/founder"))
    return {
      nav: NAV_FOUNDER,
      searchHint: "Search grants & programs",
      home: "/founder/profile",
      role: "founder",
    };
  if (pathname.startsWith("/admin"))
    return {
      nav: NAV_ADMIN,
      searchHint: "Search operators",
      home: "/admin",
      role: "admin",
    };
  return {
    nav: NAV_INVESTOR,
    searchHint: "Search founders, companies, keywords",
    home: "/investor/discover",
    role: "investor",
  };
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = router.state.location.pathname;
  const { nav, searchHint, home, role: pathRole } = useMemo(
    () => navForPath(pathname),
    [pathname],
  );

  // Load the actual stored role from user_profiles so the account chip reflects
  // reality (not just the current path). Falls back to path-derived role for
  // demo mode and while loading.
  const [storedRole, setStoredRole] = useState<Role | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!alive || !data.user) return;
      setAccountEmail(data.user.email ?? null);
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("account_role")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (alive) setStoredRole((profile?.account_role ?? null) as Role | null);
    });
    return () => {
      alive = false;
    };
  }, []);
  const displayRole: Role = storedRole ?? pathRole;

  async function signOut() {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
    } finally {
      // Clear any role-specific browser state
      try {
        localStorage.removeItem("mf.role");
        localStorage.removeItem("mf.decisions");
        localStorage.removeItem("matchfund:watchlist");
      } catch {
        // ignore
      }
      navigate({ to: "/auth", replace: true });
    }
  }

  return (
    <div className="relative min-h-screen text-foreground bg-aurora">
      <header className="sticky top-0 z-40 glass-bar">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-8 px-6">
          <Link to={home} className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-2xl border border-mint/30 bg-mint-soft ring-glow">
              <Target className="h-4 w-4 text-mint" strokeWidth={2.5} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">MatchFund</span>
          </Link>

          <nav className="hidden gap-0.5 md:flex glass-subtle rounded-full px-1 py-1">
            {nav.map((item) => {
              const active =
                item.to === home ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
                    active
                      ? "bg-white/10 text-foreground shadow-[0_1px_0_oklch(1_0_0/0.15)_inset]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex flex-1 items-center justify-end gap-3">
            <div className="hidden max-w-md flex-1 items-center gap-2 rounded-full glass-subtle px-3.5 py-1.5 text-sm text-muted-foreground md:flex">
              <Search className="h-4 w-4" />
              <input
                placeholder={searchHint}
                className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground/70"
              />
              <kbd className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px]">
                /
              </kbd>
            </div>

            <div className="relative grid h-9 w-9 place-items-center rounded-full glass-subtle">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-mint text-[10px] font-semibold text-primary-foreground">
                3
              </span>
            </div>

            <div
              title={accountEmail ?? undefined}
              className="hidden items-center gap-1.5 rounded-full glass-subtle px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground sm:inline-flex"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-mint" />
              <span className="capitalize text-foreground">{displayRole}</span>
            </div>

            <button
              onClick={signOut}
              title="Sign out"
              className="inline-flex items-center gap-1.5 rounded-full glass-subtle px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1400px] px-6 pb-24 pt-8">{children}</main>
    </div>
  );
}
