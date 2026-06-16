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

  // Reset points on predictions that referenced this match so they don't
  // leave stale awarded values in the leaderboard / bracket views.
  const { data: affectedPreds } = await admin
    .from('predictions')
    .select('entry_id')
    .eq('match_id', matchId)
    .not('points_awarded', 'is', null)

  await admin
    .from('predictions')
    .update({ points_awarded: null, qualification_gated: false, calculated_at: null })
    .eq('match_id', matchId)

  // Re-sum total_points for every entry that had points from this match.
  const affectedEntryIds = Array.from(new Set((affectedPreds ?? []).map((p) => p.entry_id)))
  for (const entryId of affectedEntryIds) {
    const [{ data: preds }, { data: quals }, { data: thirds }] = await Promise.all([
      admin.from('predictions').select('points_awarded').eq('entry_id', entryId),
      admin.from('group_qualifications').select('points_awarded').eq('entry_id', entryId),
      admin.from('entry_best_third_selections').select('points_awarded').eq('entry_id', entryId),
    ])

    const total =
      (preds ?? []).reduce((s, p) => s + (p.points_awarded ?? 0), 0) +
      (quals ?? []).reduce((s, q) => s + (q.points_awarded ?? 0), 0) +
      (thirds ?? []).reduce((s, t) => s + (t.points_awarded ?? 0), 0)

    await admin
      .from('entries')
      .update({ total_points: total, updated_at: new Date().toISOString() })
      .eq('id', entryId)
  }

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
  revalidatePath('/leaderboard')
  revalidatePath('/dashboard')
  revalidatePath('/entries', 'layout')
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

  // Prefer the atomic RPC (migration 015) when available; fall back to
  // sequential queries if the function hasn't been applied yet.
  const { error: rpcError } = await admin.rpc('clear_all_results', { admin_email: adminEmail })

  if (!rpcError) {
    // RPC succeeded — every step ran in a single transaction.
    // Clear confirmed_position (added after the RPC was created).
    const { error: posErr } = await admin
      .from('teams')
      .update({ confirmed_position: null })
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (posErr) return { error: posErr.message }
  } else if (rpcError.message?.includes('schema cache')) {
    // Function not yet deployed — execute the same steps inline.

    // 1. Clear scores/results on ALL matches
    const { error: e1 } = await admin
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
      .neq('id', '00000000-0000-0000-0000-000000000000') // match all rows

    if (e1) return { error: e1.message }

    // 2. Clear knockout team assignments (non-group-stage matches)
    const { data: koRounds } = await admin
      .from('rounds')
      .select('id')
      .neq('name', 'group_stage')

    if (koRounds && koRounds.length > 0) {
      const { error: e2 } = await admin
        .from('matches')
        .update({ home_team_id: null, away_team_id: null })
        .in('round_id', koRounds.map((r) => r.id))

      if (e2) return { error: e2.message }
    }

    // 3. Reset best-third-qualified flags and confirmed standings on all teams
    const { error: e3 } = await admin
      .from('teams')
      .update({ best_third_qualified: false, confirmed_position: null })
      .neq('id', '00000000-0000-0000-0000-000000000000')

    if (e3) return { error: e3.message }

    // 4. Clear awarded scoring (picks themselves are preserved)
    const { error: e4 } = await admin
      .from('predictions')
      .update({ points_awarded: null, qualification_gated: false, calculated_at: null })
      .neq('id', '00000000-0000-0000-0000-000000000000') // match all rows

    if (e4) return { error: e4.message }

    const { error: e5 } = await admin
      .from('group_qualifications')
      .update({ points_awarded: null, calculated_at: null })
      .neq('id', '00000000-0000-0000-0000-000000000000') // match all rows

    if (e5) return { error: e5.message }

    const { error: e6 } = await admin
      .from('entry_best_third_selections')
      .update({ points_awarded: null, calculated_at: null })
      .neq('id', '00000000-0000-0000-0000-000000000000') // match all rows

    if (e6) return { error: e6.message }

    // 5. Zero the leaderboard
    const { error: e7 } = await admin
      .from('entries')
      .update({ total_points: 0, rank_snapshot: null, updated_at: new Date().toISOString() })
      .neq('id', '00000000-0000-0000-0000-000000000000') // match all rows

    if (e7) return { error: e7.message }

    // 6. Log the bulk clear
    await admin.from('change_log').insert({
      entity_type: 'system',
      entity_id: '00000000-0000-0000-0000-000000000000',
      field: 'clear_all_results',
      old_value: null,
      new_value: null,
      source: 'manual',
      changed_by: adminEmail,
    })
  } else {
    return { error: rpcError.message }
  }

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
