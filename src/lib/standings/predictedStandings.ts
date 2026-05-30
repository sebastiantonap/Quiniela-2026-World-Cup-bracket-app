import type { MatchWithTeams, TeamStanding, Prediction } from '@/types/app'
import { computeGroupStandings } from './groupStandings'

export interface StandingAmbiguities {
  /** 1st/2nd boundary: both teams could be 1st or 2nd */
  first: boolean
  /** 2nd/3rd boundary: both teams could be 2nd or 3rd */
  second: boolean
  /** 3rd/4th boundary: both teams could be 3rd or 4th */
  third: boolean
}

export interface PredictedStandingsResult {
  standings: TeamStanding[]
  ambiguities: StandingAmbiguities
  predictedMatchCount: number
  totalMatchCount: number
}

function boundaryTied(a: TeamStanding | undefined, b: TeamStanding | undefined): boolean {
  if (!a || !b) return false
  return (
    a.points === b.points &&
    a.goal_difference === b.goal_difference &&
    a.goals_for === b.goals_for
  )
}

export function computePredictedStandings(
  teams: Parameters<typeof computeGroupStandings>[0],
  matches: MatchWithTeams[],
  predictions: Record<string, Prediction>
): PredictedStandingsResult {
  const totalMatchCount = matches.length

  const predictedMatches = matches
    .filter((m) => {
      const pred = predictions[m.id]
      return pred?.predicted_home != null && pred?.predicted_away != null
    })
    .map((m) => {
      const pred = predictions[m.id]
      return {
        ...m,
        home_score: pred.predicted_home,
        away_score: pred.predicted_away,
        result_confirmed: true,
        winner_team_id: null,
      } as MatchWithTeams
    })

  const predictedMatchCount = predictedMatches.length

  // Always compute full standings — all 4 teams with 0s when no predictions yet
  const standings = computeGroupStandings(teams, predictedMatches)

  // Only check ambiguity when there's real data; with 0 predictions all stats are
  // identical (all zeros) which would falsely flag every boundary as tied.
  const ambiguities: StandingAmbiguities =
    predictedMatchCount === 0
      ? { first: false, second: false, third: false }
      : {
          first: boundaryTied(standings[0], standings[1]),
          second: boundaryTied(standings[1], standings[2]),
          third: boundaryTied(standings[2], standings[3]),
        }

  return { standings, ambiguities, predictedMatchCount, totalMatchCount }
}
