'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/fetchAllRows'
import { calculatePoints } from './engine'
import { classifyKnockoutMatch, PREV_ELIGIBILITY_ROUND } from './knockoutEligibility'
import { ROUND_POINTS, QUALIFICATION_POINTS, BEST_THIRD_POINTS } from '@/lib/constants/rounds'
import { computeGroupStandings } from '@/lib/standings/groupStandings'
import type { RoundName, Team, MatchWithTeams } from '@/types/app'

// Qualification scoring per group. Point values come from QUALIFICATION_POINTS so the
// Rules page and this engine never drift. The rule:
//   - exactFirst  (4): 1st-place pick finishes 1st
//   - exactSecond (3): 2nd-place pick finishes 2nd
//   - exactThird  (2): 3rd-place pick finishes 3rd AND that team is a best-8 qualified
//                      third. A 3rd-place team that does NOT make the best 8 scores 0.
//   - consolation (1): any pick that still qualifies to the Round of 32 — as group
//                      winner, runner-up, or a best-8 third — but in a different
//                      position than predicted.
// A pick whose team fails to qualify to the Round of 32 scores nothing.
function scoreQualification(
  predicted1st: string | null,
  predicted2nd: string | null,
  predicted3rd: string | null,
  actualStandings: { teamId: string }[],
  bestThirdQualifiedIds: Set<string>
): number {
  const actual1st = actualStandings[0]?.teamId ?? null
  const actual2nd = actualStandings[1]?.teamId ?? null
  const actual3rd = actualStandings[2]?.teamId ?? null
  const qualifyingIds = [actual1st, actual2nd].filter(Boolean) as string[]

  let pts = 0

  if (predicted1st) {
    if (predicted1st === actual1st) pts += QUALIFICATION_POINTS.exactFirst
    else if (qualifyingIds.includes(predicted1st)) pts += QUALIFICATION_POINTS.consolation
    else if (predicted1st === actual3rd && bestThirdQualifiedIds.has(actual3rd)) pts += QUALIFICATION_POINTS.consolation
  }

  if (predicted2nd) {
    if (predicted2nd === actual2nd) pts += QUALIFICATION_POINTS.exactSecond
    else if (qualifyingIds.includes(predicted2nd)) pts += QUALIFICATION_POINTS.consolation
    else if (predicted2nd === actual3rd && bestThirdQualifiedIds.has(actual3rd)) pts += QUALIFICATION_POINTS.consolation
  }

  if (predicted3rd && actual3rd) {
    if (predicted3rd === actual3rd) {
      // only award the exact-3rd points if the team actually qualified as a best-8 third
      if (bestThirdQualifiedIds.has(actual3rd)) pts += QUALIFICATION_POINTS.exactThird
    } else if (qualifyingIds.includes(predicted3rd)) {
      pts += QUALIFICATION_POINTS.consolation
    }
  }

  return pts
}

export async function recalculateRound(roundId: string): Promise<{ error?: string }> {
  const supabase = getSupabaseAdminClient()

  // Claim the recalculation lock atomically: the conditional `calculating = false`
  // filter means a second concurrent trigger matches zero rows and bails out, rather
  // than interleaving point updates with the in-flight run. Done before the try/finally
  // so a rejected caller can't clear the lock that the active run owns.
  const { data: claimed } = await supabase
    .from('rounds')
    .update({ calculating: true })
    .eq('id', roundId)
    .eq('calculating', false)
    .select('id')

  if (!claimed || claimed.length === 0) {
    return { error: 'Recalculation already in progress for this round' }
  }

  try {
    // Entries whose predictions were zeroed out because their match result was
    // cleared. Tracked here so the final re-sum includes them even if they have
    // no predictions on the remaining confirmed matches.
    let staleEntryIds: string[] = []

    // Snapshot every entry's current rank before points change
    const { data: currentRanks } = await supabase
      .from('leaderboard')
      .select('entry_id, rank')
    if (currentRanks && currentRanks.length > 0) {
      await Promise.all(
        currentRanks.map((row) =>
          supabase
            .from('entries')
            .update({ rank_snapshot: row.rank })
            .eq('id', row.entry_id)
        )
      )
    }

    const { data: round } = await supabase
      .from('rounds')
      .select('name')
      .eq('id', roundId)
      .single()

    if (!round) return { error: 'Round not found' }

    // ---------- Match predictions ----------
    // Fetch ALL matches in the round so we can zero out stale points on
    // unconfirmed ones (e.g. a result that was cleared after points were awarded).
    const { data: allRoundMatches } = await supabase
      .from('matches')
      .select('id, home_team_id, away_team_id, home_score, away_score, home_penalties, away_penalties, winner_team_id, result_confirmed')
      .eq('round_id', roundId)

    const confirmed = (allRoundMatches ?? []).filter((m) => m.result_confirmed)
    const unconfirmed = (allRoundMatches ?? []).filter((m) => !m.result_confirmed)

    // Zero out stale points on predictions for matches whose result has been
    // cleared since the last recalculation.
    if (unconfirmed.length > 0) {
      const uncIds = unconfirmed.map((m) => m.id)
      const { data: stalePreds } = await supabase
        .from('predictions')
        .select('entry_id')
        .in('match_id', uncIds)
        .not('points_awarded', 'is', null)

      if (stalePreds && stalePreds.length > 0) {
        await supabase
          .from('predictions')
          .update({ points_awarded: null, qualification_gated: false, calculated_at: null })
          .in('match_id', uncIds)

        // Track these entries so their totals get re-summed later.
        staleEntryIds = Array.from(new Set(stalePreds.map((p) => p.entry_id)))
      }
    }

    // After zeroing stale predictions, if no confirmed results remain we still
    // need to re-sum the affected entries (whose totals are now wrong).
    if (confirmed.length === 0) {
      if (staleEntryIds.length > 0) {
        const now = new Date().toISOString()
        for (const entryId of staleEntryIds) {
          const [{ data: preds }, { data: quals }, { data: thirds }] = await Promise.all([
            supabase.from('predictions').select('points_awarded').eq('entry_id', entryId),
            supabase.from('group_qualifications').select('points_awarded').eq('entry_id', entryId),
            supabase.from('entry_best_third_selections').select('points_awarded').eq('entry_id', entryId),
          ])
          const total =
            (preds ?? []).reduce((s, p) => s + (p.points_awarded ?? 0), 0) +
            (quals ?? []).reduce((s, q) => s + (q.points_awarded ?? 0), 0) +
            (thirds ?? []).reduce((s, t) => s + (t.points_awarded ?? 0), 0)
          await supabase.from('entries').update({ total_points: total, updated_at: now }).eq('id', entryId)
        }
      }
      return { error: 'No confirmed results in this round' }
    }

    const matches = confirmed
    const matchIds = matches.map((m) => m.id)
    const matchMap = new Map(matches.map((m) => [m.id, m]))

    const predictions = await fetchAllRows<{
      id: string; entry_id: string; match_id: string;
      predicted_home: number | null; predicted_away: number | null;
      predicted_home_penalties: number | null; predicted_away_penalties: number | null;
      predicted_winner_team_id: string | null;
    }>(() =>
      supabase
        .from('predictions')
        .select('id, entry_id, match_id, predicted_home, predicted_away, predicted_home_penalties, predicted_away_penalties, predicted_winner_team_id')
        .in('match_id', matchIds)
        .order('id')
    )

    // Knockout rounds are scored entirely from match predictions, so with none there's
    // nothing to do. Group stage also scores qualification + best-third picks, which are
    // independent of match predictions — so we must NOT early-exit there.
    // However, if stale entries were zeroed above, we must re-sum before leaving.
    if (predictions.length === 0 && round.name !== 'group_stage') {
      if (staleEntryIds.length > 0) {
        const now = new Date().toISOString()
        for (const entryId of staleEntryIds) {
          const [{ data: preds }, { data: quals }, { data: thirds }] = await Promise.all([
            supabase.from('predictions').select('points_awarded').eq('entry_id', entryId),
            supabase.from('group_qualifications').select('points_awarded').eq('entry_id', entryId),
            supabase.from('entry_best_third_selections').select('points_awarded').eq('entry_id', entryId),
          ])
          const total =
            (preds ?? []).reduce((s, p) => s + (p.points_awarded ?? 0), 0) +
            (quals ?? []).reduce((s, q) => s + (q.points_awarded ?? 0), 0) +
            (thirds ?? []).reduce((s, t) => s + (t.points_awarded ?? 0), 0)
          await supabase.from('entries').update({ total_points: total, updated_at: now }).eq('id', entryId)
        }
      }
      return { error: 'No predictions found for confirmed matches' }
    }

    const now = new Date().toISOString()

    // Derive affected entry IDs up-front so the eligibility query can use them.
    // For the group stage, entries that only made qualification / best-third picks (and
    // no match predictions) must still be scored, so union those in below.
    // Also include entries that had stale points zeroed out above so their totals
    // are re-summed even if they have no predictions on confirmed matches.
    const affectedEntryIds = new Set([
      ...predictions.map((p) => p.entry_id),
      ...staleEntryIds,
    ])

    if (round.name === 'group_stage') {
      const qualEntryRows = await fetchAllRows<{ entry_id: string }>(() =>
        supabase.from('group_qualifications').select('entry_id').order('id')
      )
      for (const r of qualEntryRows) affectedEntryIds.add(r.entry_id)

      const thirdEntryRows = await fetchAllRows<{ entry_id: string }>(() =>
        supabase.from('entry_best_third_selections').select('entry_id').order('id')
      )
      for (const r of thirdEntryRows) affectedEntryIds.add(r.entry_id)
    }

    // Array form for PostgREST `.in()` filters (the Set is used for iteration/membership).
    const affectedEntryIdList = Array.from(affectedEntryIds)

    // ---------- Build per-entry eligibility map for knockout rounds ----------
    // A team is "yours" for a knockout matchup if you correctly had it advancing into
    // this round. The source depends on the round:
    //   round_of_32 → teams you predicted 1st/2nd from groups + your best-8 third picks
    //   deeper      → teams you picked to WIN their match in the previous round
    // Entries with no eligibility data at all are excluded from gating (full scoring),
    // matching the prior behavior so entries that never made picks aren't nuked.
    const eligibilityMap = new Map<string, Set<string>>() // entry_id → Set<team_id>
    const addEligible = (entryId: string, teamId: string | null) => {
      if (!teamId) return
      if (!eligibilityMap.has(entryId)) eligibilityMap.set(entryId, new Set())
      eligibilityMap.get(entryId)!.add(teamId)
    }

    if (round.name === 'round_of_32') {
      const allQualRows = await fetchAllRows<{
        entry_id: string
        predicted_1st_team_id: string | null
        predicted_2nd_team_id: string | null
      }>(() =>
        supabase
          .from('group_qualifications')
          .select('entry_id, predicted_1st_team_id, predicted_2nd_team_id')
          .in('entry_id', affectedEntryIdList)
          .order('id')
      )
      for (const row of allQualRows) {
        addEligible(row.entry_id, row.predicted_1st_team_id)
        addEligible(row.entry_id, row.predicted_2nd_team_id)
      }

      const allThirdRows = await fetchAllRows<{ entry_id: string; team_id: string }>(() =>
        supabase
          .from('entry_best_third_selections')
          .select('entry_id, team_id')
          .in('entry_id', affectedEntryIdList)
          .order('id')
      )
      for (const row of allThirdRows) {
        addEligible(row.entry_id, row.team_id)
      }
    } else if (round.name !== 'group_stage') {
      // Eligibility = teams the entry picked to win in the previous round.
      const prevRoundName = PREV_ELIGIBILITY_ROUND[round.name as RoundName]
      if (prevRoundName) {
        const { data: prevRound } = await supabase
          .from('rounds')
          .select('id')
          .eq('name', prevRoundName)
          .single()

        if (prevRound) {
          const { data: prevMatches } = await supabase
            .from('matches')
            .select('id')
            .eq('round_id', prevRound.id)
          const prevMatchIds = (prevMatches ?? []).map((m) => m.id)

          if (prevMatchIds.length > 0) {
            const prevPreds = await fetchAllRows<{
              entry_id: string
              predicted_winner_team_id: string | null
            }>(() =>
              supabase
                .from('predictions')
                .select('entry_id, predicted_winner_team_id')
                .in('match_id', prevMatchIds)
                .in('entry_id', affectedEntryIdList)
                .order('id')
            )
            for (const p of prevPreds) {
              addEligible(p.entry_id, p.predicted_winner_team_id)
            }
          }
        }
      }
    }

    const isKnockout = round.name !== 'group_stage'
    const winnerPoints = isKnockout ? ROUND_POINTS[round.name as RoundName].winner : 0

    const updatedPredictions = predictions.map((pred) => {
      const match = matchMap.get(pred.match_id)!

      // Defensive: skip scoring for knockout matches missing winner_team_id.
      // Returning null avoids overwriting a previously correct score with 0
      // when match data is temporarily invalid (e.g. after revertToApi for penalty matches).
      if (isKnockout && match.winner_team_id === null) {
        return { id: pred.id, entry_id: pred.entry_id, points_awarded: null, qualification_gated: false }
      }

      let points = calculatePoints(
        {
          predicted_home: pred.predicted_home,
          predicted_away: pred.predicted_away,
          predicted_home_penalties: pred.predicted_home_penalties,
          predicted_away_penalties: pred.predicted_away_penalties,
          predicted_winner_team_id: pred.predicted_winner_team_id,
        },
        {
          home_score: match.home_score,
          away_score: match.away_score,
          home_penalties: match.home_penalties,
          away_penalties: match.away_penalties,
          winner_team_id: match.winner_team_id,
        },
        round.name as RoundName
      )

      // Knockout eligibility gating: classify the matchup by how many of its two
      // actual teams the entry owns, then score accordingly.
      let qualification_gated = false
      if (isKnockout && eligibilityMap.has(pred.entry_id)) {
        const eligibleSet = eligibilityMap.get(pred.entry_id)!
        const { status, forcedWinnerTeamId } = classifyKnockoutMatch(
          match.home_team_id,
          match.away_team_id,
          (teamId) => eligibleSet.has(teamId)
        )

        if (status === 'void') {
          // Neither team was yours — no points possible.
          points = 0
          qualification_gated = true
        } else if (status === 'partial') {
          // Forced to have your one eligible team win: advance points only (no bonus),
          // and only if that team actually won. Your own pick/scoreline are ignored.
          points = match.winner_team_id === forcedWinnerTeamId ? winnerPoints : 0
          qualification_gated = true
        }
        // status === 'full' → keep normal calculatePoints result.
      }

      return { id: pred.id, entry_id: pred.entry_id, points_awarded: points, qualification_gated }
    })

    for (const pred of updatedPredictions) {
      // Skip predictions where scoring was deferred (null winner_team_id in knockout)
      if (pred.points_awarded === null) continue
      await supabase
        .from('predictions')
        .update({ points_awarded: pred.points_awarded, qualification_gated: pred.qualification_gated, calculated_at: now })
        .eq('id', pred.id)
    }

    // ---------- Fetch best-8 third-place teams once (used in both qualification scoring and best-8 third selections scoring) ----------
    let bestThirdQualifiedIds = new Set<string>()
    if (round.name === 'group_stage') {
      const { data: advancingThirds } = await supabase
        .from('teams')
        .select('id')
        .eq('best_third_qualified', true)

      bestThirdQualifiedIds = new Set((advancingThirds ?? []).map((t) => t.id))
    }

    // ---------- Group qualification scoring (group_stage only) ----------
    if (round.name === 'group_stage') {
      const { data: groups } = await supabase.from('groups').select('id, name')

      for (const group of groups ?? []) {
        const { data: teamsData } = await supabase
          .from('teams')
          .select('*')
          .eq('group_id', group.id)

        const { data: groupMatchesData } = await supabase
          .from('matches')
          .select(`
            *,
            home_team:teams!matches_home_team_id_fkey(*),
            away_team:teams!matches_away_team_id_fkey(*)
          `)
          .eq('group_id', group.id)
          .eq('result_confirmed', true)

        const teams = (teamsData ?? []) as Team[]
        const groupMatches = (groupMatchesData ?? []) as unknown as MatchWithTeams[]

        if (groupMatches.length < 6) continue // not all confirmed

        // Prefer admin-confirmed positions when every team in the group has one.
        // This handles cases where the deterministic sort (Pts → GD → GF → name)
        // disagrees with FIFA's official tiebreaker (H2H, fair play, drawing of
        // lots) that the app cannot compute.
        const allConfirmed = teams.length > 0 && teams.every(t => t.confirmed_position !== null)
        let actualStandings: { teamId: string }[]
        if (allConfirmed) {
          const sorted = [...teams].sort((a, b) => a.confirmed_position! - b.confirmed_position!)
          actualStandings = sorted.map(t => ({ teamId: t.id }))
        } else {
          const standings = computeGroupStandings(teams, groupMatches)
          actualStandings = standings.map((s) => ({ teamId: s.team.id }))
        }

        const quals = await fetchAllRows<{
          id: string
          entry_id: string
          predicted_1st_team_id: string | null
          predicted_2nd_team_id: string | null
          predicted_3rd_team_id: string | null
        }>(() =>
          supabase
            .from('group_qualifications')
            .select('id, entry_id, predicted_1st_team_id, predicted_2nd_team_id, predicted_3rd_team_id')
            .eq('group_id', group.id)
            .in('entry_id', affectedEntryIdList)
            .order('id')
        )

        for (const qual of quals) {
          const pts = scoreQualification(
            qual.predicted_1st_team_id,
            qual.predicted_2nd_team_id,
            qual.predicted_3rd_team_id,
            actualStandings,
            bestThirdQualifiedIds
          )
          await supabase
            .from('group_qualifications')
            .update({ points_awarded: pts, calculated_at: now })
            .eq('id', qual.id)
        }
      }
    }

    // ---------- Score best-8 third-place selections (group_stage only) ----------
    if (round.name === 'group_stage') {
      const thirdSelections = await fetchAllRows<{
        id: string
        entry_id: string
        team_id: string
      }>(() =>
        supabase
          .from('entry_best_third_selections')
          .select('id, entry_id, team_id')
          .in('entry_id', affectedEntryIdList)
          .order('id')
      )

      for (const sel of thirdSelections) {
        const pts = bestThirdQualifiedIds.has(sel.team_id) ? BEST_THIRD_POINTS : 0
        await supabase
          .from('entry_best_third_selections')
          .update({ points_awarded: pts, calculated_at: now })
          .eq('id', sel.id)
      }
    }

    // ---------- Re-sum total_points (match predictions + qualifications + best-8 thirds) ----------
    for (const entryId of affectedEntryIdList) {
      const { data: allPreds } = await supabase
        .from('predictions')
        .select('points_awarded')
        .eq('entry_id', entryId)

      const { data: allQuals } = await supabase
        .from('group_qualifications')
        .select('points_awarded')
        .eq('entry_id', entryId)

      const { data: allThirdSelections } = await supabase
        .from('entry_best_third_selections')
        .select('points_awarded')
        .eq('entry_id', entryId)

      const total =
        (allPreds ?? []).reduce((sum, p) => sum + (p.points_awarded ?? 0), 0) +
        (allQuals ?? []).reduce((sum, q) => sum + (q.points_awarded ?? 0), 0) +
        (allThirdSelections ?? []).reduce((sum, s) => sum + (s.points_awarded ?? 0), 0)

      await supabase
        .from('entries')
        .update({ total_points: total, updated_at: now })
        .eq('id', entryId)
    }

    return {}
  } finally {
    await supabase.from('rounds').update({ calculating: false }).eq('id', roundId)
  }
}
