# Quiniela 2026 ⚽

An interactive bracket challenge for the 2026 FIFA World Cup. Users predict scores for all 104 matches — from group stages through the final — and compete on a live leaderboard.

## Features

- **Magic link auth** — sign in with just your email, no password needed
- **Full bracket entry** — predict home/away scores for every group stage match; pick winners for all knockout rounds
- **Multiple entries per user** — create as many named brackets as you want
- **Sequential round unlocking** — Group Stage → Round of 32 → Round of 16 → QF → SF → Final
- **Live leaderboard** — ranked by total points across all entries
- **Admin panel** — enter real results, manage round status, recalculate scores

## Scoring System

Points come from match-score predictions (correct outcome + exact-score bonus),
group qualification picks, and best-8 third-place picks. Knockout matches are
gated by eligibility (you only score a match if you correctly advanced its
teams). The full, always-current rules live on the in-app **Rules** page
(`/rules`), rendered from the constants in `src/lib/constants/rounds.ts`.

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

- **Framework** — Next.js 14 (App Router)
- **Database & Auth** — Supabase (PostgreSQL + magic link)
- **Styling** — Tailwind CSS
- **Deployment** — Vercel

## Setup

### 1. Clone and install

```bash
git clone https://github.com/sebastiantonap/Quiniela-2026-World-Cup-bracket-app.git
cd Quiniela-2026-World-Cup-bracket-app
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In the SQL editor, run the migrations in order:
   - `supabase/migrations/001_schema.sql` — creates all tables, RLS policies, and the leaderboard view
   - `supabase/migrations/002_seed.sql` — seeds groups, rounds, and all 104 match rows
3. In **Authentication → Email**, enable **Magic Links** and set your Site URL

> **Important:** The seed file uses placeholder team names (`Group A - Team 1`, etc.). You'll need to update these with the actual 2026 FIFA World Cup draw results via the Supabase dashboard (Table Editor → teams) or through the admin panel once the app is running.

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_EMAIL=your-admin-email@example.com
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Find your keys in Supabase under **Project Settings → API**.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment (Vercel)

1. Import the repo at [vercel.com/new](https://vercel.com/new)
2. Add all environment variables from `.env.local` (update `NEXT_PUBLIC_SITE_URL` to your production URL)
3. In Supabase **Authentication → URL Configuration**, add your Vercel URL to the allowed redirect URLs
4. Deploy

## Admin Panel

Navigate to `/admin` while signed in with the email set as `ADMIN_EMAIL`. From there you can:

- **Round Manager** — move rounds through `pending → accepting predictions → locked → completed`
- **Enter Results** — input the actual score for each match and confirm it
- **Knockout Slots** — assign advancing teams to each knockout match after results are in
- **Group Standings** — view live standings computed from entered results to determine who qualifies

The workflow each round:
1. Lock the current round (freezes all predictions)
2. Enter and confirm match results
3. Recalculate scores (updates all entries and the leaderboard)
4. Assign knockout slots for the next round
5. Open the next round for predictions

## Project Structure

```
src/
├── app/                  # Next.js pages
│   ├── page.tsx          # Landing / magic link
│   ├── dashboard/        # Entry list
│   ├── entries/[id]/     # Bracket view/edit
│   ├── leaderboard/      # Public rankings
│   ├── admin/            # Admin panel
│   └── auth/callback/    # Magic link handler
├── actions/              # Server actions (mutations)
├── components/
│   ├── bracket/          # BracketShell, GroupCard, KnockoutMatchCard, …
│   ├── admin/            # RoundManager, ResultsEntry, KnockoutSlotFiller, …
│   ├── leaderboard/      # LeaderboardTable
│   └── ui/               # Button, Input, Badge, Spinner
├── hooks/                # usePredictions (debounced auto-save)
├── lib/
│   ├── scoring/          # Points engine + batch recalculation
│   ├── standings/        # FIFA group tiebreaker logic
│   └── supabase/         # Client, server, and admin Supabase instances
└── types/                # Database and app types
supabase/
└── migrations/
    ├── 001_schema.sql    # Tables, RLS, indexes, leaderboard view
    └── 002_seed.sql      # Groups, rounds, teams, 104 match rows
```
