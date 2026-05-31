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
  homePenalties: number | null = null,
  awayPenalties: number | null = null
): Promise<{ error?: string }> {
  try {
    await assertAdmin()
  } catch {
    return { error: 'Unauthorized' }
  }

  const admin = getSupabaseAdminClient()

  const { data: match, error: fetchError } = await admin
    .from('matches')
    .select('home_team_id, away_team_id, round:rounds(name)')
    .eq('id', matchId)
    .single()

  if (fetchError || !match) return { error: fetchError?.message ?? 'Match not found' }

  const roundField = match.round as unknown as { name: string } | { name: string }[] | null
  const roundObj = Array.isArray(roundField) ? roundField[0] : roundField
  const roundName = roundObj?.name
  const isKnockout = roundName !== undefined && roundName !== 'group_stage'

  // Group stage keeps no winner / no penalties; the result can stand as a draw.
  let winnerTeamId: string | null = null
  let homePens: number | null = null
  let awayPens: number | null = null

  if (isKnockout) {
    if (!match.home_team_id || !match.away_team_id) {
      return { error: 'Assign both teams before entering a knockout result' }
    }
    if (homeScore > awayScore) {
      winnerTeamId = match.home_team_id
    } else if (awayScore > homeScore) {
      winnerTeamId = match.away_team_id
    } else {
      // Tied after regulation — the shootout decides.
      if (homePenalties === null || awayPenalties === null) {
        return { error: 'Tied match — enter penalty scores to decide the winner' }
      }
      if (homePenalties === awayPenalties) {
        return { error: 'Penalty scores cannot be equal' }
      }
      winnerTeamId = homePenalties > awayPenalties ? match.home_team_id : match.away_team_id
      homePens = homePenalties
      awayPens = awayPenalties
    }
  }

  const { error } = await admin
    .from('matches')
    .update({
      home_score: homeScore,
      away_score: awayScore,
      home_penalties: homePens,
      away_penalties: awayPens,
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
      home_penalties: null,
      away_penalties: null,
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
