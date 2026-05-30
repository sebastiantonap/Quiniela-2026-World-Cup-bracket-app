import { getSupabaseAdminClient } from '@/lib/supabase/admin'

export async function isAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false
  const normalized = email.toLowerCase()

  // Env var takes priority (fast path, no DB call needed)
  const envAdmins = (process.env.ADMIN_EMAIL ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (envAdmins.includes(normalized)) return true

  // Check DB admins table for admins added via UI
  const supabase = getSupabaseAdminClient()
  const { data } = await supabase
    .from('admins')
    .select('email')
    .eq('email', normalized)
    .maybeSingle()

  return !!data
}
