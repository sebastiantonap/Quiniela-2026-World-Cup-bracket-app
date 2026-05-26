'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function signIn(email: string): Promise<{ error: string }> {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !normalized.includes('@')) {
    return { error: 'Please enter a valid email address.' }
  }

  const supabase = getSupabaseAdminClient()
  const token = generateToken()

  const { error } = await supabase
    .from('user_sessions')
    .insert({ token, email: normalized })

  if (error) return { error: 'Could not sign in. Please try again.' }

  const cookieStore = await cookies()
  cookieStore.set('quiniela_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })

  redirect('/dashboard')
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get('quiniela_session')?.value

  if (token) {
    const supabase = getSupabaseAdminClient()
    await supabase.from('user_sessions').delete().eq('token', token)
  }

  cookieStore.delete('quiniela_session')
  redirect('/')
}
