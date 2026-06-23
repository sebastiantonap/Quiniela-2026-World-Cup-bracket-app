import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getSessionEmail } from '@/lib/session'
import { isAdmin } from '@/lib/auth/isAdmin'
import { runSync } from '@/lib/sync/syncWorker'

/** Manual "Sync Now" — requires admin session. */
export async function POST() {
  const email = await getSessionEmail()
  if (!await isAdmin(email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runSync()

  if (result.matchesChanged > 0) {
    revalidatePath('/admin')
    revalidatePath('/leaderboard')
    revalidatePath('/dashboard')
    revalidatePath('/entries', 'layout')
  }

  return NextResponse.json(result)
}

/** Vercel Cron endpoint — requires CRON_SECRET auth header. */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runSync()

  if (result.matchesChanged > 0) {
    revalidatePath('/admin')
    revalidatePath('/leaderboard')
    revalidatePath('/dashboard')
    revalidatePath('/entries', 'layout')
  }

  return NextResponse.json(result)
}
