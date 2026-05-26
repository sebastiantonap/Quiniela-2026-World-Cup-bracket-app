'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import type { LeaderboardRow } from '@/types/app'

export async function getLeaderboard(
  page = 1,
  pageSize = 50
): Promise<{ rows: LeaderboardRow[]; total: number }> {
  const supabase = getSupabaseAdminClient()

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
