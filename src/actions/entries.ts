'use server'

import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSessionEmail } from '@/lib/session'
import { isAdmin } from '@/lib/auth/isAdmin'
import { revalidatePath } from 'next/cache'
import type { Entry } from '@/types/app'

export async function getEntries(): Promise<Entry[]> {
  const email = await getSessionEmail()
  if (!email) return []

  const supabase = getSupabaseAdminClient()
  const { data } = await supabase
    .from('entries')
    .select('*')
    .eq('user_email', email)
    .order('created_at', { ascending: false })

  return data ?? []
}

export async function getEntry(id: string): Promise<Entry | null> {
  const email = await getSessionEmail()
  if (!email) return null

  const supabase = getSupabaseAdminClient()
  const { data } = await supabase
    .from('entries')
    .select('*')
    .eq('id', id)
    .eq('user_email', email)
    .single()

  return data ?? null
}

/** Fetches any entry by ID — requires login but not ownership. */
export async function getPublicEntry(id: string): Promise<Entry | null> {
  const email = await getSessionEmail()
  if (!email) return null

  const supabase = getSupabaseAdminClient()
  const { data } = await supabase
    .from('entries')
    .select('*')
    .eq('id', id)
    .single()

  return data ?? null
}

export async function createEntry(name: string): Promise<{ id?: string; error?: string }> {
  const email = await getSessionEmail()
  if (!email) return { error: 'Not signed in.' }

  const supabase = getSupabaseAdminClient()

  const { count } = await supabase
    .from('entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_email', email)

  if ((count ?? 0) >= 2) return { error: 'Maximum 2 brackets per account.' }

  const { data, error } = await supabase
    .from('entries')
    .insert({ user_email: email, name: name.trim() })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'You already have a bracket with that name.' }
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { id: data.id }
}

export async function deleteEntry(id: string): Promise<{ error?: string }> {
  const email = await getSessionEmail()
  if (!email) return { error: 'Not signed in.' }

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('id', id)
    .eq('user_email', email)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return {}
}

export async function adminDeleteEntry(entryId: string): Promise<{ error?: string }> {
  const email = await getSessionEmail()
  if (!await isAdmin(email)) return { error: 'Unauthorized' }

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase
    .from('entries')
    .delete()
    .eq('id', entryId)

  if (error) return { error: error.message }
  revalidatePath('/admin')
  return {}
}
