import type { MatchWithTeams, Team, TeamStanding, Prediction } from '@/types/app'
import { computeGroupStandings } from './groupStandings'

export interface PredictedStandingsResult {
  standings: TeamStanding[]
  hasAmbiguity: boolean
  ambiguousTeams: [Team, Team] | null
  predictedMatchCount: number
  totalMatchCount: number
}

export function computePredictedStandings(
  teams: Team[],
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

  // Always compute full standings — returns all 4 teams with 0s when no predictions yet
  const standings = computeGroupStandings(teams, predictedMatches)

  // Only flag ambiguity when there's actual prediction data to avoid false warnings
  const third = standings[2]
  const fourth = standings[3]
  const hasAmbiguity =
    predictedMatchCount > 0 &&
    !!third && !!fourth &&
    third.points === fourth.points &&
    third.goal_difference === fourth.goal_difference &&
    third.goals_for === fourth.goals_for

  return {
    standings,
    hasAmbiguity,
    ambiguousTeams: hasAmbiguity ? [third.team, fourth.team] : null,
    predictedMatchCount,
    totalMatchCount,
  }
}
