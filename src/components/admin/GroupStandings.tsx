'use client'

import { computeGroupStandings } from '@/lib/standings/groupStandings'
import { GROUP_LETTERS } from '@/lib/constants/rounds'
import type { MatchWithTeams, Team, TeamStanding } from '@/types/app'

interface GroupStandingsProps {
  matches: MatchWithTeams[]
  teams: Team[]
}

export function GroupStandings({ matches, teams }: GroupStandingsProps) {
  const groupStageMatches = matches.filter((m) => m.round?.name === 'group_stage')

  const thirdPlaceTeams: (TeamStanding & { group: string })[] = []

  const groupStandingsMap = GROUP_LETTERS.map((letter) => {
    const groupTeams = teams.filter((t) => t.group_id && groupStageMatches.some(
      (m) => m.group?.name === letter && (m.home_team_id === t.id || m.away_team_id === t.id)
    ))
    const groupMatches = groupStageMatches.filter((m) => m.group?.name === letter)
    if (groupTeams.length === 0) return { letter, standings: [] }
    const standings = computeGroupStandings(groupTeams, groupMatches)
    if (standings[2]) thirdPlaceTeams.push({ ...standings[2], group: letter })
    return { letter, standings }
  })

  thirdPlaceTeams.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for
    return a.team.name.localeCompare(b.team.name)
  })

  return (
    <div className="space-y-6">
      {groupStandingsMap.map(({ letter, standings }) => {
        if (standings.length === 0) return null

        return (
          <div key={letter} className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
            <div className="border-b border-slate-700 bg-slate-700/50 px-4 py-2">
              <h3 className="font-bold text-sm text-slate-200">Group {letter}</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-700">
                  <th className="px-4 py-2 text-left">Team</th>
                  <th className="px-2 py-2 text-center">P</th>
                  <th className="px-2 py-2 text-center">W</th>
                  <th className="px-2 py-2 text-center">D</th>
                  <th className="px-2 py-2 text-center">L</th>
                  <th className="px-2 py-2 text-center">GF</th>
                  <th className="px-2 py-2 text-center">GA</th>
                  <th className="px-2 py-2 text-center">GD</th>
                  <th className="px-2 py-2 text-center font-bold">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {standings.map((s, i) => (
                  <tr
                    key={s.team.id}
                    className={`${i < 2 ? 'bg-green-900/20' : i === 2 ? 'bg-amber-900/20' : ''}`}
                  >
                    <td className="px-4 py-2 font-medium text-slate-200">
                      {s.team.flag_emoji} {s.team.name}
                      {i < 2 && <span className="ml-1 text-xs text-green-400">●</span>}
                      {i === 2 && <span className="ml-1 text-xs text-amber-400">●</span>}
                    </td>
                    <td className="px-2 py-2 text-center text-slate-300">{s.played}</td>
                    <td className="px-2 py-2 text-center text-slate-300">{s.won}</td>
                    <td className="px-2 py-2 text-center text-slate-300">{s.drawn}</td>
                    <td className="px-2 py-2 text-center text-slate-300">{s.lost}</td>
                    <td className="px-2 py-2 text-center text-slate-300">{s.goals_for}</td>
                    <td className="px-2 py-2 text-center text-slate-300">{s.goals_against}</td>
                    <td className="px-2 py-2 text-center text-slate-300">{s.goal_difference > 0 ? '+' : ''}{s.goal_difference}</td>
                    <td className="px-2 py-2 text-center font-bold text-slate-100">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2 text-xs text-slate-500">
              Green = qualify automatically | Amber = potential best 3rd place
            </p>
          </div>
        )
      })}

      {thirdPlaceTeams.length > 0 && (
        <div className="rounded-2xl bg-slate-800 border border-amber-700/50 overflow-hidden">
          <div className="border-b border-amber-700/50 bg-amber-900/20 px-4 py-2">
            <h3 className="font-bold text-sm text-amber-300">
              Best 3rd-Place Teams ({thirdPlaceTeams.length}/12) — top 8 advance
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-700">
                <th className="px-3 py-2 text-center">#</th>
                <th className="px-4 py-2 text-left">Team</th>
                <th className="px-2 py-2 text-center">Grp</th>
                <th className="px-2 py-2 text-center">GF</th>
                <th className="px-2 py-2 text-center">GA</th>
                <th className="px-2 py-2 text-center">GD</th>
                <th className="px-2 py-2 text-center font-bold">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {thirdPlaceTeams.map((s, i) => (
                <tr
                  key={s.team.id}
                  className={i < 8 ? 'bg-amber-900/20' : ''}
                >
                  <td className="px-3 py-2 text-center text-slate-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-2 font-medium text-slate-200">
                    {s.team.flag_emoji} {s.team.name}
                    {i < 8 && <span className="ml-1 text-xs text-amber-400">●</span>}
                  </td>
                  <td className="px-2 py-2 text-center text-slate-400 text-xs">{s.group}</td>
                  <td className="px-2 py-2 text-center text-slate-300">{s.goals_for}</td>
                  <td className="px-2 py-2 text-center text-slate-300">{s.goals_against}</td>
                  <td className="px-2 py-2 text-center text-slate-300">{s.goal_difference > 0 ? '+' : ''}{s.goal_difference}</td>
                  <td className="px-2 py-2 text-center font-bold text-slate-100">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-slate-500">
            Ranked by Pts → GD → GF | Amber = advancing to Round of 32
          </p>
        </div>
      )}
    </div>
  )
}
