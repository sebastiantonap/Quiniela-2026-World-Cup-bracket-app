'use server'

import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { LeaderboardRow } from '@/types/app'

export async function getLeaderboard(
  page = 1,
  pageSize = 25
): Promise<{ rows: LeaderboardRow[]; total: number }> {
  const supabase = await getSupabaseServerClient()

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, count } = await supabase
    .from('leaderboard')
    .select('*', { count: 'exact' })
    .range(from, to)

  return {
    rows: (data ?? []) as LeaderboardRow[],
    total: count ?? 0,
  }
}
