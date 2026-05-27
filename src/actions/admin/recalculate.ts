'use server'

import { getSessionEmail } from '@/lib/session'
import { isAdmin } from '@/lib/auth/isAdmin'
import { recalculateRound } from '@/lib/scoring/recalculate'
import { revalidatePath } from 'next/cache'

async function assertAdmin() {
  const email = await getSessionEmail()
  if (!isAdmin(email)) throw new Error('Unauthorized')
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
