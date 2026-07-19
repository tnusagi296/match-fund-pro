import { Link, useRouter } from "@tanstack/react-router";
import { Bell, Search, Target, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

// Trimmed to the Hooked loop: Today (Action + Reward), Saved (Investment record),
// Thesis (Investment input). Everything else is reached from a card.
const NAV_INVESTOR = [
  { to: "/", label: "Discover" },
  { to: "/watchlist", label: "Shortlist" },
  { to: "/onboard", label: "Thesis" },
];
const NAV_FOUNDER = [
  { to: "/me", label: "My profile" },
  { to: "/grants", label: "Grants" },
  { to: "/", label: "How I appear" },
];

export type Role = "investor" | "founder";

export function useRole(): [Role, (r: Role) => void] {
  const [role, setRole] = useState<Role>("investor");
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("mf.role") : null;
    if (stored === "founder" || stored === "investor") setRole(stored);
  }, []);
  const update = (r: Role) => {
    setRole(r);
    if (typeof window !== "undefined") window.localStorage.setItem("mf.role", r);
  };
  return [role, update];
}

export function AppShell({ children }: { children: ReactNode }) {
  const [role, setRole] = useRole();
  const router = useRouter();
  const pathname = router.state.location.pathname;
  const nav = role === "investor" ? NAV_INVESTOR : NAV_FOUNDER;

  return (
    <div className="relative min-h-screen text-foreground bg-aurora">
      <header className="sticky top-0 z-40 glass-bar">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-8 px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-2xl border border-mint/30 bg-mint-soft ring-glow">
              <Target className="h-4 w-4 text-mint" strokeWidth={2.5} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">MatchFund</span>
          </Link>

          <nav className="hidden gap-0.5 md:flex glass-subtle rounded-full px-1 py-1">
            {nav.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to + item.label}
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
                placeholder={
                  role === "investor"
                    ? "Search founders, companies, keywords"
                    : "Search grants & programs"
                }
                className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground/70"
              />
              <kbd className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px]">
                /
              </kbd>
            </div>

            <button
              onClick={() => setRole(role === "investor" ? "founder" : "investor")}
              className="hidden items-center gap-2 rounded-full glass-subtle px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground md:inline-flex"
              title="Toggle role"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Viewing as</span>
              <span className="font-medium text-foreground capitalize">{role}</span>
            </button>

            <div className="relative grid h-9 w-9 place-items-center rounded-full glass-subtle">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-mint text-[10px] font-semibold text-primary-foreground">
                3
              </span>
            </div>

            <div className="relative h-9 w-9 rounded-full glass border border-white/15">
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-mint" />
            </div>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1400px] px-6 pb-24 pt-8">{children}</main>
    </div>
  );
}
