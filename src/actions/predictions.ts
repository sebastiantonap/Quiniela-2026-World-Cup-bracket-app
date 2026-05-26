'use server'

import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { Prediction } from '@/types/app'

export async function getPredictionsForEntry(
  entryId: string
): Promise<Record<string, Prediction>> {
  const supabase = await getSupabaseServerClient()

  const { data } = await supabase
    .from('predictions')
    .select('*')
    .eq('entry_id', entryId)

  const map: Record<string, Prediction> = {}
  for (const pred of data ?? []) {
    map[pred.match_id] = pred
  }
  return map
}

interface UpsertPredictionInput {
  entryId: string
  matchId: string
  predictedHome: number | null
  predictedAway: number | null
  predictedWinnerTeamId?: string | null
}

export async function upsertPrediction(
  input: UpsertPredictionInput
): Promise<{ error?: string }> {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'session_expired' }

  // Verify the entry belongs to the user
  const { data: entry } = await supabase
    .from('entries')
    .select('id')
    .eq('id', input.entryId)
    .eq('user_id', user.id)
    .single()

  if (!entry) return { error: 'Not authorized' }

  // Verify the round is still accepting predictions
  const { data: match } = await supabase
    .from('matches')
    .select('round_id, rounds!inner(status)')
    .eq('id', input.matchId)
    .single()

  if (!match) return { error: 'Match not found' }

  const round = (match as any).rounds
  if (round.status !== 'accepting_predictions') {
    return { error: 'This round is no longer accepting predictions.' }
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('predictions')
    .upsert(
      {
        entry_id: input.entryId,
        match_id: input.matchId,
        predicted_home: input.predictedHome,
        predicted_away: input.predictedAway,
        predicted_winner_team_id: input.predictedWinnerTeamId ?? null,
        updated_at: now,
      },
      { onConflict: 'entry_id,match_id' }
    )

  if (error) return { error: error.message }
  return {}
}
