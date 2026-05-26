'use client'

import { useState } from 'react'
import { ScoreInput } from './ScoreInput'
import { PointsBadge } from '@/components/ui/Badge'
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
  const [localHome, setLocalHome] = useState<number | null>(
    prediction?.predicted_home ?? null
  )
  const [localAway, setLocalAway] = useState<number | null>(
    prediction?.predicted_away ?? null
  )

  const homeTeam = match.home_team
  const awayTeam = match.away_team
  const homeName = homeTeam?.name ?? match.placeholder_home ?? '?'
  const awayName = awayTeam?.name ?? match.placeholder_away ?? '?'
  const homeFlag = homeTeam?.flag_emoji ?? ''
  const awayFlag = awayTeam?.flag_emoji ?? ''

  const hasResult = match.result_confirmed && match.home_score !== null
  const pts = prediction?.points_awarded

  function handleHomeChange(val: number | null) {
    setLocalHome(val)
    onUpdate(val, localAway)
  }

  function handleAwayChange(val: number | null) {
    setLocalAway(val)
    onUpdate(localHome, val)
  }

  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${error ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
      {/* Home team */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
        <span className="truncate text-right font-medium">{homeFlag} {homeName}</span>
      </div>

      {/* Score */}
      <div className="flex flex-shrink-0 items-center gap-1">
        {isEditable ? (
          <>
            <ScoreInput value={localHome} onChange={handleHomeChange} />
            <span className="text-gray-400">-</span>
            <ScoreInput value={localAway} onChange={handleAwayChange} />
          </>
        ) : (
          <div className="flex items-center gap-1">
            <span className="w-12 rounded-lg bg-gray-100 py-1.5 text-center font-semibold text-gray-600">
              {prediction?.predicted_home ?? '-'}
            </span>
            <span className="text-gray-400">-</span>
            <span className="w-12 rounded-lg bg-gray-100 py-1.5 text-center font-semibold text-gray-600">
              {prediction?.predicted_away ?? '-'}
            </span>
          </div>
        )}
      </div>

      {/* Away team */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate font-medium">{awayFlag} {awayName}</span>
      </div>

      {/* Points / status */}
      <div className="flex w-16 flex-shrink-0 items-center justify-end">
        {saving && <span className="text-xs text-gray-400">saving…</span>}
        {hasResult && pts !== null && pts !== undefined && (
          pts > 0 ? <PointsBadge points={pts} /> : <span className="text-xs text-gray-400">0 pts</span>
        )}
        {hasResult && prediction && pts === null && (
          <span className="text-xs text-gray-400">no pick</span>
        )}
        {hasResult && !prediction && (
          <span className="text-xs text-gray-400">no pick</span>
        )}
      </div>
    </div>
  )
}
