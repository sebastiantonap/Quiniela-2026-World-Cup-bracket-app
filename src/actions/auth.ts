'use server'

import { getSupabaseServerClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export async function signInWithMagicLink(email: string): Promise<{ error?: string }> {
  const supabase = await getSupabaseServerClient()
  const headersList = await headers()
  const origin = headersList.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) return { error: error.message }
  return {}
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabaseServerClient()
  await supabase.auth.signOut()
}
