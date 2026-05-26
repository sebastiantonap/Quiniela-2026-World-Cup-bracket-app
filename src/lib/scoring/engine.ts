import { ROUND_POINTS } from '@/lib/constants/rounds'
import type { RoundName } from '@/types/app'

interface PredictionInput {
  predicted_home: number | null
  predicted_away: number | null
  predicted_winner_team_id: string | null
}

interface ResultInput {
  home_score: number | null
  away_score: number | null
  winner_team_id: string | null
}

export function calculatePoints(
  prediction: PredictionInput,
  result: ResultInput,
  roundName: RoundName
): number {
  if (
    prediction.predicted_home === null ||
    prediction.predicted_away === null ||
    result.home_score === null ||
    result.away_score === null
  ) {
    return 0
  }

  const pts = ROUND_POINTS[roundName]
  const isGroupStage = roundName === 'group_stage'

  let outcomeCorrect = false

  if (isGroupStage) {
    const predictedOutcome = Math.sign(prediction.predicted_home - prediction.predicted_away)
    const actualOutcome = Math.sign(result.home_score - result.away_score)
    outcomeCorrect = predictedOutcome === actualOutcome
  } else {
    // Knockout: use winner_team_id for outcome check
    if (!result.winner_team_id || !prediction.predicted_winner_team_id) {
      return 0
    }
    outcomeCorrect = prediction.predicted_winner_team_id === result.winner_team_id
  }

  if (!outcomeCorrect) return 0

  let points = pts.winner

  const exactScore =
    prediction.predicted_home === result.home_score &&
    prediction.predicted_away === result.away_score

  if (exactScore) {
    points += pts.bonus
  }

  return points
}
