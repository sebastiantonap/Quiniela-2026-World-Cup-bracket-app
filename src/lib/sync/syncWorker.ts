/**
 * Core sync logic — server-side only.
 * Upserts football-data.org match results into the local matches table,
 * respects manual overrides, tracks drift, and writes change_log rows.
 */

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { fetchWCMatches, fetchWCTeams } from './footballData'
import { recalculateRound } from '@/lib/scoring/recalculate'
import type { FdMatch } from './footballData'

export interface SyncResult {
  matchesSeen: number
  matchesChanged: number
  driftCount: number
  roundsRecalculated: number
  errors: string[]
}

interface LocalMatch {
  id: string
  fd_match_id: number | null
  match_number: number
  round_id: string
  home_team_id: string | null
  away_team_id: string | null
  home_score: number | null
  away_score: number | null
  home_penalties: number | null
  away_penalties: number | null
  winner_team_id: string | null
  result_confirmed: boolean
  is_manual_override: boolean
  api_home_score: number | null
  api_away_score: number | null
  api_status: string | null
}

type ChangeField = {
  field: string
  oldValue: string | null
  newValue: string | null
}

function str(v: unknown): string | null {
  return v === null || v === undefined ? null : String(v)
}

function diffFields(
  local: LocalMatch,
  apiMatch: FdMatch,
  swapped: boolean
): ChangeField[] {
  const changes: ChangeField[] = []
  const ft = apiMatch.score.fullTime

  const effectiveHome = swapped ? ft.away : ft.home
  const effectiveAway = swapped ? ft.home : ft.away

  if (effectiveHome !== null && effectiveHome !== local.home_score) {
    changes.push({ field: 'home_score', oldValue: str(local.home_score), newValue: str(effectiveHome) })
  }
  if (effectiveAway !== null && effectiveAway !== local.away_score) {
    changes.push({ field: 'away_score', oldValue: str(local.away_score), newValue: str(effectiveAway) })
  }

  return changes
}

function hasDrift(local: LocalMatch, apiMatch: FdMatch, swapped: boolean): boolean {
  const ft = apiMatch.score.fullTime
  if (ft.home === null || ft.away === null) return false
  const effectiveHome = swapped ? ft.away : ft.home
  const effectiveAway = swapped ? ft.home : ft.away
  return effectiveHome !== local.home_score || effectiveAway !== local.away_score
}

export async function runSync(): Promise<SyncResult> {
  const supabase = getSupabaseAdminClient()
  const result: SyncResult = { matchesSeen: 0, matchesChanged: 0, driftCount: 0, roundsRecalculated: 0, errors: [] }

  // Create sync_runs row
  const { data: syncRun } = await supabase
    .from('sync_runs')
    .insert({ status: 'running' })
    .select('id')
    .single()
  const syncRunId = syncRun?.id

  try {
    const apiMatches = await fetchWCMatches()
    result.matchesSeen = apiMatches.length

    // Load local matches that have fd_match_id set
    const { data: localMatches } = await supabase
      .from('matches')
      .select('id, fd_match_id, match_number, round_id, home_team_id, away_team_id, home_score, away_score, home_penalties, away_penalties, winner_team_id, result_confirmed, is_manual_override, api_home_score, api_away_score, api_status')

    if (!localMatches) {
      result.errors.push('Failed to fetch local matches')
      if (syncRunId) {
        await supabase.from('sync_runs').update({
          finished_at: new Date().toISOString(),
          status: 'error',
          error_text: 'Failed to fetch local matches',
        }).eq('id', syncRunId)
      }
      return result
    }

    const byFdId = new Map<number, LocalMatch>()
    for (const m of localMatches) {
      if (m.fd_match_id !== null) {
        byFdId.set(m.fd_match_id, m as LocalMatch)
      }
    }

    // Load teams for winner resolution
    const { data: teams } = await supabase
      .from('teams')
      .select('id, fd_team_id')
    const teamByFdId = new Map<number, string>()
    for (const t of teams ?? []) {
      if (t.fd_team_id !== null) teamByFdId.set(t.fd_team_id, t.id)
    }

    const now = new Date().toISOString()
    const affectedRoundIds = new Set<string>()

    for (const apiMatch of apiMatches) {
      const local = byFdId.get(apiMatch.id)
      if (!local) continue // not mapped yet

      const ft = apiMatch.score.fullTime

      // Detect if API home/away order is swapped relative to local match
      const apiHomeUuid = apiMatch.homeTeam.id ? teamByFdId.get(apiMatch.homeTeam.id) ?? null : null
      const swapped = apiHomeUuid !== null && apiHomeUuid !== local.home_team_id

      // Always update api_* columns, scheduled_at, and last_synced_at
      // api_home_score/api_away_score refer to the local match's home/away
      await supabase
        .from('matches')
        .update({
          api_home_score: swapped ? ft.away : ft.home,
          api_away_score: swapped ? ft.home : ft.away,
          api_status: apiMatch.status,
          scheduled_at: apiMatch.utcDate,
          last_synced_at: now,
        })
        .eq('id', local.id)

      if (local.is_manual_override) {
        // Don't overwrite live values; just flag drift
        if (hasDrift(local, apiMatch, swapped)) {
          result.driftCount++
        }
        continue
      }

      // Only process FINISHED matches for score updates
      if (apiMatch.status !== 'FINISHED') continue

      const changes = diffFields(local, apiMatch, swapped)
      if (changes.length === 0 && local.result_confirmed) continue

      // Determine winner
      let winnerTeamId: string | null = null
      const homeTeamUuid = apiHomeUuid
      const awayTeamUuid = apiMatch.awayTeam.id ? teamByFdId.get(apiMatch.awayTeam.id) ?? null : null

      if (ft.home !== null && ft.away !== null) {
        if (ft.home > ft.away) {
          winnerTeamId = homeTeamUuid
        } else if (ft.away > ft.home) {
          winnerTeamId = awayTeamUuid
        } else {
          // Draw or penalties
          const pens = apiMatch.score.penalties
          if (pens.home !== null && pens.away !== null) {
            winnerTeamId = pens.home > pens.away ? homeTeamUuid : awayTeamUuid
          }
        }
      }

      // Penalty scores — swap to match local home/away order
      const pens = apiMatch.score.penalties
      const homePens = pens.home !== null ? pens.home : null
      const awayPens = pens.away !== null ? pens.away : null

      // Update match — scores written relative to local match's home/away
      await supabase
        .from('matches')
        .update({
          home_score: swapped ? ft.away : ft.home,
          away_score: swapped ? ft.home : ft.away,
          home_penalties: swapped ? awayPens : homePens,
          away_penalties: swapped ? homePens : awayPens,
          winner_team_id: winnerTeamId,
          result_confirmed: true,
        })
        .eq('id', local.id)

      // Write change_log rows
      for (const change of changes) {
        await supabase.from('change_log').insert({
          entity_type: 'match',
          entity_id: local.id,
          field: change.field,
          old_value: change.oldValue,
          new_value: change.newValue,
          source: 'api_sync',
          changed_by: null,
        })
      }

      if (!local.result_confirmed) {
        await supabase.from('change_log').insert({
          entity_type: 'match',
          entity_id: local.id,
          field: 'result_confirmed',
          old_value: 'false',
          new_value: 'true',
          source: 'api_sync',
          changed_by: null,
        })
      }

      result.matchesChanged++
      affectedRoundIds.add(local.round_id)
    }

    // Recalculate points for affected rounds
    const benignErrors = new Set([
      'Recalculation already in progress for this round',
      'No confirmed results in this round',
      'No predictions found for confirmed matches',
    ])
    for (const roundId of Array.from(affectedRoundIds)) {
      try {
        const recalcResult = await recalculateRound(roundId)
        if (recalcResult.error && !benignErrors.has(recalcResult.error)) {
          result.errors.push(`Recalculate round ${roundId}: ${recalcResult.error}`)
        } else {
          result.roundsRecalculated++
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        result.errors.push(`Recalculate round ${roundId}: ${msg}`)
      }
    }

    // Update sync_runs
    if (syncRunId) {
      await supabase
        .from('sync_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: result.errors.length > 0 ? 'partial' : 'ok',
          matches_seen: result.matchesSeen,
          matches_changed: result.matchesChanged,
          drift_count: result.driftCount,
          error_text: result.errors.length > 0 ? result.errors.join('; ') : null,
        })
        .eq('id', syncRunId)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.errors.push(msg)
    if (syncRunId) {
      await supabase
        .from('sync_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: 'error',
          error_text: msg,
        })
        .eq('id', syncRunId)
    }
  }

  return result
}

// Known TLA mismatches between football-data.org and local DB
const TLA_ALIASES: Record<string, string> = {
  URY: 'URU', // football-data.org uses URY, local uses URU for Uruguay
}

export async function seedTeamMapping(): Promise<{ mapped: number; unmatched: string[] }> {
  const supabase = getSupabaseAdminClient()
  const apiTeams = await fetchWCTeams()

  const { data: localTeams } = await supabase
    .from('teams')
    .select('id, code, fd_team_id')

  if (!localTeams) return { mapped: 0, unmatched: [] }

  const localByCode = new Map<string, { id: string; fd_team_id: number | null }>()
  for (const t of localTeams) {
    localByCode.set(t.code.toUpperCase(), t)
  }

  let mapped = 0
  const unmatched: string[] = []

  for (const apiTeam of apiTeams) {
    const tla = apiTeam.tla.toUpperCase()
    const local = localByCode.get(tla) ?? localByCode.get(TLA_ALIASES[tla] ?? '')
    if (local) {
      if (local.fd_team_id !== apiTeam.id) {
        await supabase
          .from('teams')
          .update({ fd_team_id: apiTeam.id })
          .eq('id', local.id)
        mapped++
      }
    } else {
      unmatched.push(`${apiTeam.tla} (${apiTeam.name})`)
    }
  }

  return { mapped, unmatched }
}

export async function seedMatchMapping(): Promise<{ mapped: number; unmatched: number }> {
  const supabase = getSupabaseAdminClient()
  const apiMatches = await fetchWCMatches()

  // Load teams for fd_team_id → uuid mapping
  const { data: teams } = await supabase
    .from('teams')
    .select('id, fd_team_id')
  const uuidByFdTeamId = new Map<number, string>()
  for (const t of teams ?? []) {
    if (t.fd_team_id !== null) uuidByFdTeamId.set(t.fd_team_id, t.id)
  }

  // Load local matches
  const { data: localMatches } = await supabase
    .from('matches')
    .select('id, match_number, home_team_id, away_team_id, fd_match_id')

  if (!localMatches) return { mapped: 0, unmatched: 0 }

  // Build lookup: (homeTeamUuid, awayTeamUuid) → local match for group stage
  const byTeamPair = new Map<string, typeof localMatches[number]>()
  for (const m of localMatches) {
    if (m.home_team_id && m.away_team_id) {
      byTeamPair.set(`${m.home_team_id}|${m.away_team_id}`, m)
    }
  }

  let mapped = 0
  let unmatched = 0

  for (const apiMatch of apiMatches) {
    const homeUuid = uuidByFdTeamId.get(apiMatch.homeTeam.id)
    const awayUuid = uuidByFdTeamId.get(apiMatch.awayTeam.id)

    if (!homeUuid || !awayUuid) {
      unmatched++
      continue
    }

    // Try both orderings — API may have home/away swapped vs local DB
    const local = byTeamPair.get(`${homeUuid}|${awayUuid}`)
      ?? byTeamPair.get(`${awayUuid}|${homeUuid}`)
    if (!local) {
      unmatched++
      continue
    }

    if (local.fd_match_id !== apiMatch.id) {
      await supabase
        .from('matches')
        .update({ fd_match_id: apiMatch.id, scheduled_at: apiMatch.utcDate })
        .eq('id', local.id)
      mapped++
    }
  }

  return { mapped, unmatched }
}
