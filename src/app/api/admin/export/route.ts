import { getSessionEmail } from '@/lib/session'
import { isAdmin } from '@/lib/auth/isAdmin'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { ROUND_LABELS } from '@/lib/constants/rounds'
import type { RoundName } from '@/types/app'

function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function row(values: (string | number | null | undefined)[]): string {
  return values.map(escapeCsv).join(',')
}

interface TeamRef { name: string }
interface EntryRef { name: string; user_email: string; total_points: number }
interface GroupRef { name: string }
interface RoundRef { name: RoundName }

interface MatchRef {
  match_number: number
  home_score: number | null
  away_score: number | null
  home_team: TeamRef | TeamRef[] | null
  away_team: TeamRef | TeamRef[] | null
  winner_team: TeamRef | TeamRef[] | null
  round: RoundRef | RoundRef[] | null
}

interface PredictionRow {
  predicted_home: number | null
  predicted_away: number | null
  points_awarded: number | null
  predicted_winner: TeamRef | TeamRef[] | null
  entry: EntryRef | EntryRef[] | null
  match: MatchRef | MatchRef[] | null
}

interface QualRow {
  points_awarded: number | null
  entry: EntryRef | EntryRef[] | null
  group: GroupRef | GroupRef[] | null
  team_1st: TeamRef | TeamRef[] | null
  team_2nd: TeamRef | TeamRef[] | null
  team_3rd: TeamRef | TeamRef[] | null
}

function single<T>(val: T | T[] | null): T | null {
  if (!val) return null
  return Array.isArray(val) ? (val[0] ?? null) : val
}

export async function GET() {
  const email = await getSessionEmail()
  if (!await isAdmin(email)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = getSupabaseAdminClient()

  const [{ data: predictions }, { data: qualifications }] = await Promise.all([
    admin
      .from('predictions')
      .select(`
        predicted_home,
        predicted_away,
        points_awarded,
        predicted_winner:teams!predictions_predicted_winner_team_id_fkey(name),
        entry:entries!predictions_entry_id_fkey(name, user_email, total_points),
        match:matches!predictions_match_id_fkey(
          match_number,
          home_score,
          away_score,
          home_team:teams!matches_home_team_id_fkey(name),
          away_team:teams!matches_away_team_id_fkey(name),
          winner_team:teams!matches_winner_team_id_fkey(name),
          round:rounds!matches_round_id_fkey(name)
        )
      `)
      .order('entry_id')
      .order('match_id'),
    admin
      .from('group_qualifications')
      .select(`
        points_awarded,
        entry:entries!group_qualifications_entry_id_fkey(name, user_email, total_points),
        group:groups!group_qualifications_group_id_fkey(name),
        team_1st:teams!group_qualifications_predicted_1st_team_id_fkey(name),
        team_2nd:teams!group_qualifications_predicted_2nd_team_id_fkey(name),
        team_3rd:teams!group_qualifications_predicted_3rd_team_id_fkey(name)
      `)
      .order('entry_id')
      .order('group_id'),
  ])

  const header = row([
    'prediction_type',
    'entry_name',
    'user_email',
    'entry_total_points',
    'round',
    'match_number',
    'home_team',
    'away_team',
    'predicted_home_score',
    'predicted_away_score',
    'predicted_winner',
    'actual_home_score',
    'actual_away_score',
    'actual_winner',
    'group',
    'predicted_1st',
    'predicted_2nd',
    'predicted_3rd',
    'points_awarded',
  ])

  const matchRows = ((predictions ?? []) as unknown as PredictionRow[]).map((p) => {
    const entry = single(p.entry)
    const match = single(p.match)
    const round = match ? single(match.round) : null
    const roundLabel = round?.name ? (ROUND_LABELS[round.name] ?? round.name) : ''

    return row([
      'match',
      entry?.name,
      entry?.user_email,
      entry?.total_points,
      roundLabel,
      match?.match_number,
      single(match?.home_team ?? null)?.name,
      single(match?.away_team ?? null)?.name,
      p.predicted_home,
      p.predicted_away,
      single(p.predicted_winner)?.name,
      match?.home_score,
      match?.away_score,
      single(match?.winner_team ?? null)?.name,
      '',
      '',
      '',
      '',
      p.points_awarded,
    ])
  })

  const qualRows = ((qualifications ?? []) as unknown as QualRow[]).map((q) => {
    const entry = single(q.entry)
    const group = single(q.group)

    return row([
      'group_qual',
      entry?.name,
      entry?.user_email,
      entry?.total_points,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      group?.name,
      single(q.team_1st)?.name,
      single(q.team_2nd)?.name,
      single(q.team_3rd)?.name,
      q.points_awarded,
    ])
  })

  const csv = [header, ...matchRows, ...qualRows].join('\n')
  const date = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="quiniela-export-${date}.csv"`,
    },
  })
}
