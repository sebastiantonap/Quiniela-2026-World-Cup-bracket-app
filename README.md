# Quiniela 2026 ⚽

An interactive bracket challenge for the 2026 FIFA World Cup. Users predict scores for all 104 matches — from the group stage through the final — pick who qualifies from each group, choose the best third-place teams, and compete on a live leaderboard. Available in English and Spanish.

## Features

- **Email sign-in** — enter your email, no password; a session cookie keeps you logged in
- **Full bracket entry** — predict home/away scores for every group-stage match, pick winners (and penalty shootouts) for knockout rounds
- **Group qualification picks** — predict the 1st/2nd/3rd place finisher in each group
- **Best third-place picks** — choose which of the third-place teams advance to the Round of 32
- **Multiple entries per user** — create as many named brackets as you want
- **Sequential round unlocking** — Group Stage → R32 → R16 → QF → SF → 3rd Place → Final
- **Live leaderboard** — ranked by total points, with rank-movement indicators
- **Bilingual UI** — English / Spanish toggle
- **Automated results sync** — a daily cron pulls real results from [football-data.org](https://www.football-data.org); admins can override manually
- **Admin panel** — manage rounds, enter/confirm results, fill knockout slots, recalculate scores, sync, audit changes, manage admins, and export to XLSX

## Scoring System

Points come from match-score predictions (correct outcome + exact-score bonus), group qualification picks, and best-8 third-place picks. Knockout matches are **eligibility-gated** — you only score a match if you correctly advanced its teams into that round. For knockout shootouts, the exact-score bonus is awarded on the per-team aggregate (regulation + penalties). The full, always-current rules live on the in-app **Rules** page (`/rules`), rendered from `src/lib/constants/rounds.ts`.

| Round         | Correct Outcome | + Exact Score | Max |
|---------------|:--------------:|:-------------:|:---:|
| Group Stage   | 2 pts          | +2 pts        | 4   |
| Round of 32   | 3 pts          | +2 pts        | 5   |
| Round of 16   | 5 pts          | +2 pts        | 7   |
| Quarterfinals | 7 pts          | +2 pts        | 9   |
| Semifinals    | 9 pts          | +4 pts        | 13  |
| 3rd Place     | 11 pts         | +4 pts        | 15  |
| Final         | 16 pts         | +4 pts        | 20  |

## Tech Stack

- **Framework** — Next.js 14 (App Router) + React 18
- **Database** — Supabase (PostgreSQL); access via `@supabase/ssr` / `@supabase/supabase-js`
- **Auth** — lightweight email sessions (custom `user_sessions` table + cookie)
- **Styling** — Tailwind CSS 3
- **i18n** — custom dictionary-based provider (English / Spanish)
- **Export** — ExcelJS (XLSX)
- **Results data** — football-data.org API
- **Deployment** — Vercel (with a daily Cron Job for sync)

## Setup

### 1. Clone and install

```bash
git clone https://github.com/sebastiantonap/Quiniela-2026-World-Cup-bracket-app.git
cd Quiniela-2026-World-Cup-bracket-app
npm install
```

### 2. Create a Supabase project and run the migrations

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Apply every file in `supabase/migrations/` **in numerical order** (via the SQL editor, or `supabase db push` with the Supabase CLI). They build on each other, so order matters. See [Database Migrations](#database-migrations) for what each one does.

> **Note:** The seed (`002`) creates placeholder team names; migration `004` replaces them with the official 2026 draw. Once results start, the football-data.org sync keeps matches up to date — admins can still override any result manually.

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```env
# Supabase — Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Admin access — only this email can reach /admin
ADMIN_EMAIL=your-admin-email@example.com

# Used for redirects / links
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# football-data.org API key (server-side only, free tier)
FOOTBALL_DATA_API_KEY=your-football-data-api-key

# Protects the /api/sync cron endpoint
CRON_SECRET=your-cron-secret
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment (Vercel)

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Add all environment variables from `.env.local` (set `NEXT_PUBLIC_SITE_URL` to your production URL).
3. Deploy. `vercel.json` registers a daily Cron Job that calls `/api/sync` (`0 0 * * *`); Vercel sends `CRON_SECRET` so the endpoint can authenticate the request.

## Results Sync

A daily Vercel Cron hits **`/api/sync`**, which pulls match data from football-data.org and reconciles it against the database:

- Teams and matches are linked via `fd_team_id` / `fd_match_id`.
- Admin-entered results are protected by an `is_manual_override` flag and won't be overwritten.
- Every change is written to an append-only `change_log`, and each run is recorded in `sync_runs` for observability.
- The admin **Sync** tab surfaces run history and drift; one-off seeding helpers live under `/api/sync/seed-teams` and `/api/sync/seed-matches`.

## Admin Panel

Navigate to `/admin` while signed in with the email set as `ADMIN_EMAIL`. Tabs:

- **Rounds** — move rounds through `pending → accepting predictions → locked → completed`, and recalculate scores
- **Results** — enter and confirm the actual score for each match (incl. penalty shootouts)
- **Knockout Slots** — assign advancing teams to each knockout match (with auto-fill suggestions from standings)
- **Group Standings** — live standings computed from results; confirm the 8 advancing third-place teams
- **Sync** — football-data.org sync status, run history, and drift
- **Change History** — audit log of every result/field change
- **Users** — view users and manage admins

A **Clear All Results** action resets all admin-entered data (match results, knockout matchups, best-third qualifiers) and zeroes the leaderboard, while preserving every user's picks. An **Export XLSX** button downloads a spreadsheet of all entries.

Typical workflow each round:
1. Lock the current round (freezes predictions)
2. Enter and confirm match results
3. Recalculate scores (updates entries and the leaderboard)
4. Confirm group standings / best-third qualifiers and assign knockout slots
5. Open the next round for predictions

## Project Structure

```
src/
├── app/                      # Next.js App Router
│   ├── page.tsx              # Landing / sign-in
│   ├── dashboard/            # Entry list
│   ├── entries/[id]/         # Bracket view/edit
│   ├── leaderboard/          # Public rankings
│   ├── rules/                # Scoring rules
│   ├── admin/                # Admin panel
│   ├── auth/callback/        # Auth callback handler
│   └── api/
│       ├── sync/             # Cron sync + seed-teams / seed-matches
│       └── admin/export/     # XLSX export
├── actions/                  # Server actions (auth, entries, predictions,
│   │                         #   qualifications, third-place, locale, ...)
│   └── admin/                # results, rounds, recalculate, users, admins, ...
├── components/
│   ├── bracket/              # BracketShell, Group/Knockout tabs, pickers, ...
│   ├── admin/                # AdminPanel + Round/Results/Slots/Standings/
│   │                         #   Sync/ChangeHistory/UserManager
│   ├── auth/                 # MagicLinkForm
│   ├── dashboard/            # EntryCard, CreateEntryButton
│   ├── leaderboard/          # LeaderboardTable
│   ├── ui/                   # Button, Input, Badge, Spinner
│   ├── Nav.tsx               # Top nav
│   └── LanguageToggle.tsx    # EN/ES switch
├── hooks/                    # usePredictions, useQualifications (debounced save)
├── lib/
│   ├── scoring/              # Points engine, knockout eligibility, recalculation
│   ├── standings/            # Group standings, knockout slots, third-place ranking
│   ├── bracket/              # Third-place matrix
│   ├── sync/                 # football-data.org client + sync worker
│   ├── i18n/                 # Provider, dictionaries (en/es), server helpers
│   ├── supabase/             # Client, server, and admin instances
│   ├── auth/                 # isAdmin
│   ├── constants/            # Round points, labels, order
│   └── session.ts            # Session/email helpers
└── types/                    # Database and app types
supabase/
└── migrations/               # 001 → 016, apply in order (see below)
```

## Database Migrations

Apply in numerical order:

| Migration | Purpose |
|---|---|
| `001_schema` | Core tables, RLS, indexes, leaderboard view |
| `002_seed` | Groups A–L, 7 rounds, teams, 104 match rows |
| `003_group_qualifications` | Per-entry 1st/2nd/3rd group picks + leaderboard view update |
| `004_update_teams` | Official 2026 draw team names, codes, flags |
| `005_email_auth` | Replace Supabase Auth with email sessions (`user_sessions`) |
| `006_fix_leaderboard_rank` | Tied entries share the same rank |
| `007_best_third_qualified` | `teams.best_third_qualified` flag |
| `008_leaderboard_enhancements` | `entries.rank_snapshot` (rank movement) |
| `009_admins_table` | `admins` table |
| `009_entry_best_third_selections` | Per-entry best-8 third-place picks |
| `010_qualification_gated` | `predictions.qualification_gated` flag |
| `011_match_penalties` | Actual shootout-score columns on matches |
| `012_official_bracket_mapping` | Correct knockout placeholders to the official bracket |
| `013_prediction_penalties` | User-predicted shootout scores |
| `014_football_data_sync` | `fd_*` ID mapping, `change_log`, `sync_runs` |
| `015_clear_all_results_rpc` | Atomic `clear_all_results` RPC |
| `016_clear_all_results_fix` | `safeupdate`-compatible RPC + leaderboard reset |

> Two files share the `009` prefix (`admins_table` and `entry_best_third_selections`) — both are part of the schema; apply both.
