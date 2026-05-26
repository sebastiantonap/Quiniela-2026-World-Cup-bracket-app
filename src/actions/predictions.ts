'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSessionEmail } from '@/lib/session'
import type { Prediction } from '@/types/app'

export async function getPredictionsForEntry(entryId: string): Promise<Record<string, Prediction>> {
  const supabase = getSupabaseAdminClient()

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
  const email = await getSessionEmail()
  if (!email) return { error: 'session_expired' }

  const supabase = getSupabaseAdminClient()

  // Verify entry belongs to this user
  const { data: entry } = await supabase
    .from('entries')
    .select('id')
    .eq('id', input.entryId)
    .eq('user_email', email)
    .single()

  if (!entry) return { error: 'Not authorized' }

  // Verify round is still accepting predictions
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

  const { error } = await supabase.from('predictions').upsert(
    {
      entry_id: input.entryId,
      match_id: input.matchId,
      predicted_home: input.predictedHome,
      predicted_away: input.predictedAway,
      predicted_winner_team_id: input.predictedWinnerTeamId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'entry_id,match_id' }
  )

  if (error) return { error: error.message }
  return {}
}
