'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { hashPin, verifyPin, isValidPin } from '@/lib/auth/pin'

const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isValidEmail(email: string): boolean {
  return !!email && email.includes('@')
}

/** Issue a session token + cookie for an authenticated email. */
async function createSession(email: string): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const token = generateToken()

  await supabase.from('user_sessions').insert({ token, email })

  const cookieStore = await cookies()
  cookieStore.set('quiniela_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
}

export type AuthMode = 'login' | 'signup'

/**
 * Step 1 of login: given an email, report whether it already has a PIN (login) or needs
 * one set (signup), or whether it's temporarily locked after too many failed attempts.
 */
export async function beginAuth(
  email: string
): Promise<{ mode?: AuthMode; locked?: boolean; error?: string }> {
  const normalized = normalizeEmail(email)
  if (!isValidEmail(normalized)) return { error: 'auth.error.invalidEmail' }

  const supabase = getSupabaseAdminClient()
  const { data: cred } = await supabase
    .from('user_credentials')
    .select('locked_until')
    .eq('email', normalized)
    .maybeSingle()

  if (!cred) return { mode: 'signup' }

  if (cred.locked_until && new Date(cred.locked_until) > new Date()) {
    return { mode: 'login', locked: true }
  }

  return { mode: 'login' }
}

interface AuthenticateInput {
  email: string
  pin: string
  pinConfirm?: string
}

/**
 * Step 2 of login. Creates the account (signup) or verifies the PIN (login), then issues
 * a session and redirects to the dashboard. Returns an error key on failure.
 */
export async function authenticate(
  input: AuthenticateInput
): Promise<{ error?: string }> {
  const email = normalizeEmail(input.email)
  if (!isValidEmail(email)) return { error: 'auth.error.invalidEmail' }
  if (!isValidPin(input.pin)) return { error: 'auth.error.invalidPin' }

  const supabase = getSupabaseAdminClient()
  const { data: cred } = await supabase
    .from('user_credentials')
    .select('pin_hash, pin_salt, failed_attempts, locked_until')
    .eq('email', email)
    .maybeSingle()

  // ---------- Signup: first time this email sets a PIN ----------
  if (!cred) {
    if (input.pinConfirm !== input.pin) return { error: 'auth.error.pinMismatch' }

    const { hash, salt } = hashPin(input.pin)
    const { error } = await supabase
      .from('user_credentials')
      .insert({ email, pin_hash: hash, pin_salt: salt })

    // A concurrent signup for the same email could race us to the unique PK.
    if (error) return { error: 'auth.error.incorrect' }

    await createSession(email)
    redirect('/dashboard')
  }

  // ---------- Login: verify the PIN ----------
  if (cred.locked_until && new Date(cred.locked_until) > new Date()) {
    return { error: 'auth.error.locked' }
  }

  if (verifyPin(input.pin, cred.pin_hash, cred.pin_salt)) {
    await supabase
      .from('user_credentials')
      .update({ failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() })
      .eq('email', email)

    await createSession(email)
    redirect('/dashboard')
  }

  // Wrong PIN — count the failure and lock after too many.
  const attempts = (cred.failed_attempts ?? 0) + 1
  const lockedUntil =
    attempts >= MAX_ATTEMPTS
      ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
      : null

  await supabase
    .from('user_credentials')
    .update({ failed_attempts: attempts, locked_until: lockedUntil, updated_at: new Date().toISOString() })
    .eq('email', email)

  return { error: lockedUntil ? 'auth.error.locked' : 'auth.error.incorrect' }
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
