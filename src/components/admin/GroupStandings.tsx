'use client'

import { useState, useTransition } from 'react'
import { computeGroupStandings, isStandingsTie } from '@/lib/standings/groupStandings'
import { GROUP_LETTERS } from '@/lib/constants/rounds'
import { confirmThirdPlaceQualifiers } from '@/actions/admin/confirmThirdPlaceQualifiers'
import { confirmGroupStandings } from '@/actions/admin/confirmGroupStandings'
import { useT } from '@/lib/i18n/I18nProvider'
import type { MatchWithTeams, Team, TeamStanding } from '@/types/app'

interface GroupStandingsProps {
  matches: MatchWithTeams[]
  teams: Team[]
}

type ThirdPlaceEntry = TeamStanding & { group: string }

const isTied = isStandingsTie

/**
 * Return standings in confirmed order if every team has a confirmed_position,
 * otherwise return the computed standings unchanged.
 */
function applyConfirmedOrder(standings: TeamStanding[]): TeamStanding[] {
  if (standings.length === 0) return standings
  const allConfirmed = standings.every(s => s.team.confirmed_position !== null)
  if (!allConfirmed) return standings
  return [...standings].sort((a, b) => a.team.confirmed_position! - b.team.confirmed_position!)
}

/** True when any pair of adjacent teams in the list shares a full tie. */
function hasTies(standings: TeamStanding[]): boolean {
  for (let i = 0; i < standings.length - 1; i++) {
    if (isTied(standings[i], standings[i + 1])) return true
  }
  return false
}

export function GroupStandings({ matches, teams }: GroupStandingsProps) {
  const t = useT()
  const groupStageMatches = matches.filter((m) => m.round?.name === 'group_stage')

  // ---------- Compute per-group data ----------
  const groupData = GROUP_LETTERS.map((letter) => {
    const groupTeams = teams.filter(
      (tm) =>
        tm.group_id &&
        groupStageMatches.some(
          (m) => m.group?.name === letter && (m.home_team_id === tm.id || m.away_team_id === tm.id)
        )
    )
    const groupMatches = groupStageMatches.filter((m) => m.group?.name === letter)
    if (groupTeams.length === 0) return { letter, standings: [] as TeamStanding[], groupId: null, confirmedCount: 0, allMatchesConfirmed: false }

    const computed = computeGroupStandings(groupTeams, groupMatches)
    const standings = applyConfirmedOrder(computed)
    const groupId = groupTeams[0]?.group_id ?? null
    const confirmedCount = groupMatches.filter(m => m.result_confirmed).length
    const allMatchesConfirmed = confirmedCount >= 6

    return { letter, standings, groupId, confirmedCount, allMatchesConfirmed }
  })

  // ---------- Group standings reorder + confirm state ----------
  const [reorderedGroups, setReorderedGroups] = useState<Record<string, TeamStanding[]>>({})
  const [groupConfirmPending, setGroupConfirmPending] = useState<Record<string, boolean>>({})
  const [groupConfirmError, setGroupConfirmError] = useState<Record<string, string | null>>({})
  const [groupConfirmSuccess, setGroupConfirmSuccess] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const g of groupData) {
      if (g.standings.length > 0 && g.standings.every(s => s.team.confirmed_position !== null)) {
        init[g.letter] = true
      }
    }
    return init
  })

  function getDisplayStandings(letter: string, computedStandings: TeamStanding[]): TeamStanding[] {
    return reorderedGroups[letter] ?? computedStandings
  }

  function swapTeams(letter: string, baseStandings: TeamStanding[], index: number) {
    const current = reorderedGroups[letter] ?? baseStandings
    const next = [...current]
    const tmp = next[index]
    next[index] = next[index + 1]
    next[index + 1] = tmp
    setReorderedGroups(prev => ({ ...prev, [letter]: next }))
    setGroupConfirmSuccess(prev => ({ ...prev, [letter]: false }))
  }

  function handleConfirmGroup(letter: string, groupId: string, displayStandings: TeamStanding[]) {
    if (displayStandings.length !== 4) return
    setGroupConfirmError(prev => ({ ...prev, [letter]: null }))
    setGroupConfirmPending(prev => ({ ...prev, [letter]: true }))

    const orderedIds = displayStandings.map(s => s.team.id)
    confirmGroupStandings(groupId, orderedIds).then(result => {
      if (result.error) {
        setGroupConfirmError(prev => ({ ...prev, [letter]: result.error! }))
      } else {
        setGroupConfirmSuccess(prev => ({ ...prev, [letter]: true }))
      }
      setGroupConfirmPending(prev => ({ ...prev, [letter]: false }))
    })
  }

  // ---------- Third-place ranking (uses display order) ----------
  const thirdPlaceTeams: ThirdPlaceEntry[] = []
  for (const g of groupData) {
    const display = getDisplayStandings(g.letter, g.standings)
    if (display[2]) thirdPlaceTeams.push({ ...display[2], group: g.letter })
  }

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
    thirdPlaceTeams.filter((tp) => tp.team.best_third_qualified).map((tp) => tp.team.id)
  )

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () =>
      preConfirmedIds.size > 0
        ? preConfirmedIds
        : new Set(thirdPlaceTeams.slice(0, Math.min(8, thirdPlaceTeams.length)).map((tp) => tp.team.id))
  )
  const [isPending, startTransition] = useTransition()
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [confirmSuccess, setConfirmSuccess] = useState(preConfirmedIds.size > 0)

  const effectiveIds = hasBoundaryTie
    ? Array.from(selectedIds)
    : thirdPlaceTeams.slice(0, 8).map((tp) => tp.team.id)
  const canConfirm = !isPending && effectiveIds.length === 8

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
    if (effectiveIds.length !== 8) return
    setConfirmError(null)
    startTransition(async () => {
      const result = await confirmThirdPlaceQualifiers(effectiveIds)
      if (result.error) setConfirmError(result.error)
      else setConfirmSuccess(true)
    })
  }

  return (
    <div className="space-y-6">
      {groupData.map(({ letter, standings, groupId, allMatchesConfirmed }) => {
        if (standings.length === 0) return null
        const display = getDisplayStandings(letter, standings)
        const showTies = allMatchesConfirmed && hasTies(display)
        const isGroupPending = groupConfirmPending[letter]
        const groupError = groupConfirmError[letter]
        const groupSuccess = groupConfirmSuccess[letter]

        return (
          <div key={letter} className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
            <div className="border-b border-slate-700 bg-slate-700/50 px-4 py-2 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-200">{t('group.name', { letter })}</h3>
              {groupSuccess && (
                <span className="text-xs text-green-400">{t('admin.standings.orderConfirmed')}</span>
              )}
            </div>

            {showTies && !groupSuccess && (
              <div className="border-b border-amber-700/30 bg-amber-900/10 px-4 py-2 text-xs text-amber-300">
                {t('admin.standings.tieNotice')}
              </div>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-700">
                  <th className="px-4 py-2 text-left">{t('common.team')}</th>
                  <th className="px-2 py-2 text-center">{t('abbr.played')}</th>
                  <th className="px-2 py-2 text-center">{t('abbr.won')}</th>
                  <th className="px-2 py-2 text-center">{t('abbr.drawn')}</th>
                  <th className="px-2 py-2 text-center">{t('abbr.lost')}</th>
                  <th className="px-2 py-2 text-center">{t('abbr.gf')}</th>
                  <th className="px-2 py-2 text-center">{t('abbr.ga')}</th>
                  <th className="px-2 py-2 text-center">{t('abbr.gd')}</th>
                  <th className="px-2 py-2 text-center font-bold">{t('abbr.pts')}</th>
                  {showTies && <th className="px-2 py-2 w-16"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {display.map((s, i) => {
                  const canSwapDown = showTies && i < display.length - 1 && isTied(display[i], display[i + 1])
                  const canSwapUp = showTies && i > 0 && isTied(display[i - 1], display[i])
                  return (
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
                      {showTies && (
                        <td className="px-2 py-2 text-center">
                          <div className="flex justify-center gap-1">
                            {canSwapUp && (
                              <button
                                onClick={() => swapTeams(letter, standings, i - 1)}
                                className="text-slate-400 hover:text-amber-400 text-xs leading-none"
                                title="Move up"
                              >
                                ▲
                              </button>
                            )}
                            {canSwapDown && (
                              <button
                                onClick={() => swapTeams(letter, standings, i)}
                                className="text-slate-400 hover:text-amber-400 text-xs leading-none"
                                title="Move down"
                              >
                                ▼
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="px-4 py-2 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {t('admin.standings.legend')}
              </p>
              {allMatchesConfirmed && groupId && display.length === 4 && (
                <div className="flex items-center gap-3">
                  {groupError && <span className="text-xs text-red-400">{groupError}</span>}
                  <button
                    onClick={() => handleConfirmGroup(letter, groupId, display)}
                    disabled={isGroupPending}
                    className="rounded-lg bg-slate-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isGroupPending ? t('common.savingCap') : t('admin.standings.confirmOrder')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {thirdPlaceTeams.length > 0 && (
        <div className="rounded-2xl bg-slate-800 border border-amber-700/50 overflow-hidden">
          <div className="border-b border-amber-700/50 bg-amber-900/20 px-4 py-3 flex items-center justify-between">
            <h3 className="font-bold text-sm text-amber-300">
              {t('admin.standings.bestThirdTitle', { count: thirdPlaceTeams.length })}
            </h3>
            <span className="text-xs text-slate-400">
              {t('admin.standings.selectedCount', { count: effectiveIds.length })}
            </span>
          </div>

          {hasBoundaryTie && (
            <div className="border-b border-amber-700/30 bg-amber-900/10 px-4 py-2 text-xs text-amber-300">
              {t('admin.standings.boundaryTie')}
            </div>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-700">
                <th className="px-3 py-2 text-center w-8">#</th>
                <th className="px-3 py-2 w-8"></th>
                <th className="px-4 py-2 text-left">{t('common.team')}</th>
                <th className="px-2 py-2 text-center">{t('abbr.group')}</th>
                <th className="px-2 py-2 text-center">{t('abbr.gf')}</th>
                <th className="px-2 py-2 text-center">{t('abbr.ga')}</th>
                <th className="px-2 py-2 text-center">{t('abbr.gd')}</th>
                <th className="px-2 py-2 text-center font-bold">{t('abbr.pts')}</th>
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
                ? t('admin.standings.footerTie')
                : t('admin.standings.footerNoTie')}
            </p>
            <div className="flex items-center gap-3">
              {confirmError && (
                <span className="text-xs text-red-400">{confirmError}</span>
              )}
              {confirmSuccess && (
                <span className="text-xs text-green-400">{t('common.saved')}</span>
              )}
              <button
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isPending ? t('common.savingCap') : t('admin.standings.confirmQualifiers')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
