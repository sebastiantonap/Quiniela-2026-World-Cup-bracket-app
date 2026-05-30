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
