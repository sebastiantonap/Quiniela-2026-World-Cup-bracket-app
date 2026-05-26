import { notFound } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getEntry } from '@/actions/entries'
import { getPredictionsForEntry } from '@/actions/predictions'
import { Nav } from '@/components/Nav'
import { BracketShell } from '@/components/bracket/BracketShell'
import type { MatchWithTeams, Round, RoundName } from '@/types/app'
import { ROUND_ORDER } from '@/lib/constants/rounds'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EntryPage({ params }: PageProps) {
  const { id } = await params
  const entry = await getEntry(id)
  if (!entry) notFound()

  const supabase = await getSupabaseServerClient()

  // Fetch all rounds
  const { data: roundsData } = await supabase
    .from('rounds')
    .select('*')
    .order('sort_order', { ascending: true })

  // Fetch all matches with team and round info
  const { data: matchesData } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(*),
      away_team:teams!matches_away_team_id_fkey(*),
      winner_team:teams!matches_winner_team_id_fkey(*),
      round:rounds(*),
      group:groups(*)
    `)
    .order('match_number', { ascending: true })

  const rounds: Round[] = roundsData ?? []
  const matches: MatchWithTeams[] = (matchesData ?? []) as unknown as MatchWithTeams[]

  // Group matches by round name
  const matchesByRound = ROUND_ORDER.reduce<Record<RoundName, MatchWithTeams[]>>(
    (acc, roundName) => {
      acc[roundName] = matches.filter((m) => m.round?.name === roundName)
      return acc
    },
    {} as Record<RoundName, MatchWithTeams[]>
  )

  const predictions = await getPredictionsForEntry(id)

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <a href="/dashboard" className="hover:text-gray-700">My Brackets</a>
            <span>/</span>
            <span className="text-gray-900 font-medium">{entry.name}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <h1 className="text-2xl font-bold">{entry.name}</h1>
            <span className="text-lg font-semibold text-blue-600">
              {entry.total_points} pts
            </span>
          </div>
        </div>

        <BracketShell
          entryId={entry.id}
          rounds={rounds}
          matchesByRound={matchesByRound}
          initialPredictions={predictions}
        />
      </main>
    </div>
  )
}
