'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { fetchAllRows } from '@/lib/supabase/fetchAllRows'
import { calculatePoints } from './engine'
import { classifyKnockoutMatch, PREV_ELIGIBILITY_ROUND } from './knockoutEligibility'
import { ROUND_POINTS } from '@/lib/constants/rounds'
import { computeGroupStandings } from '@/lib/standings/groupStandings'
import type { RoundName, Team, MatchWithTeams } from '@/types/app'

// Qualification scoring per group
function scoreQualification(
  predicted1st: string | null,
  predicted2nd: string | null,
  predicted3rd: string | null,
  actualStandings: { teamId: string }[]
): number {
  const actual1st = actualStandings[0]?.teamId ?? null
  const actual2nd = actualStandings[1]?.teamId ?? null
  const actual3rd = actualStandings[2]?.teamId ?? null
  const qualifyingIds = [actual1st, actual2nd].filter(Boolean) as string[]

  let pts = 0

  if (predicted1st) {
    if (predicted1st === actual1st) pts += 4
    else if (qualifyingIds.includes(predicted1st)) pts += 1
    else if (predicted1st === actual3rd) pts += 1
  }

  if (predicted2nd) {
    if (predicted2nd === actual2nd) pts += 3
    else if (qualifyingIds.includes(predicted2nd)) pts += 1
    else if (predicted2nd === actual3rd) pts += 1
  }

  if (predicted3rd && actual3rd) {
    if (predicted3rd === actual3rd) pts += 2
    else if (qualifyingIds.includes(predicted3rd)) pts += 1
  }

  return pts
}

export async function recalculateRound(roundId: string): Promise<{ error?: string }> {
  const supabase = getSupabaseAdminClient()

  await supabase.from('rounds').update({ calculating: true }).eq('id', roundId)

  try {
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
    const { data: matches } = await supabase
      .from('matches')
      .select('id, home_team_id, away_team_id, home_score, away_score, home_penalties, away_penalties, winner_team_id')
      .eq('round_id', roundId)
      .eq('result_confirmed', true)

    if (!matches || matches.length === 0) {
      return { error: 'No confirmed results in this round' }
    }

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

    if (predictions.length === 0) {
      return { error: 'No predictions found for confirmed matches' }
    }

    const now = new Date().toISOString()

    // Derive affected entry IDs up-front so the eligibility query can use them
    const affectedEntryIds = Array.from(new Set(predictions.map((p) => p.entry_id)))

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
      const { data: allQualRows } = await supabase
        .from('group_qualifications')
        .select('entry_id, predicted_1st_team_id, predicted_2nd_team_id')
        .in('entry_id', affectedEntryIds)
      for (const row of allQualRows ?? []) {
        addEligible(row.entry_id, row.predicted_1st_team_id)
        addEligible(row.entry_id, row.predicted_2nd_team_id)
      }

      const { data: allThirdRows } = await supabase
        .from('entry_best_third_selections')
        .select('entry_id, team_id')
        .in('entry_id', affectedEntryIds)
      for (const row of allThirdRows ?? []) {
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
            const { data: prevPreds } = await supabase
              .from('predictions')
              .select('entry_id, predicted_winner_team_id')
              .in('match_id', prevMatchIds)
              .in('entry_id', affectedEntryIds)
            for (const p of prevPreds ?? []) {
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
      await supabase
        .from('predictions')
        .update({ points_awarded: pred.points_awarded, qualification_gated: pred.qualification_gated, calculated_at: now })
        .eq('id', pred.id)
    }

    // affectedEntryIds already declared above

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

        const standings = computeGroupStandings(teams, groupMatches)
        const actualStandings = standings.map((s) => ({ teamId: s.team.id }))

        const { data: quals } = await supabase
          .from('group_qualifications')
          .select('id, entry_id, predicted_1st_team_id, predicted_2nd_team_id, predicted_3rd_team_id')
          .eq('group_id', group.id)
          .in('entry_id', affectedEntryIds)

        for (const qual of quals ?? []) {
          const pts = scoreQualification(
            qual.predicted_1st_team_id,
            qual.predicted_2nd_team_id,
            qual.predicted_3rd_team_id,
            actualStandings
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
      const { data: advancingThirds } = await supabase
        .from('teams')
        .select('id')
        .eq('best_third_qualified', true)

      const advancingIds = new Set((advancingThirds ?? []).map((t) => t.id))

      const { data: thirdSelections } = await supabase
        .from('entry_best_third_selections')
        .select('id, entry_id, team_id')
        .in('entry_id', affectedEntryIds)

      for (const sel of thirdSelections ?? []) {
        const pts = advancingIds.has(sel.team_id) ? 1 : 0
        await supabase
          .from('entry_best_third_selections')
          .update({ points_awarded: pts, calculated_at: now })
          .eq('id', sel.id)
      }
    }

    // ---------- Re-sum total_points (match predictions + qualifications + best-8 thirds) ----------
    for (const entryId of affectedEntryIds) {
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
