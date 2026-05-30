'use client'

import { useState } from 'react'
import { ScoreInput } from './ScoreInput'
import { PointsBadge } from '@/components/ui/Badge'
import type { KnockoutEligibility } from '@/lib/scoring/knockoutEligibility'
import type { MatchWithTeams, Prediction } from '@/types/app'

interface KnockoutMatchCardProps {
  match: MatchWithTeams
  prediction: Prediction | undefined
  isEditable: boolean
  onUpdate: (home: number | null, away: number | null, winnerId: string | null) => void
  saving?: boolean
  eligibility: KnockoutEligibility | undefined
}

export function KnockoutMatchCard({ match, prediction, isEditable, onUpdate, saving, eligibility }: KnockoutMatchCardProps) {
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

  // Eligibility status only meaningful once both teams are known.
  const showEligibility = !slotsUnfilled && eligibility !== undefined
  const status = showEligibility ? eligibility!.status : null
  const forcedWinnerTeamId = eligibility?.forcedWinnerTeamId ?? null
  const isVoid = status === 'void'
  const isPartial = status === 'partial'
  const forcedName =
    forcedWinnerTeamId === homeTeam?.id ? `${homeFlag} ${homeName}`.trim()
    : forcedWinnerTeamId === awayTeam?.id ? `${awayFlag} ${awayName}`.trim()
    : ''

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

  // Per-team winner radio state — locked to the forced team in the partial case.
  function radioChecked(teamId: string) {
    return isPartial ? teamId === forcedWinnerTeamId : localWinner === teamId
  }

  const borderClass = isPartial ? 'border-amber-800/40' : 'border-slate-700'

  return (
    <div
      className={`rounded-xl border bg-slate-800 p-4 ${
        slotsUnfilled || isVoid ? 'opacity-60' : ''
      } ${borderClass}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">#{match.match_number}</span>
        {hasResult && pts !== null && pts !== undefined && (
          pts > 0
            ? <PointsBadge points={pts} />
            : <span className="text-xs text-slate-500">0 pts</span>
        )}
        {saving && <span className="text-xs text-slate-500">saving…</span>}
      </div>

      {/* Eligibility status banner */}
      {showEligibility && status === 'full' && (
        <div className="mb-3 rounded-lg border border-emerald-800/40 bg-emerald-900/20 px-2.5 py-1.5 text-center text-[11px] font-semibold text-emerald-400">
          Full scoring
        </div>
      )}
      {showEligibility && isPartial && (
        <div className="mb-3 rounded-lg border border-amber-800/40 bg-amber-900/20 px-2.5 py-1.5 text-center text-[11px] font-semibold text-amber-400">
          Forced: {forcedName} advances · advance pts only
        </div>
      )}
      {showEligibility && isVoid && (
        <div className="mb-3 rounded-lg border border-slate-600 bg-slate-700/40 px-2.5 py-1.5 text-center text-[11px] font-semibold text-slate-400">
          Void — no points possible
        </div>
      )}

      {/* Home team */}
      <div className="flex items-center justify-between gap-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {effectiveEditable && homeTeam && (
            <input
              type="radio"
              name={`winner-${match.id}`}
              checked={radioChecked(homeTeam.id)}
              disabled={isPartial}
              onChange={() => handleWinnerChange(homeTeam.id)}
              className="accent-amber-500"
              title={isPartial ? 'Winner forced by eligibility' : 'Pick as winner'}
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
              checked={radioChecked(awayTeam.id)}
              disabled={isPartial}
              onChange={() => handleWinnerChange(awayTeam.id)}
              className="accent-amber-500"
              title={isPartial ? 'Winner forced by eligibility' : 'Pick as winner'}
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

      {effectiveEditable && status === 'full' && (
        <p className="mt-2 text-center text-xs text-slate-500">
          Select winner (radio) — required for points
        </p>
      )}
      {slotsUnfilled && (
        <p className="mt-2 text-center text-xs text-slate-500">Teams TBD</p>
      )}
    </div>
  )
}
