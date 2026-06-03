'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSessionEmail } from '@/lib/session'
import { resolveEntryVisibility } from '@/lib/entries/visibility'
import type { Prediction, RoundName } from '@/types/app'

export async function getPredictionsForEntry(entryId: string): Promise<Record<string, Prediction>> {
  const supabase = getSupabaseAdminClient()

  const { revealsAll, revealedRounds } = await resolveEntryVisibility(entryId)

  // Owners and admins get every prediction. Other viewers only see predictions whose
  // round is already revealed (locked/completed); we join the round so we can filter,
  // then strip it to preserve the plain Prediction shape.
  if (revealsAll) {
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

  const { data } = await supabase
    .from('predictions')
    .select('*, matches!inner(round:rounds!inner(name))')
    .eq('entry_id', entryId)

  const map: Record<string, Prediction> = {}
  for (const row of data ?? []) {
    const { matches, ...pred } = row as Prediction & {
      matches: { round: { name: RoundName } }
    }
    if (revealedRounds.has(matches.round.name)) {
      map[pred.match_id] = pred
    }
  }
  return map
}

interface UpsertPredictionInput {
  entryId: string
  matchId: string
  predictedHome: number | null
  predictedAway: number | null
  predictedHomePenalties?: number | null
  predictedAwayPenalties?: number | null
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
  if (!round || round.status !== 'accepting_predictions') {
    return { error: 'This round is no longer accepting predictions.' }
  }

  const { error } = await supabase.from('predictions').upsert(
    {
      entry_id: input.entryId,
      match_id: input.matchId,
      predicted_home: input.predictedHome,
      predicted_away: input.predictedAway,
      predicted_home_penalties: input.predictedHomePenalties ?? null,
      predicted_away_penalties: input.predictedAwayPenalties ?? null,
      predicted_winner_team_id: input.predictedWinnerTeamId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'entry_id,match_id' }
  )

  if (error) return { error: error.message }
  return {}
}
