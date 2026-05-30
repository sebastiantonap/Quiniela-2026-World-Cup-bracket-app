import { redirect } from 'next/navigation'
import { getSessionEmail } from '@/lib/session'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/isAdmin'
import { getAdminUsers } from '@/actions/admin/users'
import { Nav } from '@/components/Nav'
import { AdminPanel } from '@/components/admin/AdminPanel'
import type { MatchWithTeams, Round } from '@/types/app'

export default async function AdminPage() {
  const email = await getSessionEmail()

  if (!await isAdmin(email)) {
    redirect('/dashboard')
  }

  const supabase = getSupabaseAdminClient()

  const [{ data: roundsData }, { data: matchesData }, { data: teamsData }, usersResult] =
    await Promise.all([
      supabase.from('rounds').select('*').order('sort_order', { ascending: true }),
      supabase
        .from('matches')
        .select(`
          *,
          home_team:teams!matches_home_team_id_fkey(*),
          away_team:teams!matches_away_team_id_fkey(*),
          winner_team:teams!matches_winner_team_id_fkey(*),
          round:rounds(*),
          group:groups(*)
        `)
        .order('match_number', { ascending: true }),
      supabase.from('teams').select('*').order('name', { ascending: true }),
      getAdminUsers(),
    ])

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Admin Panel</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage rounds, enter results, recalculate scores.
          </p>
        </div>
        <AdminPanel
          rounds={(roundsData ?? []) as Round[]}
          matches={(matchesData ?? []) as unknown as MatchWithTeams[]}
          teams={teamsData ?? []}
          users={usersResult.data ?? []}
        />
      </main>
    </div>
  )
}
