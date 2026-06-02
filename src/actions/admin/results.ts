'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSessionEmail } from '@/lib/session'
import { isAdmin } from '@/lib/auth/isAdmin'
import { revalidatePath } from 'next/cache'

async function assertAdmin(): Promise<string> {
  const email = await getSessionEmail()
  if (!await isAdmin(email)) throw new Error('Unauthorized')
  return email!
}

function str(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v)
}

async function logChange(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  entityId: string,
  field: string,
  oldValue: string | null,
  newValue: string | null,
  source: string,
  changedBy: string | null
) {
  await admin.from('change_log').insert({
    entity_type: 'match',
    entity_id: entityId,
    field,
    old_value: oldValue,
    new_value: newValue,
    source,
    changed_by: changedBy,
  })
}

export async function saveMatchResult(
  matchId: string,
  homeScore: number,
  awayScore: number,
  homePenalties: number | null = null,
  awayPenalties: number | null = null
): Promise<{ error?: string }> {
  let adminEmail: string
  try {
    adminEmail = await assertAdmin()
  } catch {
    return { error: 'Unauthorized' }
  }

  const admin = getSupabaseAdminClient()

  const { data: match, error: fetchError } = await admin
    .from('matches')
    .select('home_team_id, away_team_id, home_score, away_score, home_penalties, away_penalties, result_confirmed, round:rounds(name)')
    .eq('id', matchId)
    .single()

  if (fetchError || !match) return { error: fetchError?.message ?? 'Match not found' }

  const roundField = match.round as unknown as { name: string } | { name: string }[] | null
  const roundObj = Array.isArray(roundField) ? roundField[0] : roundField
  const roundName = roundObj?.name
  const isKnockout = roundName !== undefined && roundName !== 'group_stage'

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
      is_manual_override: true,
    })
    .eq('id', matchId)

  if (error) return { error: error.message }

  // Write change_log rows for changed fields
  if (match.home_score !== homeScore) {
    await logChange(admin, matchId, 'home_score', str(match.home_score), str(homeScore), 'manual', adminEmail)
  }
  if (match.away_score !== awayScore) {
    await logChange(admin, matchId, 'away_score', str(match.away_score), str(awayScore), 'manual', adminEmail)
  }
  if (!match.result_confirmed) {
    await logChange(admin, matchId, 'result_confirmed', 'false', 'true', 'manual', adminEmail)
  }

  revalidatePath('/admin')
  return {}
}

export async function clearMatchResult(matchId: string): Promise<{ error?: string }> {
  let adminEmail: string
  try {
    adminEmail = await assertAdmin()
  } catch {
    return { error: 'Unauthorized' }
  }

  const admin = getSupabaseAdminClient()

  // Fetch current values for change_log
  const { data: match } = await admin
    .from('matches')
    .select('home_score, away_score, result_confirmed')
    .eq('id', matchId)
    .single()

  const { error } = await admin
    .from('matches')
    .update({
      home_score: null,
      away_score: null,
      home_penalties: null,
      away_penalties: null,
      winner_team_id: null,
      result_confirmed: false,
      is_manual_override: false,
    })
    .eq('id', matchId)

  if (error) return { error: error.message }

  if (match) {
    if (match.home_score !== null) {
      await logChange(admin, matchId, 'home_score', str(match.home_score), null, 'manual', adminEmail)
    }
    if (match.away_score !== null) {
      await logChange(admin, matchId, 'away_score', str(match.away_score), null, 'manual', adminEmail)
    }
    if (match.result_confirmed) {
      await logChange(admin, matchId, 'result_confirmed', 'true', 'false', 'manual', adminEmail)
    }
  }

  revalidatePath('/admin')
  return {}
}

export async function revertToApi(matchId: string): Promise<{ error?: string }> {
  let adminEmail: string
  try {
    adminEmail = await assertAdmin()
  } catch {
    return { error: 'Unauthorized' }
  }

  const admin = getSupabaseAdminClient()

  const { data: match, error: fetchError } = await admin
    .from('matches')
    .select('home_score, away_score, api_home_score, api_away_score, api_status, home_team_id, away_team_id, round:rounds(name)')
    .eq('id', matchId)
    .single()

  if (fetchError || !match) return { error: fetchError?.message ?? 'Match not found' }
  if (match.api_home_score === null || match.api_away_score === null) {
    return { error: 'No API data available for this match' }
  }

  const roundField = match.round as unknown as { name: string } | { name: string }[] | null
  const roundObj = Array.isArray(roundField) ? roundField[0] : roundField
  const roundName = roundObj?.name
  const isKnockout = roundName !== undefined && roundName !== 'group_stage'

  let winnerTeamId: string | null = null
  if (isKnockout && match.home_team_id && match.away_team_id) {
    if (match.api_home_score > match.api_away_score) {
      winnerTeamId = match.home_team_id
    } else if (match.api_away_score > match.api_home_score) {
      winnerTeamId = match.away_team_id
    }
  }

  const { error } = await admin
    .from('matches')
    .update({
      home_score: match.api_home_score,
      away_score: match.api_away_score,
      home_penalties: null,
      away_penalties: null,
      winner_team_id: winnerTeamId,
      result_confirmed: match.api_status === 'FINISHED',
      is_manual_override: false,
    })
    .eq('id', matchId)

  if (error) return { error: error.message }

  if (match.home_score !== match.api_home_score) {
    await logChange(admin, matchId, 'home_score', str(match.home_score), str(match.api_home_score), 'manual', adminEmail)
  }
  if (match.away_score !== match.api_away_score) {
    await logChange(admin, matchId, 'away_score', str(match.away_score), str(match.api_away_score), 'manual', adminEmail)
  }
  await logChange(admin, matchId, 'is_manual_override', 'true', 'false', 'manual', adminEmail)

  revalidatePath('/admin')
  return {}
}

export async function clearAllResults(): Promise<{ error?: string }> {
  let adminEmail: string
  try {
    adminEmail = await assertAdmin()
  } catch {
    return { error: 'Unauthorized' }
  }

  const admin = getSupabaseAdminClient()

  // Atomic: all four steps (clear scores, clear KO assignments, reset
  // best-third flags, append change_log row) run inside one Postgres
  // transaction via the clear_all_results RPC. If any statement fails,
  // the entire operation is rolled back — no partially-cleared state.
  // Scope is admin-entered data only; user predictions are untouched.
  const { error } = await admin.rpc('clear_all_results', { admin_email: adminEmail })

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
