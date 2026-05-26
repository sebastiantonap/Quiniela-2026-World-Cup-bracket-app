'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { calculatePoints } from './engine'
import type { RoundName } from '@/types/app'

export async function recalculateRound(roundId: string): Promise<{ error?: string }> {
  const supabase = getSupabaseAdminClient()

  // Mark round as calculating
  await supabase
    .from('rounds')
    .update({ calculating: true })
    .eq('id', roundId)

  try {
    // Fetch round info
    const { data: round } = await supabase
      .from('rounds')
      .select('name')
      .eq('id', roundId)
      .single()

    if (!round) return { error: 'Round not found' }

    // Fetch all confirmed matches in this round
    const { data: matches } = await supabase
      .from('matches')
      .select('id, home_score, away_score, winner_team_id')
      .eq('round_id', roundId)
      .eq('result_confirmed', true)

    if (!matches || matches.length === 0) {
      return { error: 'No confirmed results in this round' }
    }

    const matchIds = matches.map((m) => m.id)
    const matchMap = new Map(matches.map((m) => [m.id, m]))

    // Fetch all predictions for these matches
    const { data: predictions } = await supabase
      .from('predictions')
      .select('id, entry_id, match_id, predicted_home, predicted_away, predicted_winner_team_id')
      .in('match_id', matchIds)

    if (!predictions) return { error: 'Failed to fetch predictions' }

    // Calculate points per prediction
    const now = new Date().toISOString()
    const updatedPredictions = predictions.map((pred) => {
      const match = matchMap.get(pred.match_id)!
      const points = calculatePoints(
        {
          predicted_home: pred.predicted_home,
          predicted_away: pred.predicted_away,
          predicted_winner_team_id: pred.predicted_winner_team_id,
        },
        {
          home_score: match.home_score,
          away_score: match.away_score,
          winner_team_id: match.winner_team_id,
        },
        round.name as RoundName
      )
      return { id: pred.id, entry_id: pred.entry_id, points_awarded: points, calculated_at: now }
    })

    // Batch update predictions
    for (const pred of updatedPredictions) {
      await supabase
        .from('predictions')
        .update({ points_awarded: pred.points_awarded, calculated_at: pred.calculated_at })
        .eq('id', pred.id)
    }

    // Re-sum total_points for each affected entry
    const affectedEntryIds = Array.from(new Set(updatedPredictions.map((p) => p.entry_id)))

    for (const entryId of affectedEntryIds) {
      const { data: allPreds } = await supabase
        .from('predictions')
        .select('points_awarded')
        .eq('entry_id', entryId)

      const total = (allPreds ?? []).reduce(
        (sum, p) => sum + (p.points_awarded ?? 0),
        0
      )

      await supabase
        .from('entries')
        .update({ total_points: total, updated_at: now })
        .eq('id', entryId)
    }

    return {}
  } finally {
    await supabase
      .from('rounds')
      .update({ calculating: false })
      .eq('id', roundId)
  }
}
