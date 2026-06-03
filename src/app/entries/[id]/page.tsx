import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getPublicEntry, getEntries } from '@/actions/entries'
import { getThirdPlaceSelectionsForEntry } from '@/actions/thirdPlaceSelections'
import { getSessionEmail } from '@/lib/session'
import { resolveEntryVisibility } from '@/lib/entries/visibility'
import { getPredictionsForEntry } from '@/actions/predictions'
import { getQualificationsForEntry } from '@/actions/qualifications'
import { Nav } from '@/components/Nav'
import { BracketShell } from '@/components/bracket/BracketShell'
import type { MatchWithTeams, Round, RoundName, Team, Group } from '@/types/app'
import { ROUND_ORDER } from '@/lib/constants/rounds'
import { getT } from '@/lib/i18n/server'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EntryPage({ params }: PageProps) {
  const { id } = await params

  const [entry, viewerEmail] = await Promise.all([
    getPublicEntry(id),
    getSessionEmail(),
  ])

  if (!entry) {
    if (!viewerEmail) notFound()
    notFound()
  }

  const isOwner = viewerEmail === entry.user_email

  const supabase = getSupabaseAdminClient()

  const [
    visibility,
    { data: roundsData },
    { data: matchesData },
    { data: groupsData },
    predictions,
    quals,
    myEntries,
    thirdPlaceSelections,
  ] = await Promise.all([
    resolveEntryVisibility(id),
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
    supabase.from('groups').select('*, teams(*)').order('name', { ascending: true }),
    getPredictionsForEntry(id),
    getQualificationsForEntry(id),
    isOwner ? getEntries() : Promise.resolve([]),
    getThirdPlaceSelectionsForEntry(id),
  ])

  const { t } = await getT()

  const rounds: Round[] = roundsData ?? []
  const matches: MatchWithTeams[] = (matchesData ?? []) as unknown as MatchWithTeams[]
  const groups = (groupsData ?? []) as unknown as (Group & { teams: Team[] })[]

  const matchesByRound = ROUND_ORDER.reduce<Record<RoundName, MatchWithTeams[]>>(
    (acc, roundName) => {
      acc[roundName] = matches.filter((m) => m.round?.name === roundName)
      return acc
    },
    {} as Record<RoundName, MatchWithTeams[]>
  )

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-8">
        {!isOwner && (
          <div className="mb-4 rounded-xl border border-amber-700/40 bg-amber-900/15 px-4 py-2.5 text-sm text-amber-300">
            {t('entry.viewing')} <span className="font-semibold">{entry.name}</span> — {t('entry.readOnly')}
          </div>
        )}

        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            {isOwner ? (
              <a href="/dashboard" className="transition hover:text-slate-300">
                {t('common.myBrackets')}
              </a>
            ) : (
              <a href="/leaderboard" className="transition hover:text-slate-300">
                {t('leaderboard.title')}
              </a>
            )}
            <span>/</span>
            <span className="font-medium text-slate-200">{entry.name}</span>
          </div>

          {/* Entry switcher — only shown to the owner when they have 2 brackets */}
          {isOwner && myEntries.length > 1 && (
            <div className="mt-3 flex gap-1 rounded-xl bg-slate-800 p-1 w-fit border border-slate-700">
              {myEntries.map((e) => (
                <Link
                  key={e.id}
                  href={`/entries/${e.id}`}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition whitespace-nowrap ${
                    e.id === id
                      ? 'bg-slate-700 text-slate-100 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {e.name}
                  <span className={`ml-2 text-xs tabular-nums ${e.id === id ? 'text-amber-400' : 'text-slate-500'}`}>
                    {e.total_points} {t('common.pts')}
                  </span>
                </Link>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-baseline gap-3">
            <h1 className="text-2xl font-bold text-slate-100">{entry.name}</h1>
            <span className="text-lg font-semibold text-amber-400">{entry.total_points} {t('common.pts')}</span>
          </div>
        </div>

        <BracketShell
          entryId={entry.id}
          rounds={rounds}
          matchesByRound={matchesByRound}
          initialPredictions={predictions}
          groups={groups}
          initialQuals={quals}
          initialThirdPlaceSelections={thirdPlaceSelections}
          entryTotalPoints={entry.total_points}
          readOnly={!isOwner}
          revealedRounds={Array.from(visibility.revealedRounds)}
        />
      </main>
    </div>
  )
}
