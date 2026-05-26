import type { Team, MatchWithTeams, TeamStanding } from '@/types/app'

export function computeGroupStandings(
  teams: Team[],
  matches: MatchWithTeams[]
): TeamStanding[] {
  const standings = new Map<string, TeamStanding>(
    teams.map((team) => [
      team.id,
      {
        team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goals_for: 0,
        goals_against: 0,
        goal_difference: 0,
        points: 0,
      },
    ])
  )

  for (const match of matches) {
    if (
      match.home_score === null ||
      match.away_score === null ||
      !match.result_confirmed ||
      !match.home_team_id ||
      !match.away_team_id
    ) {
      continue
    }

    const home = standings.get(match.home_team_id)
    const away = standings.get(match.away_team_id)
    if (!home || !away) continue

    const hs = match.home_score
    const as_ = match.away_score

    home.played++
    away.played++
    home.goals_for += hs
    home.goals_against += as_
    away.goals_for += as_
    away.goals_against += hs

    if (hs > as_) {
      home.won++
      home.points += 3
      away.lost++
    } else if (hs === as_) {
      home.drawn++
      home.points += 1
      away.drawn++
      away.points += 1
    } else {
      away.won++
      away.points += 3
      home.lost++
    }

    home.goal_difference = home.goals_for - home.goals_against
    away.goal_difference = away.goals_for - away.goals_against
  }

  const result = Array.from(standings.values())

  // Sort: points → GD → GF → team name (proxy for H2H tiebreaker; admin confirms)
  result.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for
    return a.team.name.localeCompare(b.team.name)
  })

  return result
}
