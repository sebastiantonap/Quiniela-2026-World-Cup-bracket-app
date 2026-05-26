'use client'

import { computeGroupStandings } from '@/lib/standings/groupStandings'
import { GROUP_LETTERS } from '@/lib/constants/rounds'
import type { MatchWithTeams, Team } from '@/types/app'

interface GroupStandingsProps {
  matches: MatchWithTeams[]
  teams: Team[]
}

export function GroupStandings({ matches, teams }: GroupStandingsProps) {
  const groupStageMatches = matches.filter((m) => m.round?.name === 'group_stage')

  return (
    <div className="space-y-6">
      {GROUP_LETTERS.map((letter) => {
        const groupTeams = teams.filter((t) => t.group_id && groupStageMatches.some(
          (m) => m.group?.name === letter && (m.home_team_id === t.id || m.away_team_id === t.id)
        ))
        const groupMatches = groupStageMatches.filter((m) => m.group?.name === letter)

        if (groupTeams.length === 0) return null

        const standings = computeGroupStandings(groupTeams, groupMatches)

        return (
          <div key={letter} className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
              <h3 className="font-bold text-sm">Group {letter}</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-50">
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
              <tbody className="divide-y divide-gray-50">
                {standings.map((s, i) => (
                  <tr
                    key={s.team.id}
                    className={`${i < 2 ? 'bg-green-50' : i === 2 ? 'bg-yellow-50' : ''}`}
                  >
                    <td className="px-4 py-2 font-medium">
                      {s.team.flag_emoji} {s.team.name}
                      {i < 2 && <span className="ml-1 text-xs text-green-600">●</span>}
                      {i === 2 && <span className="ml-1 text-xs text-yellow-600">●</span>}
                    </td>
                    <td className="px-2 py-2 text-center">{s.played}</td>
                    <td className="px-2 py-2 text-center">{s.won}</td>
                    <td className="px-2 py-2 text-center">{s.drawn}</td>
                    <td className="px-2 py-2 text-center">{s.lost}</td>
                    <td className="px-2 py-2 text-center">{s.goals_for}</td>
                    <td className="px-2 py-2 text-center">{s.goals_against}</td>
                    <td className="px-2 py-2 text-center">{s.goal_difference > 0 ? '+' : ''}{s.goal_difference}</td>
                    <td className="px-2 py-2 text-center font-bold">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2 text-xs text-gray-400">
              Green = qualify automatically | Yellow = potential best 3rd place
            </p>
          </div>
        )
      })}
    </div>
  )
}
