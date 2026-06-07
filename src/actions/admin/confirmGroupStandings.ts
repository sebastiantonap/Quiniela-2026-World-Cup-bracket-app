'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSessionEmail } from '@/lib/session'
import { isAdmin } from '@/lib/auth/isAdmin'
import { revalidatePath } from 'next/cache'

/**
 * Save the admin-confirmed standings order for a single group.
 * `orderedTeamIds` must contain exactly 4 team IDs in the desired 1st→4th order.
 * Each team's `confirmed_position` column is set to its 1-based rank.
 */
export async function confirmGroupStandings(
  groupId: string,
  orderedTeamIds: string[]
): Promise<{ error?: string }> {
  const email = await getSessionEmail()
  if (!await isAdmin(email)) return { error: 'Unauthorized' }
  if (orderedTeamIds.length !== 4) return { error: 'Must provide exactly 4 teams' }

  const supabase = getSupabaseAdminClient()

  for (let i = 0; i < orderedTeamIds.length; i++) {
    const { error } = await supabase
      .from('teams')
      .update({ confirmed_position: i + 1 })
      .eq('id', orderedTeamIds[i])
      .eq('group_id', groupId)

    if (error) return { error: error.message }
  }

  revalidatePath('/admin')
  return {}
}
