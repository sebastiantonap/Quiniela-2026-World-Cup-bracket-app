'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSessionEmail } from '@/lib/session'
import { isAdmin } from '@/lib/auth/isAdmin'
import { revalidatePath } from 'next/cache'

export async function confirmThirdPlaceQualifiers(teamIds: string[]): Promise<{ error?: string }> {
  const email = await getSessionEmail()
  if (!isAdmin(email)) return { error: 'Unauthorized' }
  if (teamIds.length !== 8) return { error: 'Must select exactly 8 teams' }

  const supabase = getSupabaseAdminClient()

  const { error: resetError } = await supabase
    .from('teams')
    .update({ best_third_qualified: false })
    .neq('id', 'none')

  if (resetError) return { error: resetError.message }

  const { error: markError } = await supabase
    .from('teams')
    .update({ best_third_qualified: true })
    .in('id', teamIds)

  if (markError) return { error: markError.message }

  revalidatePath('/admin')
  return {}
}
