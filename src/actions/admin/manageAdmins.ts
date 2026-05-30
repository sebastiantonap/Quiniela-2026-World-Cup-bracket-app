'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSessionEmail } from '@/lib/session'
import { isAdmin } from '@/lib/auth/isAdmin'
import { revalidatePath } from 'next/cache'

async function assertAdmin() {
  const email = await getSessionEmail()
  if (!await isAdmin(email)) throw new Error('Unauthorized')
}

export async function getAdmins(): Promise<{ dbEmails: string[]; envEmails: string[] }> {
  const envEmails = (process.env.ADMIN_EMAIL ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const supabase = getSupabaseAdminClient()
  const { data } = await supabase.from('admins').select('email').order('created_at')
  const dbEmails = (data ?? []).map((r) => r.email)

  return { dbEmails, envEmails }
}

export async function addAdmin(email: string): Promise<{ error?: string }> {
  try {
    await assertAdmin()
  } catch {
    return { error: 'Unauthorized' }
  }

  const normalized = email.trim().toLowerCase()
  if (!normalized || !normalized.includes('@')) return { error: 'Invalid email' }

  const callerEmail = await getSessionEmail()
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from('admins')
    .insert({ email: normalized, added_by: callerEmail })

  if (error) {
    if (error.code === '23505') return { error: 'Already an admin' }
    return { error: error.message }
  }

  revalidatePath('/admin')
  return {}
}

export async function removeAdmin(email: string): Promise<{ error?: string }> {
  try {
    await assertAdmin()
  } catch {
    return { error: 'Unauthorized' }
  }

  const normalized = email.trim().toLowerCase()
  const callerEmail = (await getSessionEmail())?.toLowerCase()

  if (normalized === callerEmail) return { error: 'Cannot remove yourself' }

  // Env-var admins cannot be removed via UI
  const envEmails = (process.env.ADMIN_EMAIL ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (envEmails.includes(normalized)) {
    return { error: 'This admin is configured via environment variable and cannot be removed here' }
  }

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.from('admins').delete().eq('email', normalized)

  if (error) return { error: error.message }

  revalidatePath('/admin')
  return {}
}
