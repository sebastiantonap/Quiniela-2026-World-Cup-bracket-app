'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSessionEmail } from '@/lib/session'
import { resolveEntryVisibility } from '@/lib/entries/visibility'

export async function getThirdPlaceSelectionsForEntry(entryId: string): Promise<string[]> {
  const supabase = getSupabaseAdminClient()

  // Best-third picks belong to the group stage — hide them from competitors until the
  // group-stage round is locked.
  const { revealedRounds } = await resolveEntryVisibility(entryId)
  if (!revealedRounds.has('group_stage')) return []

  const { data } = await supabase
    .from('entry_best_third_selections')
    .select('team_id')
    .eq('entry_id', entryId)
  return (data ?? []).map((r) => r.team_id)
}

export async function upsertThirdPlaceSelections(
  entryId: string,
  teamIds: string[]
): Promise<{ error?: string }> {
  const email = await getSessionEmail()
  if (!email) return { error: 'session_expired' }

  if (teamIds.length > 8) return { error: 'Cannot select more than 8 teams' }

  const supabase = getSupabaseAdminClient()

  const { data: entry } = await supabase
    .from('entries')
    .select('id')
    .eq('id', entryId)
    .eq('user_email', email)
    .single()
  if (!entry) return { error: 'Not authorized' }

  const { data: round } = await supabase
    .from('rounds')
    .select('status')
    .eq('name', 'group_stage')
    .single()
  if (round?.status !== 'accepting_predictions') {
    return { error: 'Group stage predictions are closed' }
  }

  // Delete existing selections and re-insert
  const { error: deleteError } = await supabase
    .from('entry_best_third_selections')
    .delete()
    .eq('entry_id', entryId)
  if (deleteError) return { error: deleteError.message }

  if (teamIds.length > 0) {
    const { error: insertError } = await supabase
      .from('entry_best_third_selections')
      .insert(
        teamIds.map((team_id) => ({
          entry_id: entryId,
          team_id,
          updated_at: new Date().toISOString(),
        }))
      )
    if (insertError) return { error: insertError.message }
  }

  return {}
}
