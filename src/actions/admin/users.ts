'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSessionEmail } from '@/lib/session'
import { isAdmin } from '@/lib/auth/isAdmin'
import { revalidatePath } from 'next/cache'
import type { RoundName, RoundStatus } from '@/types/app'

export interface RoundCompleteness {
  roundId: string
  roundName: RoundName
  roundLabel: string
  status: RoundStatus
  matchCount: number
  filledCount: number
}

export interface AdminEntryRow {
  id: string
  name: string
  totalPoints: number
  createdAt: string
  rounds: RoundCompleteness[]
}

export interface AdminUserRow {
  email: string
  isDbAdmin: boolean
  isEnvAdmin: boolean
  hasPin: boolean
  entries: AdminEntryRow[]
}

export async function getAdminUsers(): Promise<{ data?: AdminUserRow[]; error?: string }> {
  const email = await getSessionEmail()
  if (!await isAdmin(email)) return { error: 'Unauthorized' }

  const supabase = getSupabaseAdminClient()

  const [
    { data: entries },
    { data: rounds },
    { data: matches },
    { data: predictions },
    { data: sessions },
    { data: dbAdmins },
    { data: credentials },
  ] = await Promise.all([
    supabase.from('entries').select('id, user_email, name, total_points, created_at').order('user_email'),
    supabase.from('rounds').select('id, name, status, sort_order').order('sort_order'),
    supabase.from('matches').select('id, round_id'),
    supabase
      .from('predictions')
      .select('entry_id, match_id, predicted_home, predicted_away'),
    supabase.from('user_sessions').select('email').order('created_at'),
    supabase.from('admins').select('email'),
    supabase.from('user_credentials').select('email'),
  ])

  const envAdmins = (process.env.ADMIN_EMAIL ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const dbAdminEmails = new Set((dbAdmins ?? []).map((r) => r.email.toLowerCase()))
  const pinEmails = new Set((credentials ?? []).map((r) => r.email.toLowerCase()))

  // Match counts per round
  const matchCountByRound: Record<string, number> = {}
  for (const m of matches ?? []) {
    matchCountByRound[m.round_id] = (matchCountByRound[m.round_id] ?? 0) + 1
  }

  // Filled prediction counts per entry per round (via match_id → round_id)
  const matchRoundMap: Record<string, string> = {}
  for (const m of matches ?? []) matchRoundMap[m.id] = m.round_id

  // filledByEntryRound[entry_id][round_id] = count of filled predictions
  const filledByEntryRound: Record<string, Record<string, number>> = {}
  for (const p of predictions ?? []) {
    if (p.predicted_home !== null && p.predicted_away !== null) {
      const roundId = matchRoundMap[p.match_id]
      if (!roundId) continue
      if (!filledByEntryRound[p.entry_id]) filledByEntryRound[p.entry_id] = {}
      filledByEntryRound[p.entry_id][roundId] = (filledByEntryRound[p.entry_id][roundId] ?? 0) + 1
    }
  }

  // Collect all known emails (from entries + sessions)
  const allEmails = new Set<string>()
  for (const e of entries ?? []) allEmails.add(e.user_email.toLowerCase())
  for (const s of sessions ?? []) allEmails.add(s.email.toLowerCase())

  // Group entries by email
  const entriesByEmail: Record<string, typeof entries> = {}
  for (const e of entries ?? []) {
    const key = e.user_email.toLowerCase()
    if (!entriesByEmail[key]) entriesByEmail[key] = []
    entriesByEmail[key]!.push(e)
  }

  const { ROUND_LABELS } = await import('@/lib/constants/rounds')

  const users: AdminUserRow[] = Array.from(allEmails)
    .sort()
    .map((userEmail) => {
      const userEntries = entriesByEmail[userEmail] ?? []
      return {
        email: userEmail,
        isDbAdmin: dbAdminEmails.has(userEmail),
        isEnvAdmin: envAdmins.includes(userEmail),
        hasPin: pinEmails.has(userEmail),
        entries: userEntries.map((entry) => ({
          id: entry.id,
          name: entry.name,
          totalPoints: entry.total_points,
          createdAt: entry.created_at,
          rounds: (rounds ?? []).map((r) => ({
            roundId: r.id,
            roundName: r.name,
            roundLabel: ROUND_LABELS[r.name as RoundName],
            status: r.status,
            matchCount: matchCountByRound[r.id] ?? 0,
            filledCount: filledByEntryRound[entry.id]?.[r.id] ?? 0,
          })),
        })),
      }
    })

  return { data: users }
}

/**
 * Clear a user's 4-digit code so they can set a new one on next login. Also drops their
 * active sessions so a forgotten/compromised code can't keep an existing session alive.
 */
export async function resetUserPin(email: string): Promise<{ error?: string }> {
  const adminEmail = await getSessionEmail()
  if (!await isAdmin(adminEmail)) return { error: 'Unauthorized' }

  const normalized = email.trim().toLowerCase()
  const supabase = getSupabaseAdminClient()

  const { error: credError } = await supabase
    .from('user_credentials')
    .delete()
    .eq('email', normalized)
  if (credError) return { error: credError.message }

  await supabase.from('user_sessions').delete().eq('email', normalized)

  revalidatePath('/admin')
  return {}
}
