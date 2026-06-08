'use client'

import { useState } from 'react'
import { ScoreInput } from './ScoreInput'
import { PointsBadge } from '@/components/ui/Badge'
import { useT } from '@/lib/i18n/I18nProvider'
import { formatDateDDMM } from '@/lib/dateUtils'
import type { MatchWithTeams, Prediction } from '@/types/app'

interface MatchRowProps {
  match: MatchWithTeams
  prediction: Prediction | undefined
  isEditable: boolean
  onUpdate: (predictedHome: number | null, predictedAway: number | null) => void
  saving?: boolean
  error?: string
}

export function MatchRow({ match, prediction, isEditable, onUpdate, saving, error }: MatchRowProps) {
  const t = useT()
  const [localHome, setLocalHome] = useState<number | null>(prediction?.predicted_home ?? null)
  const [localAway, setLocalAway] = useState<number | null>(prediction?.predicted_away ?? null)

  const homeTeam = match.home_team
  const awayTeam = match.away_team
  const homeName = homeTeam?.name ?? match.placeholder_home ?? '?'
  const awayName = awayTeam?.name ?? match.placeholder_away ?? '?'
  const homeFlag = homeTeam?.flag_emoji ?? ''
  const awayFlag = awayTeam?.flag_emoji ?? ''

  const hasResult = match.result_confirmed && match.home_score !== null
  const pts = prediction?.points_awarded

  // Format scheduled_at as dd/mm in CST
  const dateLabel = match.scheduled_at ? formatDateDDMM(match.scheduled_at) : null

  function handleHomeChange(val: number | null) {
    setLocalHome(val)
    onUpdate(val, localAway)
  }

  function handleAwayChange(val: number | null) {
    setLocalAway(val)
    onUpdate(localHome, val)
  }

  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm transition ${
        error ? 'bg-red-900/20' : 'hover:bg-slate-700/40'
      }`}
    >
      {/* Date — always reserve space so rows stay aligned */}
      <span className="w-8 flex-shrink-0 text-[10px] tabular-nums text-slate-500">
        {dateLabel ?? ''}
      </span>

      {/* Home team */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
        <span className="truncate text-right text-xs text-slate-200">
          {homeFlag} {homeName}
        </span>
      </div>

      {/* Score */}
      <div className="flex flex-shrink-0 items-center gap-1">
        {isEditable ? (
          <>
            <ScoreInput value={localHome} onChange={handleHomeChange} />
            <span className="text-slate-500">-</span>
            <ScoreInput value={localAway} onChange={handleAwayChange} />
          </>
        ) : (
          <div className="flex items-center gap-1">
            <span className="w-12 rounded-lg bg-slate-700 py-1.5 text-center font-semibold text-slate-300">
              {prediction?.predicted_home ?? '-'}
            </span>
            <span className="text-slate-500">-</span>
            <span className="w-12 rounded-lg bg-slate-700 py-1.5 text-center font-semibold text-slate-300">
              {prediction?.predicted_away ?? '-'}
            </span>
          </div>
        )}
      </div>

      {/* Away team */}
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <span className="truncate text-xs text-slate-200">
          {awayFlag} {awayName}
        </span>
      </div>

      {/* Points / status */}
      <div className="flex flex-shrink-0 items-center justify-end">
        {saving && <span className="text-xs text-slate-500">{t('common.saving')}</span>}
        {hasResult && pts !== null && pts !== undefined && (
          pts > 0
            ? <PointsBadge points={pts} />
            : <span className="text-xs text-slate-500">0</span>
        )}
        {hasResult && !prediction && (
          <span className="text-xs text-slate-500">—</span>
        )}
      </div>
    </div>
  )
}
