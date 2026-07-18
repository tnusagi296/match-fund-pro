import { Link, useRouter } from "@tanstack/react-router";
import { Bell, Search, Target, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

const NAV_INVESTOR = [
  { to: "/", label: "Discover" },
  { to: "/watchlist", label: "Watchlist" },
  { to: "/insights", label: "Insights" },
  { to: "/grants", label: "Programs" },
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
    <div className="min-h-screen bg-background text-foreground bg-hero-grid">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-8 px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-full border border-mint/30 bg-mint-soft ring-glow">
              <Target className="h-4 w-4 text-mint" strokeWidth={2.5} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">Match Fund</span>
          </Link>

          <nav className="hidden gap-1 md:flex">
            {nav.map((item) => {
              const active =
                item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to + item.label}
                  to={item.to}
                  className={`relative rounded-md px-3 py-1.5 text-sm transition ${
                    active
                      ? "text-mint"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-mint" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex flex-1 items-center justify-end gap-3">
            <div className="hidden max-w-md flex-1 items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-1.5 text-sm text-muted-foreground md:flex">
              <Search className="h-4 w-4" />
              <input
                placeholder={role === "investor" ? "Search founders, companies, keywords" : "Search grants & programs"}
                className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground/70"
              />
              <kbd className="rounded border border-border/70 px-1.5 py-0.5 text-[10px]">/</kbd>
            </div>

            <button
              onClick={() => setRole(role === "investor" ? "founder" : "investor")}
              className="hidden items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground md:inline-flex"
              title="Toggle role"
            >
              <Users className="h-3.5 w-3.5" />
              <span>Viewing as</span>
              <span className="font-medium text-foreground capitalize">{role}</span>
            </button>

            <div className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-mint text-[10px] font-semibold text-primary-foreground">
                3
              </span>
            </div>

            <div className="relative h-9 w-9 rounded-full border border-border bg-elevated">
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-mint" />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 pb-24 pt-8">{children}</main>
    </div>
  );
}
