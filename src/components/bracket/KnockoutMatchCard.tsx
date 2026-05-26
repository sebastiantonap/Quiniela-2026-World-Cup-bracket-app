'use client'

import { useState } from 'react'
import { ScoreInput } from './ScoreInput'
import { PointsBadge } from '@/components/ui/Badge'
import type { MatchWithTeams, Prediction } from '@/types/app'

interface KnockoutMatchCardProps {
  match: MatchWithTeams
  prediction: Prediction | undefined
  isEditable: boolean
  onUpdate: (home: number | null, away: number | null, winnerId: string | null) => void
  saving?: boolean
}

export function KnockoutMatchCard({
  match,
  prediction,
  isEditable,
  onUpdate,
  saving,
}: KnockoutMatchCardProps) {
  const [localHome, setLocalHome] = useState<number | null>(prediction?.predicted_home ?? null)
  const [localAway, setLocalAway] = useState<number | null>(prediction?.predicted_away ?? null)
  const [localWinner, setLocalWinner] = useState<string | null>(
    prediction?.predicted_winner_team_id ?? null
  )

  const homeTeam = match.home_team
  const awayTeam = match.away_team
  const homeName = homeTeam?.name ?? match.placeholder_home ?? 'TBD'
  const awayName = awayTeam?.name ?? match.placeholder_away ?? 'TBD'
  const homeFlag = homeTeam?.flag_emoji ?? ''
  const awayFlag = awayTeam?.flag_emoji ?? ''
  const slotsUnfilled = !homeTeam || !awayTeam
  const effectiveEditable = isEditable && !slotsUnfilled
  const hasResult = match.result_confirmed && match.home_score !== null
  const pts = prediction?.points_awarded

  function handleHomeChange(val: number | null) {
    setLocalHome(val)
    onUpdate(val, localAway, localWinner)
  }
  function handleAwayChange(val: number | null) {
    setLocalAway(val)
    onUpdate(localHome, val, localWinner)
  }
  function handleWinnerChange(teamId: string) {
    const newWinner = localWinner === teamId ? null : teamId
    setLocalWinner(newWinner)
    onUpdate(localHome, localAway, newWinner)
  }

  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${slotsUnfilled ? 'opacity-60' : ''}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400">Match {match.match_number}</span>
        {hasResult && pts !== null && pts !== undefined && (
          pts > 0 ? <PointsBadge points={pts} /> : <span className="text-xs text-gray-400">0 pts</span>
        )}
        {saving && <span className="text-xs text-gray-400">saving…</span>}
      </div>

      {/* Home team */}
      <div className="flex items-center justify-between gap-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {effectiveEditable && homeTeam && (
            <input
              type="radio"
              name={`winner-${match.id}`}
              checked={localWinner === homeTeam.id}
              onChange={() => handleWinnerChange(homeTeam.id)}
              className="accent-blue-600"
              title="Pick as winner"
            />
          )}
          <span className="truncate text-sm font-medium">
            {homeFlag} {homeName}
          </span>
        </div>
        {effectiveEditable ? (
          <ScoreInput value={localHome} onChange={handleHomeChange} />
        ) : (
          <span className="w-12 rounded bg-gray-100 py-1 text-center text-sm font-semibold text-gray-600">
            {prediction?.predicted_home ?? '-'}
          </span>
        )}
      </div>

      <div className="border-t border-gray-100 py-0.5 text-center text-xs text-gray-400">vs</div>

      {/* Away team */}
      <div className="flex items-center justify-between gap-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {effectiveEditable && awayTeam && (
            <input
              type="radio"
              name={`winner-${match.id}`}
              checked={localWinner === awayTeam.id}
              onChange={() => handleWinnerChange(awayTeam.id)}
              className="accent-blue-600"
              title="Pick as winner"
            />
          )}
          <span className="truncate text-sm font-medium">
            {awayFlag} {awayName}
          </span>
        </div>
        {effectiveEditable ? (
          <ScoreInput value={localAway} onChange={handleAwayChange} />
        ) : (
          <span className="w-12 rounded bg-gray-100 py-1 text-center text-sm font-semibold text-gray-600">
            {prediction?.predicted_away ?? '-'}
          </span>
        )}
      </div>

      {/* Winner selection hint */}
      {effectiveEditable && (
        <p className="mt-2 text-center text-xs text-gray-400">
          Select radio button to pick winner (required for points)
        </p>
      )}
      {slotsUnfilled && (
        <p className="mt-2 text-center text-xs text-gray-400">Teams TBD</p>
      )}
    </div>
  )
}
