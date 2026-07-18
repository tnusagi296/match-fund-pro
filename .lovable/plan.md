# Match Fund — Founder-Focused Software UI Plan

Two-sided app centered on **founders** (especially hackathon participants, pre-incorporation or pre-seed/seed). Founders build a profile + upload a pitch deck to be discoverable. Investors get Tinder-style swipe matching driven by Founder Fit / Idea / Traction / Trust scores against their thesis. Desktop-first, dark navy + graphite + restrained mint accents, matching the three reference images.

## Users & core loop

- **Founder** signs up → completes profile (bio, skills, hackathons, GitHub, links) → uploads pitch deck → system enriches by crawling public sources → profile scored → visible in investor swipe deck; founder can also apply to **grants** and open **investor contact** requests.
- **Investor** sets thesis → swipes a match feed (Pass / Watch / Shortlist / Contact) ranked by fit → drills into full Founder & Company profile → moves to Diligence.

## Routes (TanStack file-based)

Shared `AppShell` (top nav + role switcher; role stored in `localStorage` for the demo). All routes are seeded from typed mock data — no backend in this build.

- `/` → **Investor Swipe Deck** (primary landing, mirrors the app's "Tinder-style" thesis).
- `/discover` → Ranked list/grid alternative to swiping (filters + table).
- `/founder/$id` → **Founder profile** (mirrors reference image-3): Founder Fit ring, signals, experience, education, related company (if any), hackathon history, deck viewer, "Review Founder" / "Contact Founder".
- `/company/$id` → **Company diligence** (mirrors image-2): Traction Strength + Trust Score rings, KPI tiles, timeline, evidence trail, key signals, investor path stepper. Rendered only for founders who have a company; pre-company founders show a "No company yet — hackathon builds only" state.
- `/idea/$id` → **Idea Strength** view (mirrors image-1): Problem Clarity, Solution Differentiation, Technical Moat, Strategic Fit, Target Customer, Why Now, Founder & Traction snapshot, Top Strengths.
- `/me` → **Founder onboarding & profile builder** (founder side): step wizard (Basics → Hackathons → Links → Deck upload → Preview). Deck "upload" is a drop-zone stub that mock-parses to fill fields; no real storage.
- `/grants` → Grant & program directory: filterable cards (Y Combinator, On Deck, EF, Antler, government grants, hackathon prize pools). Founder taps **Apply** → modal with prefilled pitch draft from profile. Investor view shows same directory read-only.
- `/watchlist` → Investor's shortlisted founders (from swipes).
- `/insights` → Small dashboard of pipeline stats (kept minimal, not the focus).

Role switcher in the top-right ("Viewing as Investor / Founder") toggles nav items and CTAs.

## Screen details

### 1. Swipe Deck (`/`) — signature screen

- Center: large stacked **founder card** (portrait 640×760 area) with:
  - Avatar/photo, name, headline (e.g. "Co-founder & CEO @ VectorNav" or "Solo builder — pre-company"), location, "Open to opportunities" pill.
  - Hackathon strip: last 2-3 events with placement chips.
  - Mini score bars: Founder Fit · Idea · Traction · Trust (mint bars, tabular numerals).
  - "Why matched" line tied to investor thesis ("Autonomous systems · Technical founder · Recent shipped demo").
- Right rail: **Thesis filters** (sector chips, stage, min scores, hackathon-sourced toggle, geography), "Match strength" gauge, small stack preview of next 3 cards.
- Left rail: **Session stats** (Reviewed today, Shortlisted, Contacted) + keyboard hints (← Pass, → Shortlist, ↑ Watch, ↓ Contact).
- Bottom action bar: circular buttons Pass · Watch · Shortlist · Contact — mint primary for Shortlist.
- Motion: card tilts on drag, exits with color-tinted glow (rose left / mint right / amber up); next card scales in. Implement with pointer events + CSS transforms (no heavy gesture lib).
- Empty state after ~10 cards: "You've seen today's top matches — refine thesis or open Discovery."

### 2. Founder profile (`/founder/$id`)

Closely follows reference image-3:
- Left card: photo, name, verified check, role, location, "Available for relocation" chip, bio, skill chips, team avatars with "3/4 · Strong team".
- Right card: **Founder Fit 92/100** big ring, sub-bars for Domain Expertise, Technical Depth, Execution History, Market Insight, Team Completeness.
- Row: Signals & Traction tiles (Hackathon Wins, GitHub Activity, Prior Projects, Team Completeness).
- Row: Experience Snapshot + Education (Tesla, Skydio, Stanford, etc.).
- Right rail: **Related Company** card if founder has one, else "Building in stealth · No company yet"; **Recent Updates** feed.
- Sticky footer: "Review Founder" (primary mint) + "Contact Founder" + bookmark.
- **Pitch deck viewer**: below the fold, an inline slide viewer (mock — renders 6 pre-rendered slide images) with a "Request full deck" button.
- **Crawl provenance** drawer: opens from an "Evidence & sources" link — lists what was crawled (GitHub commits, Devpost projects, LinkedIn-style record, personal site, Reddit) with confidence badges. Purely presentational; sources are mock URLs.

### 3. Company diligence (`/company/$id`) — image-2

Rings for Traction Strength + Trust Score, KPI tiles (Pilots, Revenue Signals, Customer Interest, Evidence Quality, Claim Verification), Recharts area timeline, Evidence Trail rows with confidence pills, Key Signals list with one Key Risk in red, Investor Path stepper, Recommendation card with Shortlist / Move to Diligence / Pass.

### 4. Idea Strength (`/idea/$id`) — image-1

Left: "IDEA ASSESSMENT" eyebrow, huge "Idea Strength" title, description, "View full methodology" button. Center: 88/100 orbital score ring on a starfield gradient. Around it: six factor cards (Problem Clarity, Solution Differentiation, Technical Moat, Strategic Fit, Target Customer, Why Now) with icon + 5-dot bar. Bottom-left: Founder & Traction mini panel. Bottom-right: Top Strengths list. Center-bottom: verdict banner with star icon.

### 5. Founder onboarding (`/me`)

Multi-step wizard on a graphite card:
1. **Basics** — name, headline, location, avatar upload (stub), "Open to opportunities" toggle.
2. **Building status** — radio: `Idea stage` / `Hackathon build` / `Prototype` / `Incorporated company`. If company, capture name, stage, sector, one-liner.
3. **Hackathons** — repeatable rows (event, date, placement, project link, team). Prize-winner badge auto-shows.
4. **Links** — GitHub, personal site, LinkedIn, Devpost, X. "Crawl my public footprint" button → runs a fake 3-second progress with steps ("Fetching GitHub commits… Parsing Devpost… Cross-referencing…") then fills a "Detected signals" panel (repos, stars, hackathon count, top languages).
5. **Pitch deck** — drop zone; on file selection, show a mock-parse animation, then a preview grid of slide thumbnails plus extracted fields (problem, solution, market, ask) the founder can edit.
6. **Preview & publish** — renders the founder profile card exactly as investors will see it, plus current scores with a "How this is calculated" popover.

### 6. Grants & contacts (`/grants`)

- Filter bar: category (Accelerator, Grant, Angel Network, Hackathon Prize), stage fit, geography, deadline.
- Card grid: program logo, name, one-line, funding size, deadline countdown, fit score against founder profile ("87% match — strong technical fit"). Apply button opens a modal with prefilled cover note derived from profile fields; Copy / Send (stub) actions.
- Investor view (role switcher = Investor): read-only browsing, plus "Suggest to founder" action on any card.

## Design system

Update `src/styles.css` — set app default to `.dark`:
- Background `oklch(0.18 0.03 250)` deep navy; card `oklch(0.24 0.02 250)` graphite; elevated `oklch(0.28 0.02 250)`; ivory foreground `oklch(0.96 0.01 250)`; muted slate `oklch(0.7 0.02 250)`.
- Primary mint `oklch(0.85 0.17 155)`; primary-foreground near-black; ring-glow token for score circles; amber `oklch(0.82 0.16 80)` for Watch, rose `oklch(0.72 0.17 25)` for Pass/Risk.
- Semantic tokens: `--score-strong`, `--score-medium`, `--score-weak`, `--gradient-hero-wave`, `--gradient-score`, `--surface-elevated`, `--stroke-hairline`.
- Fonts via `<link>` in `__root.tsx` head: Geist Sans (display + UI) + Inter (body). Registered in `@theme`. Tabular numerals for scores.

## Head metadata

`__root.tsx`: title "Match Fund — Founder intelligence for pre-seed & seed investors", matching description, og/twitter. Every leaf route overrides with its own title/description (`/founder/$id` uses founder name; `/company/$id` uses company name).

## Components (new, under `src/components/`)

`AppShell.tsx`, `TopNav.tsx`, `RoleSwitcher.tsx`, `SwipeDeck.tsx`, `FounderCard.tsx`, `ScoreRing.tsx`, `ScoreBar.tsx`, `ThesisFilters.tsx`, `FactorCard.tsx` (idea), `EvidenceRow.tsx`, `InvestorPathStepper.tsx`, `KpiTile.tsx`, `TractionChart.tsx` (Recharts), `HackathonRow.tsx`, `DeckUploader.tsx`, `DeckViewer.tsx`, `CrawlProgress.tsx`, `GrantCard.tsx`, `ApplyModal.tsx`, `OnboardingWizard.tsx`, `EmptyState.tsx`.

Typed mock data in `src/data/`: `founders.ts` (12-15 founders including 4 hackathon-only pre-company builders), `companies.ts` (6-8 tied to founders), `grants.ts` (10 programs), `sources.ts` (evidence items).

## Interactions & state

- Swipe deck state (index, decisions, watchlist) held in a small Zustand-free `useReducer` + `localStorage` persistence so decisions survive reloads.
- Filters in URL via `validateSearch` + `Route.useSearch()` so shared links reproduce the deck.
- Onboarding wizard state in `useReducer` inside `/me`, persisted to `localStorage` under `matchfund.founder.draft`.
- All "crawl" and "deck parse" flows are timed animations over static mock output — clearly presentational, no external calls in this build.

## Explicitly out of scope

- Real auth, real storage, real crawling, real deck OCR, real grant submission, payments.
- Lovable Cloud / database / edge functions (can be added in a follow-up).
- Mobile-native gestures library; swipe uses plain pointer events.
- Marketing / landing page — excluded per request.

## Deliverable

A navigable dark-mode app: investors land on the swipe deck, drill into founder & company & idea profiles matching the three inspirations; founders can walk through onboarding, upload a deck (mock), see their live profile preview, browse grants, and apply. Scores animate on mount, cards drag and exit with color glow, and the aesthetic is consistent across every screen.
