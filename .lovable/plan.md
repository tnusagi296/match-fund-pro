# Investor Onboarding & Hooked-Model Redesign

## The problem
Right now the app opens on a swipe deck with pre-computed "match" scores, but a new investor has never told us their thesis, stage, sector, or check size. Those scores are fiction. We also expose six navigation tabs (Discover, Watchlist, Grants, Insights, Me, etc.) which dilutes what the product is actually for: helping investors spot pre-seed / hackathon founders worth a first call.

We fix both by (a) collecting a minimal thesis before the first swipe and (b) restructuring the app around Nir Eyal's Hooked loop.

## Hooked loop applied to Match Fund

```text
Trigger   → Daily "X new founders match your thesis" (internal) + email/notif (external)
Action    → One tap: swipe right / left on a founder card (lowest friction possible)
Reward    → Variable: each card reveals a different signal mix (hackathon win,
            GitHub streak, unexpected co-founder, arXiv paper). Score reveal
            animates AFTER the swipe, not before → curiosity gap.
Investment→ Every swipe teaches the model: thesis sliders adjust, watchlist grows,
            notes/questions attached to a founder. The more the investor invests,
            the sharper tomorrow's batch.
```

## What we build

### 1. Investor onboarding (Investment, up-front)
New route `/onboard` shown once when an investor has no thesis saved.
Four quick steps, each one screen, skippable but encouraged:

1. **Stage focus** — chips: Hackathon, Pre-idea, Pre-seed, Seed. Multi-select.
2. **Sectors** — chips: AI/ML, Climate, Fintech, Health, Devtools, Consumer, Robotics, Other.
3. **Signals you weight most** — 3 sliders (0–100): Technical depth, Traction/velocity, Founder-market fit. Sum is normalized.
4. **Geography & check size** — optional; region multi-select + check-size range.

Saved to `investor_thesis` (new table, RLS-scoped to `auth.uid()`). This IS the "Investment" phase of Hooked — the more the investor tells us, the more relevant tomorrow's deck feels.

### 2. Match score becomes real
`computeMatchScore(founder, thesis)` — weighted sum:
- stage overlap (hard filter + soft bonus)
- sector overlap
- signal alignment: technical depth vs GitHub/arXiv weight, traction vs hackathon wins / user growth, FMF vs prior exits + domain
- geography bonus

Cards without a saved thesis show a neutral "Getting to know you" badge instead of a fake percentage — no more hallucinated scores.

### 3. Variable Reward on every swipe
- Score and highlight reel reveal AFTER the swipe animation, not before, so each card is a small surprise.
- Each card surfaces a different "hero signal" (hackathon podium, unusual GitHub graph, a paper citation spike) — variety keeps the reward unpredictable.
- Occasional "🔥 rare find" flag when a card is >90 match — intermittent reinforcement.

### 4. Trigger
- Daily count badge on the app icon in nav: "12 new founders today".
- Optional email digest toggle in onboarding step 4 ("Send me a morning shortlist").

### 5. Trim the navigation
The current nav has too many destinations for a habit product. Reduce to three:

```text
Today   (swipe deck — the loop)
Saved   (watchlist + notes — the investment record)
Thesis  (edit onboarding answers anytime)
```

Move Grants and Insights into secondary surfaces:
- Grants → founder-side only (shown inside `/me`, since founders apply, investors don't).
- Insights → collapsed into a small "Your patterns" card at the top of Saved (what sectors/stages you actually swipe right on vs what you said).
- Company / Idea / Founder deep-dive pages stay, reached from a card, not from the top nav.

### 6. First-run experience
1. New investor lands → auto-redirect to `/onboard`.
2. Finish onboarding → land on Today deck with a one-time coach mark: "Swipe right to save, left to pass. Your thesis sharpens with every swipe."
3. After first 5 swipes → toast: "Nice — your match model just got 12% sharper." (Investment feedback made visible.)

## Technical notes

- New table `investor_thesis` (id, user_id unique, stages text[], sectors text[], weights jsonb, geos text[], check_min int, check_max int, digest_email bool, updated_at). RLS: select/insert/update where `auth.uid() = user_id`. Grants to `authenticated` + `service_role`.
- Server fns in `src/lib/thesis.functions.ts`: `getMyThesis`, `saveMyThesis`, `getRankedFounders` (calls the scorer server-side so weights aren't exposed).
- Scoring lives in `src/lib/matching.ts` (pure fn, unit-testable) and is called by `getRankedFounders`.
- Route file `src/routes/_authenticated/onboard.tsx` (four-step wizard, local state, single save on finish).
- Refactor `AppShell.tsx` nav to the 3-item set + role switcher. Founder role keeps its own set (Me, Grants).
- `src/routes/index.tsx` (Today): if `getMyThesis()` returns null → redirect to `/onboard`. Otherwise fetch ranked founders and reveal score post-swipe.
- Move Insights content into `src/routes/watchlist.tsx` as a header card; delete `/insights` route file. Remove `/grants` from investor nav (route stays for founder role).
- Keep existing founder/company/idea detail pages unchanged.

## Out of scope
- Real ML model — scoring stays a transparent weighted sum, good enough for a design product and easy to explain to investors.
- Push notifications — daily count badge only, email digest is just a toggle stored for later.
- Founder-side onboarding changes — this pass is investor-only.
