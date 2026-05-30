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
  eligibilitySet: Set<string>
}

export function KnockoutMatchCard({ match, prediction, isEditable, onUpdate, saving, eligibilitySet }: KnockoutMatchCardProps) {
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
  const isGated = prediction?.qualification_gated === true

  // Warn when the user's current winner pick wasn't predicted to qualify from the group stage
  const hasEligibilityData = eligibilitySet.size > 0
  const pickedWinnerNotEligible =
    effectiveEditable &&
    hasEligibilityData &&
    localWinner !== null &&
    !eligibilitySet.has(localWinner)

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
    <div
      className={`rounded-xl border bg-slate-800 p-4 ${
        slotsUnfilled ? 'opacity-50' : ''
      } ${isGated ? 'border-red-800/50' : 'border-slate-700'}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">#{match.match_number}</span>
        {hasResult && (
          isGated ? (
            <span className="rounded-full bg-red-900/30 px-2 py-0.5 text-[10px] font-semibold text-red-400">
              0 pts — not in your group picks
            </span>
          ) : pts !== null && pts !== undefined ? (
            pts > 0
              ? <PointsBadge points={pts} />
              : <span className="text-xs text-slate-500">0 pts</span>
          ) : null
        )}
        {saving && <span className="text-xs text-slate-500">saving…</span>}
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
              className="accent-amber-500"
              title="Pick as winner"
            />
          )}
          <span className="truncate text-sm font-medium text-slate-200">
            {homeFlag} {homeName}
          </span>
        </div>
        {effectiveEditable ? (
          <ScoreInput value={localHome} onChange={handleHomeChange} />
        ) : (
          <span className="w-12 rounded bg-slate-700 py-1 text-center text-sm font-semibold text-slate-300">
            {prediction?.predicted_home ?? '-'}
          </span>
        )}
      </div>

      <div className="border-t border-slate-700 py-0.5 text-center text-xs text-slate-500">vs</div>

      {/* Away team */}
      <div className="flex items-center justify-between gap-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {effectiveEditable && awayTeam && (
            <input
              type="radio"
              name={`winner-${match.id}`}
              checked={localWinner === awayTeam.id}
              onChange={() => handleWinnerChange(awayTeam.id)}
              className="accent-amber-500"
              title="Pick as winner"
            />
          )}
          <span className="truncate text-sm font-medium text-slate-200">
            {awayFlag} {awayName}
          </span>
        </div>
        {effectiveEditable ? (
          <ScoreInput value={localAway} onChange={handleAwayChange} />
        ) : (
          <span className="w-12 rounded bg-slate-700 py-1 text-center text-sm font-semibold text-slate-300">
            {prediction?.predicted_away ?? '-'}
          </span>
        )}
      </div>

      {effectiveEditable && !pickedWinnerNotEligible && (
        <p className="mt-2 text-center text-xs text-slate-500">
          Select winner (radio) — required for points
        </p>
      )}
      {pickedWinnerNotEligible && (
        <p className="mt-2 text-center text-xs text-amber-400">
          This team wasn't in your group picks — pick scores 0 pts
        </p>
      )}
      {slotsUnfilled && (
        <p className="mt-2 text-center text-xs text-slate-500">Teams TBD</p>
      )}
    </div>
  )
}
