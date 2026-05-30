'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSessionEmail } from '@/lib/session'
import { isAdmin } from '@/lib/auth/isAdmin'
import { revalidatePath } from 'next/cache'
import type { RoundStatus } from '@/types/app'

async function assertAdmin() {
  const email = await getSessionEmail()
  if (!await isAdmin(email)) throw new Error('Unauthorized')
}

export async function setRoundStatus(
  roundId: string,
  status: RoundStatus
): Promise<{ error?: string }> {
  try {
    await assertAdmin()
  } catch {
    return { error: 'Unauthorized' }
  }

  const admin = getSupabaseAdminClient()
  const { error } = await admin
    .from('rounds')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', roundId)

  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/entries')
  return {}
}
