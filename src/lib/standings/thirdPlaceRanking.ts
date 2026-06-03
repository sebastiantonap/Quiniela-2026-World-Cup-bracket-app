import type { Group, MatchWithTeams, Prediction, QualState, Team } from '@/types/app'
import { computePredictedStandings } from './predictedStandings'
import { GROUP_LETTERS } from '@/lib/constants/rounds'

export interface ThirdPlaceEntry {
  group: string
  teamId: string
  teamName: string
  flagEmoji: string | null
  points: number
  goals_for: number
  goals_against: number
  goal_difference: number
}

type TieStat = Pick<ThirdPlaceEntry, 'points' | 'goal_difference' | 'goals_for'>

export function isTied(a: TieStat, b: TieStat): boolean {
  return (
    a.points === b.points &&
    a.goal_difference === b.goal_difference &&
    a.goals_for === b.goals_for
  )
}

export function computeTieZone(teams: ThirdPlaceEntry[]): {
  tieZoneStart: number
  tieZoneEnd: number
  hasBoundaryTie: boolean
} {
  let tieZoneStart = 8
  let tieZoneEnd = 7

  if (teams.length >= 9 && isTied(teams[7], teams[8])) {
    tieZoneStart = 7
    tieZoneEnd = 8

    while (tieZoneStart > 0 && isTied(teams[tieZoneStart - 1], teams[7])) {
      tieZoneStart--
    }
    while (
      tieZoneEnd < teams.length - 1 &&
      isTied(teams[7], teams[tieZoneEnd + 1])
    ) {
      tieZoneEnd++
    }
  }

  return {
    tieZoneStart,
    tieZoneEnd,
    hasBoundaryTie: tieZoneStart <= 7 && tieZoneEnd >= 8,
  }
}

export type ThirdPlaceRowStatus = 'locked-in' | 'locked-out' | 'selectable'

export function getRowStatus(
  index: number,
  tieZoneStart: number,
  tieZoneEnd: number,
  hasBoundaryTie: boolean
): ThirdPlaceRowStatus {
  if (!hasBoundaryTie) return index < 8 ? 'locked-in' : 'locked-out'
  if (index < tieZoneStart) return 'locked-in'
  if (index > tieZoneEnd) return 'locked-out'
  return 'selectable'
}

export function sortThirdPlaceTeams(teams: ThirdPlaceEntry[]): ThirdPlaceEntry[] {
  return [...teams].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for
    return a.teamName.localeCompare(b.teamName)
  })
}

/**
 * The ranked set of each group's predicted 3rd-place team, drawn from the user's
 * predictions. When a group's 3rd slot sits in an unresolved tie (the 2nd/3rd or
 * 3rd/4th boundary), the user's explicit pick (`predicted3rd`) wins over the raw
 * standings order, so the team the user chose to advance as 3rd is the one ranked.
 * Groups with no predictions yet are skipped.
 *
 * Single source of truth for both the group-stage tab summary and the best-third
 * selector modal, so the two can never disagree about which team is a group's 3rd
 * or about the 8/9 boundary tie derived from that set.
 */
export function computeEffectiveThirds(
  groups: (Group & { teams: Team[] })[],
  groupStageMatches: MatchWithTeams[],
  predictions: Record<string, Prediction>,
  quals: QualState
): ThirdPlaceEntry[] {
  const entries: ThirdPlaceEntry[] = []

  for (const letter of GROUP_LETTERS) {
    const group = groups.find((g) => g.name === letter)
    if (!group) continue

    const groupMatches = groupStageMatches.filter((m) => m.group?.name === letter)
    const { standings, ambiguities, predictedMatchCount } = computePredictedStandings(
      group.teams,
      groupMatches,
      predictions
    )

    if (predictedMatchCount === 0 || !standings[2]) continue

    // When 3rd is tied with 2nd or 4th, prefer the user's explicit pick over standings[2].
    const userPick3rd = quals[group.id]?.predicted3rd ?? null
    const hasTie = ambiguities.second || ambiguities.third
    const effectiveTeamId = hasTie && userPick3rd ? userPick3rd : standings[2].team.id

    const s = standings.find((st) => st.team.id === effectiveTeamId) ?? standings[2]
    entries.push({
      group: letter,
      teamId: s.team.id,
      teamName: s.team.name,
      flagEmoji: s.team.flag_emoji,
      points: s.points,
      goals_for: s.goals_for,
      goals_against: s.goals_against,
      goal_difference: s.goal_difference,
    })
  }

  return sortThirdPlaceTeams(entries)
}
