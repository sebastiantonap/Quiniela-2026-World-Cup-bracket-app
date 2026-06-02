'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { ROUND_POINTS, ROUND_ORDER } from '@/lib/constants/rounds'
import type { EnrichedLeaderboardRow, RoundName } from '@/types/app'

export async function getLeaderboard(
  page = 1,
  pageSize = 50
): Promise<{ rows: EnrichedLeaderboardRow[]; total: number; userRow: EnrichedLeaderboardRow | null }> {
  const supabase = getSupabaseAdminClient()

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, count } = await supabase
    .from('leaderboard')
    .select('*', { count: 'exact' })
    .range(from, to)

  const baseRows = (data ?? []) as EnrichedLeaderboardRow[]
  if (baseRows.length === 0) return { rows: [], total: count ?? 0, userRow: null }

  const entryIds = baseRows.map((r) => r.entry_id)

  // ---------- Max potential (secondary queries run in parallel) ----------
  const [
    { data: uncalcPreds },
    { data: uncalcQuals },
    { data: scoredPreds },
    { data: scoredQuals },
  ] = await Promise.all([
    // Uncalculated match predictions with round name
    supabase
      .from('predictions')
      .select('entry_id, match_id, predicted_home, predicted_winner_team_id, matches(rounds(name))')
      .in('entry_id', entryIds)
      .is('calculated_at', null),

    // Uncalculated group quals with at least a 1st-place pick
    supabase
      .from('group_qualifications')
      .select('entry_id')
      .in('entry_id', entryIds)
      .is('calculated_at', null)
      .not('predicted_1st_team_id', 'is', null),

    // Scored match predictions with round name for breakdown
    supabase
      .from('predictions')
      .select('entry_id, points_awarded, matches(rounds(name))')
      .in('entry_id', entryIds)
      .not('calculated_at', 'is', null),

    // Scored group quals for group_stage breakdown bucket
    supabase
      .from('group_qualifications')
      .select('entry_id, points_awarded')
      .in('entry_id', entryIds)
      .not('calculated_at', 'is', null),
  ])

  // Build max_potential map
  const potentialMap = new Map<string, number>()

  for (const pred of uncalcPreds ?? []) {
    const hasPrediction =
      pred.predicted_home !== null || pred.predicted_winner_team_id !== null
    if (!hasPrediction) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roundName = (pred as any).matches?.rounds?.name as RoundName | undefined
    if (!roundName || !ROUND_POINTS[roundName]) continue

    const { winner, bonus } = ROUND_POINTS[roundName]
    potentialMap.set(pred.entry_id, (potentialMap.get(pred.entry_id) ?? 0) + winner + bonus)
  }

  for (const qual of uncalcQuals ?? []) {
    potentialMap.set(qual.entry_id, (potentialMap.get(qual.entry_id) ?? 0) + 9)
  }

  // Build round_breakdown map
  const breakdownMap = new Map<string, Partial<Record<RoundName, number>>>()

  for (const pred of scoredPreds ?? []) {
    if (!pred.points_awarded) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roundName = (pred as any).matches?.rounds?.name as RoundName | undefined
    if (!roundName) continue
    const entry = breakdownMap.get(pred.entry_id) ?? {}
    entry[roundName] = (entry[roundName] ?? 0) + pred.points_awarded
    breakdownMap.set(pred.entry_id, entry)
  }

  for (const qual of scoredQuals ?? []) {
    if (!qual.points_awarded) continue
    const entry = breakdownMap.get(qual.entry_id) ?? {}
    entry['group_stage'] = (entry['group_stage'] ?? 0) + qual.points_awarded
    breakdownMap.set(qual.entry_id, entry)
  }

  const rows: EnrichedLeaderboardRow[] = baseRows.map((row) => ({
    ...row,
    rank_delta: Number.isFinite(row.rank_delta) ? row.rank_delta : 0,
    max_potential: row.total_points + (potentialMap.get(row.entry_id) ?? 0),
    round_breakdown: breakdownMap.get(row.entry_id) ?? {},
  }))

  return { rows, total: count ?? 0, userRow: null }
}

export async function getUserLeaderboardRow(
  email: string
): Promise<EnrichedLeaderboardRow | null> {
  const supabase = getSupabaseAdminClient()

  const { data } = await supabase
    .from('leaderboard')
    .select('*')
    .eq('user_email', email)
    .order('rank', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  const row = data as unknown as EnrichedLeaderboardRow
  return {
    ...row,
    rank_delta: Number.isFinite(row.rank_delta) ? row.rank_delta : 0,
    max_potential: row.total_points,
    round_breakdown: {},
  }
}
