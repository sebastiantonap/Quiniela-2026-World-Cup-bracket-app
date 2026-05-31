import { ROUND_POINTS } from '@/lib/constants/rounds'
import type { RoundName } from '@/types/app'

interface PredictionInput {
  predicted_home: number | null
  predicted_away: number | null
  predicted_home_penalties?: number | null
  predicted_away_penalties?: number | null
  predicted_winner_team_id: string | null
}

interface ResultInput {
  home_score: number | null
  away_score: number | null
  home_penalties?: number | null
  away_penalties?: number | null
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

  // Exact-score bonus. For a knockout match decided on penalties, the "correct score"
  // is the per-team AGGREGATE (regulation + shootout): a user who predicted the shootout
  // earns the bonus when their reg+pen totals match the actual reg+pen totals, regardless
  // of how the goals split between regulation and the shootout. Otherwise it's the plain
  // exact regulation score.
  const actualWentToPens =
    !isGroupStage &&
    result.home_penalties !== null && result.home_penalties !== undefined &&
    result.away_penalties !== null && result.away_penalties !== undefined

  let exactScore: boolean
  if (actualWentToPens) {
    const predictedPens =
      prediction.predicted_home_penalties !== null && prediction.predicted_home_penalties !== undefined &&
      prediction.predicted_away_penalties !== null && prediction.predicted_away_penalties !== undefined
    exactScore =
      predictedPens &&
      prediction.predicted_home + prediction.predicted_home_penalties! ===
        result.home_score + result.home_penalties! &&
      prediction.predicted_away + prediction.predicted_away_penalties! ===
        result.away_score + result.away_penalties!
  } else {
    exactScore =
      prediction.predicted_home === result.home_score &&
      prediction.predicted_away === result.away_score
  }

  if (exactScore) {
    points += pts.bonus
  }

  return points
}
