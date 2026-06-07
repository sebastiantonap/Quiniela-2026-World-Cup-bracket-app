'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSessionEmail } from '@/lib/session'
import { isAdmin } from '@/lib/auth/isAdmin'
import { recalculateRound } from '@/lib/scoring/recalculate'
import { revalidatePath } from 'next/cache'

export async function confirmThirdPlaceQualifiers(teamIds: string[]): Promise<{ error?: string }> {
  const email = await getSessionEmail()
  if (!await isAdmin(email)) return { error: 'Unauthorized' }
  if (teamIds.length !== 8) return { error: 'Must select exactly 8 teams' }

  const supabase = getSupabaseAdminClient()

  const { error: resetError } = await supabase
    .from('teams')
    .update({ best_third_qualified: false })
    .eq('best_third_qualified', true)

  if (resetError) return { error: resetError.message }

  const { error: markError } = await supabase
    .from('teams')
    .update({ best_third_qualified: true })
    .in('id', teamIds)

  if (markError) return { error: markError.message }

  // Auto-recalculate group_stage so qualification points reflect the
  // just-confirmed best-8 thirds immediately (fixes scoring for exact-3rd
  // picks and consolation points for picks whose team is a qualified third).
  const { data: gsRound } = await supabase
    .from('rounds')
    .select('id')
    .eq('name', 'group_stage')
    .single()

  if (gsRound) {
    await recalculateRound(gsRound.id)
  }

  revalidatePath('/admin')
  revalidatePath('/leaderboard')
  revalidatePath('/dashboard')
  revalidatePath('/entries', 'layout')
  return {}
}
