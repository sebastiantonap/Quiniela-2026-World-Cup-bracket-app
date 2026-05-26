'use server'

import { getSupabaseServerClient } from '@/lib/supabase/server'
import { recalculateRound } from '@/lib/scoring/recalculate'
import { revalidatePath } from 'next/cache'

async function assertAdmin() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    throw new Error('Unauthorized')
  }
}

export async function triggerRecalculation(roundId: string): Promise<{ error?: string }> {
  try {
    await assertAdmin()
  } catch {
    return { error: 'Unauthorized' }
  }

  const result = await recalculateRound(roundId)
  if (!result.error) {
    revalidatePath('/leaderboard')
    revalidatePath('/dashboard')
  }
  return result
}
