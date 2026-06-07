---
name: testing-admin-panel
description: End-to-end testing of the Quiniela 2026 admin panel features including group standings, confirmed positions, match results, and best-8 third qualifiers. Use when verifying admin UI or scoring logic changes.
---

# Testing the Quiniela 2026 Admin Panel

## Environment Setup

1. **Dev server**: Run `npm run dev -- -p 3000` from the repo root with `.env.local` containing the Supabase credentials.
2. **Env file**: `.env.local` must have `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. The repo may have a `.env` or repo-scoped secrets that override — make sure the correct Supabase URL is used.
3. **DB migrations**: Schema changes (e.g., `ALTER TABLE`) cannot be run via the Supabase REST API (service role key). You need either the DB password for `psql` access or the user must run DDL in the Supabase SQL Editor. IPv6-only DB hosts may not be reachable from all VMs.

## Devin Secrets Needed

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/publishable key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (for server-side DB operations)
- Admin login: email + 4-digit PIN (ask user if not in secrets)

## Admin Login

1. Navigate to `http://localhost:3000`
2. Enter admin email and 4-digit PIN
3. After login, navigate to `/admin`

## Testing Group Standings & Confirmed Positions

### Creating Test Data

To test tie detection and confirmed positions, create a scenario where 3+ teams are fully tied (same Pts, GD, GF). Example for Group A:

- Team A 1–0 Team B
- Team B 1–0 Team C
- Team C 1–0 Team A
- Each team 2–0 against 4th team

This creates a 3-way tie at 6pts / +2GD / 3GF.

### Important: `result_confirmed` Flag

Match results must have `result_confirmed = true` in the DB for standings to include them. If standings show all zeros despite results being entered, check this flag. You can batch-update via the service role key:

```javascript
const { createClient } = require('@supabase/supabase-js')
const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
await client.from('matches').update({ result_confirmed: true }).eq('group_id', GROUP_ID)
```

### Verifying Tie Detection

- Navigate to Admin → Group Standings tab
- Tied teams should show ▲/▼ arrow buttons
- A "Tie detected" notice should appear
- Non-tied teams should NOT have arrows

### Verifying Confirmed Positions

- Use ▲/▼ arrows to reorder tied teams
- Click "Confirm order" → "Order confirmed" message should appear
- Refresh page → order should persist
- Verify DB: `SELECT name, confirmed_position FROM teams WHERE group_id = '...'`

### Arrow Button Interaction

The ▲/▼ buttons may be small and hard to click via automated GUI tools. If clicks don't register, try:
- Using browser console: `document.querySelector('[devinid="XX"]').click()`
- Zooming into the button area first for more precise targeting

## Testing Best-8 Third Qualifier Confirmation

- Scroll to "Best 3rd-Place Teams" section at bottom of Group Standings
- 12 third-place teams are listed; check/uncheck to select exactly 8
- Click "Confirm qualifiers" → triggers `confirmThirdPlaceQualifiers` server action
- This action should auto-trigger `recalculateRound` for group_stage
- Verify: `SELECT name, best_third_qualified FROM teams WHERE best_third_qualified = true` should return 8 teams
- Verify: `group_qualifications` table should have `calculated_at` timestamps matching the confirmation time

### Note on Recalculation Time

The "Confirm qualifiers" action may take 30+ seconds because it recalculates scores for ALL entries. The button stays in "Saving…" state with no progress indicator. This is expected behavior.

## Scoring Logic Reference

### Match Points (per match)
- Correct outcome + exact score: 4 pts (2 + 2 bonus)
- Correct outcome, wrong score: 2 pts
- Wrong outcome: 0 pts

### Qualification Points (per group)
- 1st pick correct: 4 pts
- 2nd pick correct: 3 pts
- 3rd pick correct AND best-8 qualified: 2 pts
- Any pick whose team qualifies but in wrong position: 1 pt (consolation)
- Otherwise: 0 pts

## Common Issues

1. **Standings show all zeros**: Check `result_confirmed = true` on match records
2. **Can't run DDL migrations**: Supabase REST API doesn't support schema changes — need DB password or user to run in SQL Editor
3. **IPv6 DB host**: The Supabase PostgreSQL host may resolve to IPv6 only, which some VMs can't reach. Use REST API for data operations.
4. **Vercel preview auth**: Preview deployments may require Vercel login. Test locally instead.
5. **Dev server wrong env**: If repo has multiple `.env` files or repo-scoped secrets, the dev server might use wrong Supabase URL. Kill and restart with only `.env.local`.
