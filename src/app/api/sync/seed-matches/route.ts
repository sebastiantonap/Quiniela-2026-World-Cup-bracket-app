import { NextResponse } from 'next/server'
import { getSessionEmail } from '@/lib/session'
import { isAdmin } from '@/lib/auth/isAdmin'
import { seedMatchMapping } from '@/lib/sync/syncWorker'

/** One-time setup: maps fd_match_id by matching team pairings. Admin-only. */
export async function POST() {
  const email = await getSessionEmail()
  if (!await isAdmin(email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await seedMatchMapping()
  return NextResponse.json(result)
}
