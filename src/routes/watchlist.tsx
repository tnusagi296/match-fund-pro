import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bookmark, Building2, Sparkles, TrendingUp, Users2 } from "lucide-react";
import { AppShell } from "@/components/matchfund/AppShell";
import { founders, type Founder } from "@/data/matchfund";

const WATCHLIST_KEY = "matchfund:watchlist";

export const Route = createFileRoute("/watchlist")({
  head: () => ({ meta: [{ title: "Watchlist — Match Fund" }] }),
  component: WatchlistPage,
});

function WatchlistPage() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_KEY);
      const parsed: string[] = raw ? JSON.parse(raw) : [];
      // seed with a few if empty so page has content
      const seeded = parsed.length ? parsed : founders.slice(0, 3).map((f) => f.id);
      setIds(seeded);
      if (!parsed.length) localStorage.setItem(WATCHLIST_KEY, JSON.stringify(seeded));
    } catch {
      setIds(founders.slice(0, 3).map((f) => f.id));
    }
  }, []);

  const remove = (id: string) => {
    const next = ids.filter((x) => x !== id);
    setIds(next);
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
  };

  const items: Founder[] = ids
    .map((id) => founders.find((f) => f.id === id))
    .filter((f): f is Founder => Boolean(f));

  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-mint">Investor</div>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Watchlist</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {items.length} founder{items.length === 1 ? "" : "s"} shortlisted for deeper diligence.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button className="rounded-full border border-border bg-elevated px-3 py-1.5">Export CSV</button>
          <Link to="/" className="rounded-full bg-mint px-3 py-1.5 font-medium text-primary-foreground">
            Find more →
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-16 text-center">
          <Bookmark className="mx-auto h-8 w-8 text-muted-foreground" />
          <div className="mt-3 text-sm font-medium">Your watchlist is empty</div>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Swipe right on founders in the deck to save them here.
          </p>
          <Link to="/" className="mt-4 inline-block rounded-full bg-mint px-4 py-2 text-xs font-medium text-primary-foreground">
            Open swipe deck
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl glass">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-elevated/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3 text-left font-medium">Founder</th>
                <th className="p-3 text-left font-medium">Sector · Stage</th>
                <th className="p-3 text-right font-medium">Fit</th>
                <th className="p-3 text-right font-medium">Idea</th>
                <th className="p-3 text-right font-medium">Trust</th>
                <th className="p-3 text-left font-medium">Signal</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.id} className="border-b border-border/40 last:border-0 hover:bg-elevated/30">
                  <td className="p-3">
                    <Link
                      to="/founder/$id"
                      params={{ id: f.id }}
                      className="flex items-center gap-3"
                    >
                      <img src={f.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                      <div>
                        <div className="font-medium">{f.name}</div>
                        <div className="text-[11px] text-muted-foreground">{f.headline}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="p-3 text-xs">
                    <div>{f.sector}</div>
                    <div className="text-muted-foreground">{f.stage}</div>
                  </td>
                  <td className="p-3 text-right font-semibold tabular text-mint">{f.scores.fit}</td>
                  <td className="p-3 text-right tabular">{f.scores.idea}</td>
                  <td className="p-3 text-right tabular">{f.scores.trust}</td>
                  <td className="p-3 text-xs">
                    <span className="inline-flex items-center gap-1 rounded-full border border-mint/30 bg-mint-soft px-2 py-0.5 text-[10px] text-mint">
                      <Sparkles className="h-3 w-3" /> {f.matchReason.split("·")[0].trim()}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-1">
                      {f.companyId && (
                        <Link
                          to="/company/$id"
                          params={{ id: f.companyId }}
                          className="rounded-md border border-border bg-elevated p-1.5 hover:border-mint/40"
                          title="Company diligence"
                        >
                          <Building2 className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      <Link
                        to="/idea/$id"
                        params={{ id: f.id }}
                        className="rounded-md border border-border bg-elevated p-1.5 hover:border-mint/40"
                        title="Idea strength"
                      >
                        <TrendingUp className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        to="/founder/$id"
                        params={{ id: f.id }}
                        className="rounded-md border border-border bg-elevated p-1.5 hover:border-mint/40"
                        title="Founder profile"
                      >
                        <Users2 className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        onClick={() => remove(f.id)}
                        className="rounded-md border border-border bg-elevated p-1.5 text-muted-foreground hover:text-foreground"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
