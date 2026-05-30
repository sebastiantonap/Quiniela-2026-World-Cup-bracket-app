'use client'

import { useState, useTransition } from 'react'
import { computeGroupStandings } from '@/lib/standings/groupStandings'
import { GROUP_LETTERS } from '@/lib/constants/rounds'
import { confirmThirdPlaceQualifiers } from '@/actions/admin/confirmThirdPlaceQualifiers'
import type { MatchWithTeams, Team, TeamStanding } from '@/types/app'

interface GroupStandingsProps {
  matches: MatchWithTeams[]
  teams: Team[]
}

type ThirdPlaceEntry = TeamStanding & { group: string }

function isTied(a: TeamStanding, b: TeamStanding) {
  return (
    a.points === b.points &&
    a.goal_difference === b.goal_difference &&
    a.goals_for === b.goals_for
  )
}

export function GroupStandings({ matches, teams }: GroupStandingsProps) {
  const groupStageMatches = matches.filter((m) => m.round?.name === 'group_stage')

  const thirdPlaceTeams: ThirdPlaceEntry[] = []

  const groupStandingsMap = GROUP_LETTERS.map((letter) => {
    const groupTeams = teams.filter(
      (t) =>
        t.group_id &&
        groupStageMatches.some(
          (m) => m.group?.name === letter && (m.home_team_id === t.id || m.away_team_id === t.id)
        )
    )
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

  // Find tie zone crossing the rank-8/rank-9 cut (0-indexed: index 7 vs 8)
  let tieZoneStart = 8
  let tieZoneEnd = 7

  if (thirdPlaceTeams.length >= 9 && isTied(thirdPlaceTeams[7], thirdPlaceTeams[8])) {
    tieZoneStart = 7
    tieZoneEnd = 8
    while (tieZoneStart > 0 && isTied(thirdPlaceTeams[tieZoneStart - 1], thirdPlaceTeams[7])) {
      tieZoneStart--
    }
    while (
      tieZoneEnd < thirdPlaceTeams.length - 1 &&
      isTied(thirdPlaceTeams[7], thirdPlaceTeams[tieZoneEnd + 1])
    ) {
      tieZoneEnd++
    }
  }

  const hasBoundaryTie = tieZoneStart <= 7 && tieZoneEnd >= 8

  const preConfirmedIds = new Set(
    thirdPlaceTeams.filter((t) => t.team.best_third_qualified).map((t) => t.team.id)
  )

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () =>
      preConfirmedIds.size > 0
        ? preConfirmedIds
        : new Set(thirdPlaceTeams.slice(0, Math.min(8, thirdPlaceTeams.length)).map((t) => t.team.id))
  )
  const [isPending, startTransition] = useTransition()
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [confirmSuccess, setConfirmSuccess] = useState(preConfirmedIds.size > 0)

  function getRowStatus(index: number): 'locked-in' | 'locked-out' | 'selectable' {
    if (!hasBoundaryTie) return index < 8 ? 'locked-in' : 'locked-out'
    if (index < tieZoneStart) return 'locked-in'
    if (index > tieZoneEnd) return 'locked-out'
    return 'selectable'
  }

  function toggleTeam(teamId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      return next
    })
    setConfirmSuccess(false)
  }

  function handleConfirm() {
    if (selectedIds.size !== 8) return
    setConfirmError(null)
    startTransition(async () => {
      const result = await confirmThirdPlaceQualifiers(Array.from(selectedIds))
      if (result.error) setConfirmError(result.error)
      else setConfirmSuccess(true)
    })
  }

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
                    <td className="px-2 py-2 text-center text-slate-300">
                      {s.goal_difference > 0 ? '+' : ''}
                      {s.goal_difference}
                    </td>
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
          <div className="border-b border-amber-700/50 bg-amber-900/20 px-4 py-3 flex items-center justify-between">
            <h3 className="font-bold text-sm text-amber-300">
              Best 3rd-Place Teams ({thirdPlaceTeams.length}/12) — pick 8 to advance
            </h3>
            <span className="text-xs text-slate-400">
              {selectedIds.size}/8 selected
            </span>
          </div>

          {hasBoundaryTie && (
            <div className="border-b border-amber-700/30 bg-amber-900/10 px-4 py-2 text-xs text-amber-300">
              Tie detected at the rank-8/9 boundary — select which teams advance manually.
            </div>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-700">
                <th className="px-3 py-2 text-center w-8">#</th>
                <th className="px-3 py-2 w-8"></th>
                <th className="px-4 py-2 text-left">Team</th>
                <th className="px-2 py-2 text-center">Grp</th>
                <th className="px-2 py-2 text-center">GF</th>
                <th className="px-2 py-2 text-center">GA</th>
                <th className="px-2 py-2 text-center">GD</th>
                <th className="px-2 py-2 text-center font-bold">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {thirdPlaceTeams.map((s, i) => {
                const status = getRowStatus(i)
                const isSelected = selectedIds.has(s.team.id)

                return (
                  <tr
                    key={s.team.id}
                    className={
                      status === 'locked-in'
                        ? 'bg-green-900/20'
                        : status === 'selectable' && isSelected
                        ? 'bg-amber-900/20'
                        : status === 'selectable'
                        ? 'bg-slate-700/20'
                        : ''
                    }
                  >
                    <td className="px-3 py-2 text-center text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2 text-center">
                      {status === 'locked-in' && (
                        <span className="text-green-400 text-sm">✓</span>
                      )}
                      {status === 'locked-out' && (
                        <span className="text-slate-600 text-sm">✗</span>
                      )}
                      {status === 'selectable' && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTeam(s.team.id)}
                          className="accent-amber-400 w-4 h-4 cursor-pointer"
                        />
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium text-slate-200">
                      {s.team.flag_emoji} {s.team.name}
                    </td>
                    <td className="px-2 py-2 text-center text-slate-400 text-xs">{s.group}</td>
                    <td className="px-2 py-2 text-center text-slate-300">{s.goals_for}</td>
                    <td className="px-2 py-2 text-center text-slate-300">{s.goals_against}</td>
                    <td className="px-2 py-2 text-center text-slate-300">
                      {s.goal_difference > 0 ? '+' : ''}
                      {s.goal_difference}
                    </td>
                    <td className="px-2 py-2 text-center font-bold text-slate-100">{s.points}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="border-t border-slate-700 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {hasBoundaryTie
                ? 'Check/uncheck tied teams until exactly 8 are selected'
                : 'Ranked by Pts → GD → GF | Confirm to lock in the 8 qualifiers'}
            </p>
            <div className="flex items-center gap-3">
              {confirmError && (
                <span className="text-xs text-red-400">{confirmError}</span>
              )}
              {confirmSuccess && (
                <span className="text-xs text-green-400">Saved</span>
              )}
              <button
                onClick={handleConfirm}
                disabled={selectedIds.size !== 8 || isPending}
                className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isPending ? 'Saving…' : 'Confirm qualifiers'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
