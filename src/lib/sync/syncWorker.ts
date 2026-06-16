/**
 * Core sync logic — server-side only.
 * Upserts football-data.org match results into the local matches table,
 * respects manual overrides, tracks drift, and writes change_log rows.
 */

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { fetchWCMatches, fetchWCTeams } from './footballData'
import type { FdMatch } from './footballData'
import type { RoundName } from '@/types/database'

export interface SyncResult {
  matchesSeen: number
  matchesChanged: number
  driftCount: number
  errors: string[]
}

interface LocalMatch {
  id: string
  fd_match_id: number | null
  match_number: number
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
  apiMatch: FdMatch
): ChangeField[] {
  const changes: ChangeField[] = []
  const ft = apiMatch.score.fullTime

  if (ft.home !== null && ft.home !== local.home_score) {
    changes.push({ field: 'home_score', oldValue: str(local.home_score), newValue: str(ft.home) })
  }
  if (ft.away !== null && ft.away !== local.away_score) {
    changes.push({ field: 'away_score', oldValue: str(local.away_score), newValue: str(ft.away) })
  }

  return changes
}

function hasDrift(local: LocalMatch, apiMatch: FdMatch): boolean {
  const ft = apiMatch.score.fullTime
  if (ft.home === null || ft.away === null) return false
  return ft.home !== local.home_score || ft.away !== local.away_score
}

export async function runSync(): Promise<SyncResult> {
  const supabase = getSupabaseAdminClient()
  const result: SyncResult = { matchesSeen: 0, matchesChanged: 0, driftCount: 0, errors: [] }

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
      .select('id, fd_match_id, match_number, home_team_id, away_team_id, home_score, away_score, home_penalties, away_penalties, winner_team_id, result_confirmed, is_manual_override, api_home_score, api_away_score, api_status')

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
        if (hasDrift(local, apiMatch)) {
          result.driftCount++
        }
        continue
      }

      // Only process FINISHED matches for score updates
      if (apiMatch.status !== 'FINISHED') continue

      const changes = diffFields(local, apiMatch)
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

/**
 * Maps football-data.org stage values to local round names.
 * Used to match knockout API matches with local matches by (stage, team pair).
 */
const FD_STAGE_TO_ROUND: Record<string, RoundName> = {
  LAST_32: 'round_of_32',
  LAST_16: 'round_of_16',
  QUARTER_FINALS: 'quarterfinals',
  SEMI_FINALS: 'semifinals',
  THIRD_PLACE: 'third_place',
  FINAL: 'final',
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

  // Load local matches with round info for knockout stage matching
  const { data: localMatches } = await supabase
    .from('matches')
    .select('id, match_number, home_team_id, away_team_id, fd_match_id, round_id')

  if (!localMatches) return { mapped: 0, unmatched: 0 }

  // Load rounds for round_id → round name mapping
  const { data: rounds } = await supabase
    .from('rounds')
    .select('id, name')
  const roundNameById = new Map<string, RoundName>()
  for (const r of rounds ?? []) {
    roundNameById.set(r.id, r.name)
  }

  // Build lookup: (homeTeamUuid, awayTeamUuid) → local match
  const byTeamPair = new Map<string, typeof localMatches[number]>()
  for (const m of localMatches) {
    if (m.home_team_id && m.away_team_id) {
      byTeamPair.set(`${m.home_team_id}|${m.away_team_id}`, m)
    }
  }

  // Build lookup: (roundName, homeTeamUuid, awayTeamUuid) → local match
  // Used as fallback for knockout matching by (stage, team pair)
  const byRoundAndTeamPair = new Map<string, typeof localMatches[number]>()
  for (const m of localMatches) {
    if (m.home_team_id && m.away_team_id) {
      const roundName = roundNameById.get(m.round_id)
      if (roundName && roundName !== 'group_stage') {
        byRoundAndTeamPair.set(`${roundName}|${m.home_team_id}|${m.away_team_id}`, m)
      }
    }
  }

  // Track which local matches get mapped (by id) so we don't double-map
  const mappedLocalIds = new Set<string>()
  for (const m of localMatches) {
    if (m.fd_match_id !== null) mappedLocalIds.add(m.id)
  }

  let mapped = 0
  let unmatched = 0

  for (const apiMatch of apiMatches) {
    const homeUuid = apiMatch.homeTeam.id ? uuidByFdTeamId.get(apiMatch.homeTeam.id) : undefined
    const awayUuid = apiMatch.awayTeam.id ? uuidByFdTeamId.get(apiMatch.awayTeam.id) : undefined

    if (!homeUuid || !awayUuid) {
      // Knockout matches where the API hasn't yet populated teams will land here.
      // Re-run seed after knockout teams are assigned in both the local DB and the API.
      unmatched++
      continue
    }

    // Try direct team-pair match (works for group stage and any knockout match)
    let local = byTeamPair.get(`${homeUuid}|${awayUuid}`)
      ?? byTeamPair.get(`${awayUuid}|${homeUuid}`)

    // Fallback: match by (stage, team pair) for knockout reliability
    if (!local) {
      const roundName = FD_STAGE_TO_ROUND[apiMatch.stage]
      if (roundName) {
        local = byRoundAndTeamPair.get(`${roundName}|${homeUuid}|${awayUuid}`)
          ?? byRoundAndTeamPair.get(`${roundName}|${awayUuid}|${homeUuid}`)
      }
    }

    if (!local) {
      unmatched++
      continue
    }

    if (mappedLocalIds.has(local.id) && local.fd_match_id === apiMatch.id) {
      continue // already correctly mapped
    }

    await supabase
      .from('matches')
      .update({ fd_match_id: apiMatch.id, scheduled_at: apiMatch.utcDate })
      .eq('id', local.id)
    mappedLocalIds.add(local.id)
    mapped++
  }

  return { mapped, unmatched }
}
