'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSessionEmail } from '@/lib/session'
import { isAdmin } from '@/lib/auth/isAdmin'
import { revalidatePath } from 'next/cache'

async function assertAdmin() {
  const email = await getSessionEmail()
  if (!await isAdmin(email)) throw new Error('Unauthorized')
}

export async function saveMatchResult(
  matchId: string,
  homeScore: number,
  awayScore: number,
  winnerTeamId: string | null
): Promise<{ error?: string }> {
  try {
    await assertAdmin()
  } catch {
    return { error: 'Unauthorized' }
  }

  const admin = getSupabaseAdminClient()
  const { error } = await admin
    .from('matches')
    .update({
      home_score: homeScore,
      away_score: awayScore,
      winner_team_id: winnerTeamId,
      result_confirmed: true,
    })
    .eq('id', matchId)

  if (error) return { error: error.message }
  revalidatePath('/admin')
  return {}
}

export async function clearMatchResult(matchId: string): Promise<{ error?: string }> {
  try {
    await assertAdmin()
  } catch {
    return { error: 'Unauthorized' }
  }

  const admin = getSupabaseAdminClient()
  const { error } = await admin
    .from('matches')
    .update({
      home_score: null,
      away_score: null,
      winner_team_id: null,
      result_confirmed: false,
    })
    .eq('id', matchId)

  if (error) return { error: error.message }
  revalidatePath('/admin')
  return {}
}

export async function assignKnockoutTeams(
  matchId: string,
  homeTeamId: string | null,
  awayTeamId: string | null
): Promise<{ error?: string }> {
  try {
    await assertAdmin()
  } catch {
    return { error: 'Unauthorized' }
  }

  const admin = getSupabaseAdminClient()
  const { error } = await admin
    .from('matches')
    .update({ home_team_id: homeTeamId, away_team_id: awayTeamId })
    .eq('id', matchId)

  if (error) return { error: error.message }
  revalidatePath('/admin')
  return {}
}
