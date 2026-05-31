import { NextResponse } from 'next/server'
import { getSessionEmail } from '@/lib/session'
import { isAdmin } from '@/lib/auth/isAdmin'
import { seedTeamMapping } from '@/lib/sync/syncWorker'

/** One-time setup: maps fd_team_id by matching TLA codes. Admin-only. */
export async function POST() {
  const email = await getSessionEmail()
  if (!await isAdmin(email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await seedTeamMapping()
  return NextResponse.json(result)
}
