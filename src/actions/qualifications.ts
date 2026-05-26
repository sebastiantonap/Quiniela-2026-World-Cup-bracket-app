'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSessionEmail } from '@/lib/session'
import type { QualState } from '@/types/app'

export async function getQualificationsForEntry(entryId: string): Promise<QualState> {
  const supabase = getSupabaseAdminClient()

  const { data } = await supabase
    .from('group_qualifications')
    .select('*')
    .eq('entry_id', entryId)

  const result: QualState = {}
  for (const row of data ?? []) {
    result[row.group_id] = {
      predicted1st: row.predicted_1st_team_id,
      predicted2nd: row.predicted_2nd_team_id,
      predicted3rd: row.predicted_3rd_team_id,
      pointsAwarded: row.points_awarded,
    }
  }
  return result
}

export async function upsertQualification(
  entryId: string,
  groupId: string,
  predicted1st: string | null,
  predicted2nd: string | null,
  predicted3rd: string | null
): Promise<{ error?: string }> {
  const email = await getSessionEmail()
  if (!email) return { error: 'session_expired' }

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

  const { error } = await supabase.from('group_qualifications').upsert(
    {
      entry_id: entryId,
      group_id: groupId,
      predicted_1st_team_id: predicted1st,
      predicted_2nd_team_id: predicted2nd,
      predicted_3rd_team_id: predicted3rd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'entry_id,group_id' }
  )

  if (error) return { error: error.message }
  return {}
}
