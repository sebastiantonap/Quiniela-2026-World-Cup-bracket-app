import { redirect } from 'next/navigation'
import { getSessionEmail } from '@/lib/session'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/auth/isAdmin'
import { getAdminUsers } from '@/actions/admin/users'
import { Nav } from '@/components/Nav'
import { AdminPanel } from '@/components/admin/AdminPanel'
import { getT } from '@/lib/i18n/server'
import type { MatchWithTeams, Round } from '@/types/app'

export default async function AdminPage() {
  const email = await getSessionEmail()

  if (!await isAdmin(email)) {
    redirect('/dashboard')
  }

  const { t } = await getT()

  const supabase = getSupabaseAdminClient()

  const [
    { data: roundsData },
    { data: matchesData },
    { data: teamsData },
    usersResult,
    { data: syncRunsData },
    { data: changeLogsData },
  ] = await Promise.all([
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
    supabase.from('sync_runs').select('*').order('started_at', { ascending: false }).limit(20),
    supabase.from('change_log').select('*').order('changed_at', { ascending: false }).limit(200),
  ])

  const teams = teamsData ?? []
  const hasTeamMapping = teams.some((t) => t.fd_team_id !== null)
  const matches = (matchesData ?? []) as unknown as MatchWithTeams[]
  const hasMatchMapping = matches.some((m) => m.fd_match_id !== null)

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">{t('admin.title')}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {t('admin.subtitle')}
          </p>
        </div>
        <AdminPanel
          rounds={(roundsData ?? []) as Round[]}
          matches={matches}
          teams={teams}
          users={usersResult.data ?? []}
          syncRuns={syncRunsData ?? []}
          changeLogs={changeLogsData ?? []}
          hasTeamMapping={hasTeamMapping}
          hasMatchMapping={hasMatchMapping}
        />
      </main>
    </div>
  )
}
