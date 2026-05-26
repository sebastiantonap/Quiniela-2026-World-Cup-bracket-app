import { cookies } from 'next/headers'
import { getSupabaseAdminClient } from './supabase/admin'

export async function getSessionEmail(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('quiniela_session')?.value
  if (!token) return null

  const supabase = getSupabaseAdminClient()
  const { data } = await supabase
    .from('user_sessions')
    .select('email')
    .eq('token', token)
    .single()

  return data?.email ?? null
}
