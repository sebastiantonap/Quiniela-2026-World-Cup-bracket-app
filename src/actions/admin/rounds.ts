'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { RoundStatus } from '@/types/app'

async function assertAdmin() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    throw new Error('Unauthorized')
  }
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
