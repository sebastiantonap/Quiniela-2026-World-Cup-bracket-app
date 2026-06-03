'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  computeEffectiveThirds,
  computeTieZone,
  getRowStatus,
  type ThirdPlaceEntry,
} from '@/lib/standings/thirdPlaceRanking'
import { upsertThirdPlaceSelections } from '@/actions/thirdPlaceSelections'
import { useT } from '@/lib/i18n/I18nProvider'
import { roundLabel } from '@/lib/i18n/translator'
import type { MatchWithTeams, Prediction, Team, Group, QualState } from '@/types/app'

interface ThirdPlaceSelectorProps {
  entryId: string
  groups: (Group & { teams: Team[] })[]
  matches: MatchWithTeams[]
  predictions: Record<string, Prediction>
  isEditable: boolean
  initialSelections: string[]
  onClose: () => void
  quals: QualState
}

export function ThirdPlaceSelector({
  entryId,
  groups,
  matches,
  predictions,
  isEditable,
  initialSelections,
  onClose,
  quals,
}: ThirdPlaceSelectorProps) {
  const t = useT()
  const groupStageMatches = matches.filter((m) => m.round?.name === 'group_stage')

  // Predicted 3rd-place teams for each group (tie-aware, user pick wins) — shared
  // with the group-stage tab so both views agree on the set.
  const thirdPlaceTeams = useMemo<ThirdPlaceEntry[]>(
    () => computeEffectiveThirds(groups, groupStageMatches, predictions, quals),
    [groups, groupStageMatches, predictions, quals]
  )

  const { tieZoneStart, tieZoneEnd, hasBoundaryTie } = useMemo(
    () => computeTieZone(thirdPlaceTeams),
    [thirdPlaceTeams]
  )

  // Build initial selection set
  const initialSet = useMemo<Set<string>>(() => {
    if (initialSelections.length > 0) return new Set(initialSelections)
    // Auto-fill top 8 (excluding tie zone selectable teams)
    const auto = new Set<string>()
    for (let i = 0; i < thirdPlaceTeams.length && i < 8; i++) {
      const status = getRowStatus(i, tieZoneStart, tieZoneEnd, hasBoundaryTie)
      if (status === 'locked-in') auto.add(thirdPlaceTeams[i].teamId)
    }
    return auto
  }, [initialSelections, thirdPlaceTeams, tieZoneStart, tieZoneEnd, hasBoundaryTie])

  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialSet)
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const router = useRouter()

  function toggle(teamId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      return next
    })
    setSaved(false)
  }

  function handleConfirm() {
    setSaveError(null)
    startTransition(async () => {
      const result = await upsertThirdPlaceSelections(entryId, Array.from(selectedIds))
      if (result.error) setSaveError(result.error)
      else {
        setSaved(true)
        // Re-fetch server data so the parent's confirmed count and the knockout
        // eligibility set (both derived from the server-provided selections) update.
        router.refresh()
      }
    })
  }

  const predictedCount = thirdPlaceTeams.length
  const selectedCount = selectedIds.size
  const canConfirm = isEditable && selectedCount === 8 && !isPending

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-700 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-100">{t('best8.title')}</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {t('third.subtitle', { count: predictedCount, round: roundLabel(t, 'round_of_32') })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-slate-400 transition hover:text-slate-200 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Info note */}
        <div className="border-b border-slate-700/60 bg-slate-800/40 px-5 py-2.5 text-xs text-slate-400">
          {t('third.rankedNote')}
        </div>

        {/* Amber warning when < 12 groups predicted */}
        {predictedCount < 12 && predictedCount > 0 && (
          <div className="border-b border-amber-700/30 bg-amber-900/10 px-5 py-2 text-xs text-amber-300">
            {t(12 - predictedCount === 1 ? 'third.groupsRemainingOne' : 'third.groupsRemainingOther', { count: 12 - predictedCount })}
          </div>
        )}

        {predictedCount === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">
            {t('third.enterScores')}
          </div>
        ) : (
          <>
            {hasBoundaryTie && (
              <div className="border-b border-amber-700/30 bg-amber-900/10 px-5 py-2 text-xs text-amber-300">
                {t('third.boundaryTie')}
              </div>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="w-8 px-3 py-2 text-center">#</th>
                  <th className="w-8 px-2 py-2"></th>
                  <th className="px-3 py-2 text-left">{t('common.team')}</th>
                  <th className="px-2 py-2 text-center">{t('abbr.group')}</th>
                  <th className="px-2 py-2 text-center">{t('abbr.gf')}</th>
                  <th className="px-2 py-2 text-center">{t('abbr.ga')}</th>
                  <th className="px-2 py-2 text-center">{t('abbr.gd')}</th>
                  <th className="px-2 py-2 text-center">{t('abbr.pts')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {thirdPlaceTeams.map((team, i) => {
                  const status = getRowStatus(i, tieZoneStart, tieZoneEnd, hasBoundaryTie)
                  const isSelected = selectedIds.has(team.teamId)

                  return (
                    <tr
                      key={team.teamId}
                      className={
                        status === 'locked-in'
                          ? 'bg-green-900/15'
                          : status === 'selectable' && isSelected
                          ? 'bg-amber-900/20'
                          : status === 'selectable'
                          ? 'bg-slate-800/40'
                          : ''
                      }
                    >
                      <td className="px-3 py-2 text-center text-xs text-slate-500">{i + 1}</td>
                      <td className="px-2 py-2 text-center">
                        {status === 'locked-in' && (
                          <span className="text-green-400 text-sm">✓</span>
                        )}
                        {status === 'locked-out' && (
                          <span className="text-slate-600 text-sm">✗</span>
                        )}
                        {status === 'selectable' && isEditable && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggle(team.teamId)}
                            className="accent-amber-400 h-4 w-4 cursor-pointer"
                          />
                        )}
                        {status === 'selectable' && !isEditable && (
                          <span className={isSelected ? 'text-amber-400 text-sm' : 'text-slate-600 text-sm'}>
                            {isSelected ? '✓' : '✗'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-200 text-sm">
                        {team.flagEmoji} {team.teamName}
                      </td>
                      <td className="px-2 py-2 text-center text-xs text-slate-400">{team.group}</td>
                      <td className="px-2 py-2 text-center text-slate-300 text-xs">{team.goals_for}</td>
                      <td className="px-2 py-2 text-center text-slate-300 text-xs">{team.goals_against}</td>
                      <td className="px-2 py-2 text-center text-slate-400 text-xs">
                        {team.goal_difference > 0 ? '+' : ''}{team.goal_difference}
                      </td>
                      <td className="px-2 py-2 text-center font-bold text-slate-100 text-sm">{team.points}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-700 px-5 py-3 gap-3">
          <span className="text-xs text-slate-500">
            {t('third.selectedCount', { count: selectedCount })}
            {selectedCount !== 8 && isEditable && (
              <span className="ml-1 text-amber-400">{t('third.selectExactly')}</span>
            )}
          </span>
          <div className="flex items-center gap-3">
            {saveError && <span className="text-xs text-red-400">{saveError}</span>}
            {saved && <span className="text-xs text-green-400">{t('common.saved')}</span>}
            {isEditable && (
              <button
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isPending ? t('common.savingCap') : t('common.confirm')}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-600 px-4 py-1.5 text-sm text-slate-300 transition hover:bg-slate-700"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
