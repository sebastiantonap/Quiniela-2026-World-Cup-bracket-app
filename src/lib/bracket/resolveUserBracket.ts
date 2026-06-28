import type { MatchWithTeams, Prediction, Team, RoundName } from '@/types/app'
import { parseSlotPlaceholder } from '@/lib/standings/knockoutSlots'
import { ROUND_ORDER } from '@/lib/constants/rounds'

/**
 * A team resolved for a knockout match slot based on the user's predictions.
 * When the DB already has a team assigned we use that; otherwise we cascade
 * from the user's `predicted_winner_team_id` in the feeder match.
 */
export interface PredictedSlot {
  team: Team | null
  fromPrediction: boolean
}

export interface PredictedMatch {
  home: PredictedSlot
  away: PredictedSlot
}

/** Knockout rounds in bracket order (excludes group_stage). */
const KNOCKOUT_ROUNDS: RoundName[] = ROUND_ORDER.filter(
  (r) => r !== 'group_stage'
)

/**
 * Build a map of matchId → PredictedMatch for every knockout match.
 *
 * For each slot we check:
 *   1. If the match already has a team assigned in the DB, use it.
 *   2. Otherwise parse the placeholder (e.g. "Winner M49") and look up the
 *      user's predicted_winner_team_id for the referenced match.
 *
 * We process rounds in order so earlier round predictions are available when
 * we resolve later rounds.
 */
export function resolveUserBracket(
  matchesByRound: Record<RoundName, MatchWithTeams[]>,
  predictions: Record<string, Prediction>,
  teamById: Map<string, Team>,
): Record<string, PredictedMatch> {
  const result: Record<string, PredictedMatch> = {}

  // match_number → matchId for resolving "Winner M<n>" placeholders
  const matchByNumber = new Map<number, MatchWithTeams>()
  for (const roundMatches of Object.values(matchesByRound)) {
    for (const m of roundMatches) {
      matchByNumber.set(m.match_number, m)
    }
  }

  // QF/SF matches sorted by match_number for "Winner QF1" style references
  const qfMatches = (matchesByRound['quarterfinals'] ?? [])
    .slice()
    .sort((a, b) => a.match_number - b.match_number)
  const sfMatches = (matchesByRound['semifinals'] ?? [])
    .slice()
    .sort((a, b) => a.match_number - b.match_number)

  for (const roundName of KNOCKOUT_ROUNDS) {
    const matches = matchesByRound[roundName] ?? []
    for (const match of matches) {
      const home = resolveSlot(
        match.home_team,
        match.home_team_id,
        match.placeholder_home,
        predictions,
        teamById,
        matchByNumber,
        qfMatches,
        sfMatches,
        result,
      )
      const away = resolveSlot(
        match.away_team,
        match.away_team_id,
        match.placeholder_away,
        predictions,
        teamById,
        matchByNumber,
        qfMatches,
        sfMatches,
        result,
      )
      result[match.id] = { home, away }
    }
  }

  return result
}

function resolveSlot(
  existingTeam: Team | null,
  existingTeamId: string | null,
  placeholder: string | null,
  predictions: Record<string, Prediction>,
  teamById: Map<string, Team>,
  matchByNumber: Map<number, MatchWithTeams>,
  qfMatches: MatchWithTeams[],
  sfMatches: MatchWithTeams[],
  resolved: Record<string, PredictedMatch>,
): PredictedSlot {
  if (existingTeam) {
    return { team: existingTeam, fromPrediction: false }
  }
  if (existingTeamId) {
    return { team: teamById.get(existingTeamId) ?? null, fromPrediction: false }
  }

  const source = parseSlotPlaceholder(placeholder)

  switch (source.type) {
    case 'match_winner': {
      const feederMatch = matchByNumber.get(source.matchNumber)
      if (!feederMatch) return { team: null, fromPrediction: false }
      return resolveWinnerFromPrediction(feederMatch, predictions, teamById, resolved)
    }
    case 'round_rel': {
      const list = source.round === 'QF' ? qfMatches : sfMatches
      const feederMatch = list[source.index - 1]
      if (!feederMatch) return { team: null, fromPrediction: false }
      if (source.want === 'winner') {
        return resolveWinnerFromPrediction(feederMatch, predictions, teamById, resolved)
      }
      return resolveLoserFromPrediction(feederMatch, predictions, teamById, resolved)
    }
    default:
      return { team: null, fromPrediction: false }
  }
}

function resolveWinnerFromPrediction(
  feederMatch: MatchWithTeams,
  predictions: Record<string, Prediction>,
  teamById: Map<string, Team>,
  resolved: Record<string, PredictedMatch>,
): PredictedSlot {
  // If the feeder match has a confirmed winner in DB, use it
  if (feederMatch.winner_team_id) {
    const team = feederMatch.winner_team ?? teamById.get(feederMatch.winner_team_id) ?? null
    return { team, fromPrediction: false }
  }

  // Otherwise use the user's predicted winner
  const pred = predictions[feederMatch.id]
  const winnerId = pred?.predicted_winner_team_id
  if (winnerId) {
    const team = teamById.get(winnerId) ?? null
    return { team, fromPrediction: true }
  }

  // If no prediction but the user predicted a non-tie score, infer the winner
  if (pred?.predicted_home != null && pred?.predicted_away != null && pred.predicted_home !== pred.predicted_away) {
    const inferredId = pred.predicted_home > pred.predicted_away
      ? getSlotTeamId(feederMatch, 'home', resolved)
      : getSlotTeamId(feederMatch, 'away', resolved)
    if (inferredId) {
      return { team: teamById.get(inferredId) ?? null, fromPrediction: true }
    }
  }

  return { team: null, fromPrediction: false }
}

function resolveLoserFromPrediction(
  feederMatch: MatchWithTeams,
  predictions: Record<string, Prediction>,
  teamById: Map<string, Team>,
  resolved: Record<string, PredictedMatch>,
): PredictedSlot {
  // If the feeder match has a confirmed winner in DB, infer the loser
  if (feederMatch.winner_team_id) {
    const participants = [feederMatch.home_team_id, feederMatch.away_team_id].filter(Boolean) as string[]
    const loserId = participants.find((id) => id !== feederMatch.winner_team_id)
    if (loserId) {
      return { team: teamById.get(loserId) ?? null, fromPrediction: false }
    }
    return { team: null, fromPrediction: false }
  }

  // Otherwise use the user's predicted winner to infer the loser
  const pred = predictions[feederMatch.id]
  const winnerId = pred?.predicted_winner_team_id
  if (winnerId) {
    const homeId = getSlotTeamId(feederMatch, 'home', resolved)
    const awayId = getSlotTeamId(feederMatch, 'away', resolved)
    const loserId = winnerId === homeId ? awayId : homeId
    if (loserId) {
      return { team: teamById.get(loserId) ?? null, fromPrediction: true }
    }
  }

  return { team: null, fromPrediction: false }
}

/** Get the effective team id for a slot (DB or predicted). */
function getSlotTeamId(
  match: MatchWithTeams,
  side: 'home' | 'away',
  resolved: Record<string, PredictedMatch>,
): string | null {
  const dbId = side === 'home' ? match.home_team_id : match.away_team_id
  if (dbId) return dbId
  const predicted = resolved[match.id]
  if (!predicted) return null
  return (side === 'home' ? predicted.home.team?.id : predicted.away.team?.id) ?? null
}

/**
 * Given the current predictions and a match whose winner just changed,
 * return the set of downstream matchIds whose predictions should be cleared
 * because the teams flowing into them changed.
 */
export function findStaleDownstream(
  changedMatchId: string,
  matchesByRound: Record<RoundName, MatchWithTeams[]>,
  predictions: Record<string, Prediction>,
): Set<string> {
  const stale = new Set<string>()

  // matchId → match_number
  const matchIdToNumber = new Map<string, number>()
  // match_number → matchId
  const matchNumberToId = new Map<number, string>()

  for (const roundMatches of Object.values(matchesByRound)) {
    for (const m of roundMatches) {
      matchIdToNumber.set(m.id, m.match_number)
      matchNumberToId.set(m.match_number, m.id)
    }
  }

  const qfMatches = (matchesByRound['quarterfinals'] ?? [])
    .slice()
    .sort((a, b) => a.match_number - b.match_number)
  const sfMatches = (matchesByRound['semifinals'] ?? [])
    .slice()
    .sort((a, b) => a.match_number - b.match_number)

  // BFS: find all matches that reference the changed match
  const queue = [changedMatchId]
  while (queue.length > 0) {
    const currentId = queue.shift()!
    const currentNumber = matchIdToNumber.get(currentId)
    if (currentNumber === undefined) continue

    for (const roundName of KNOCKOUT_ROUNDS) {
      for (const m of matchesByRound[roundName] ?? []) {
        if (stale.has(m.id)) continue

        const feedsFromCurrent = (ph: string | null): boolean => {
          const src = parseSlotPlaceholder(ph)
          if (src.type === 'match_winner' && matchNumberToId.get(src.matchNumber) === currentId) return true
          if (src.type === 'round_rel') {
            const list = src.round === 'QF' ? qfMatches : sfMatches
            const refMatch = list[src.index - 1]
            if (refMatch && refMatch.id === currentId) return true
          }
          return false
        }

        if (feedsFromCurrent(m.placeholder_home) || feedsFromCurrent(m.placeholder_away)) {
          // Only mark as stale if the user has a prediction for this match
          if (predictions[m.id]) {
            stale.add(m.id)
          }
          queue.push(m.id)
        }
      }
    }
  }

  return stale
}
