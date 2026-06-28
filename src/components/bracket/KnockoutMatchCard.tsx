'use client'

import { useState } from 'react'
import { ScoreInput } from './ScoreInput'
import { PointsBadge } from '@/components/ui/Badge'
import { useT } from '@/lib/i18n/I18nProvider'
import type { KnockoutEligibility } from '@/lib/scoring/knockoutEligibility'
import type { MatchWithTeams, Prediction } from '@/types/app'
import type { PredictedMatch } from '@/lib/bracket/resolveUserBracket'

interface KnockoutMatchCardProps {
  match: MatchWithTeams
  prediction: Prediction | undefined
  isEditable: boolean
  onUpdate: (home: number | null, away: number | null, winnerId: string | null, homePens: number | null, awayPens: number | null) => void
  saving?: boolean
  eligibility: KnockoutEligibility | undefined
  /** Teams resolved from user predictions when the DB hasn't assigned teams yet. */
  predictedSlot?: PredictedMatch
}

export function KnockoutMatchCard({ match, prediction, isEditable, onUpdate, saving, eligibility, predictedSlot }: KnockoutMatchCardProps) {
  const t = useT()
  const [localHome, setLocalHome] = useState<number | null>(prediction?.predicted_home ?? null)
  const [localAway, setLocalAway] = useState<number | null>(prediction?.predicted_away ?? null)
  const [localWinner, setLocalWinner] = useState<string | null>(
    prediction?.predicted_winner_team_id ?? null
  )
  const [localHomePen, setLocalHomePen] = useState<number | null>(prediction?.predicted_home_penalties ?? null)
  const [localAwayPen, setLocalAwayPen] = useState<number | null>(prediction?.predicted_away_penalties ?? null)

  // Use DB teams first, fall back to user-predicted teams
  const homeTeam = match.home_team ?? predictedSlot?.home.team ?? null
  const awayTeam = match.away_team ?? predictedSlot?.away.team ?? null
  const homeFromPrediction = !match.home_team && !!predictedSlot?.home.fromPrediction
  const awayFromPrediction = !match.away_team && !!predictedSlot?.away.fromPrediction
  const homeName = homeTeam?.name ?? match.placeholder_home ?? t('common.tbd')
  const awayName = awayTeam?.name ?? match.placeholder_away ?? t('common.tbd')
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

  // Scores and winner selection only ever affect points in the FULL case. In partial
  // (winner forced, advance points only) and void (no points), lock the inputs out.
  const selectionLocked = showEligibility && (isPartial || isVoid)

  // A knockout match the user predicts as a regulation tie goes to penalties.
  const isTie = localHome !== null && localAway !== null && localHome === localAway

  function handleHomeChange(val: number | null) {
    // Leaving a tie clears any predicted shootout.
    const stillTie = val !== null && localAway !== null && val === localAway
    const hp = stillTie ? localHomePen : null
    const ap = stillTie ? localAwayPen : null
    setLocalHome(val)
    if (!stillTie) { setLocalHomePen(null); setLocalAwayPen(null) }
    onUpdate(val, localAway, localWinner, hp, ap)
  }
  function handleAwayChange(val: number | null) {
    const stillTie = localHome !== null && val !== null && localHome === val
    const hp = stillTie ? localHomePen : null
    const ap = stillTie ? localAwayPen : null
    setLocalAway(val)
    if (!stillTie) { setLocalHomePen(null); setLocalAwayPen(null) }
    onUpdate(localHome, val, localWinner, hp, ap)
  }
  function handleWinnerChange(teamId: string) {
    const newWinner = localWinner === teamId ? null : teamId
    setLocalWinner(newWinner)
    onUpdate(localHome, localAway, newWinner, localHomePen, localAwayPen)
  }
  function handleHomePenChange(val: number | null) {
    setLocalHomePen(val)
    onUpdate(localHome, localAway, localWinner, val, localAwayPen)
  }
  function handleAwayPenChange(val: number | null) {
    setLocalAwayPen(val)
    onUpdate(localHome, localAway, localWinner, localHomePen, val)
  }

  function renderTrailing(teamId: string | undefined, localScore: number | null, onScoreChange: (v: number | null) => void, predicted: number | null | undefined) {
    if (selectionLocked) {
      if (isPartial && teamId && teamId === forcedWinnerTeamId) {
        return (
          <span className="rounded bg-emerald-900/30 px-2 py-1 text-[11px] font-semibold text-emerald-400">
            {t('knockout.advances')}
          </span>
        )
      }
      return <span className="w-12 text-center text-sm text-slate-600">—</span>
    }
    if (effectiveEditable) {
      return <ScoreInput value={localScore} onChange={onScoreChange} />
    }
    return (
      <span className="w-12 rounded bg-slate-700 py-1 text-center text-sm font-semibold text-slate-300">
        {predicted ?? '-'}
      </span>
    )
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
            : <span className="text-xs text-slate-500">{t('knockout.zeroPts')}</span>
        )}
        {saving && <span className="text-xs text-slate-500">{t('common.saving')}</span>}
      </div>

      {/* Eligibility status banner */}
      {showEligibility && status === 'full' && (
        <div className="mb-3 rounded-lg border border-emerald-800/40 bg-emerald-900/20 px-2.5 py-1.5 text-center text-[11px] font-semibold text-emerald-400">
          {t('knockout.fullScoring')}
        </div>
      )}
      {showEligibility && isPartial && (
        <div className="mb-3 rounded-lg border border-amber-800/40 bg-amber-900/20 px-2.5 py-1.5 text-center text-[11px] font-semibold text-amber-400">
          {t('knockout.forced', { name: forcedName })}
        </div>
      )}
      {showEligibility && isVoid && (
        <div className="mb-3 rounded-lg border border-slate-600 bg-slate-700/40 px-2.5 py-1.5 text-center text-[11px] font-semibold text-slate-400">
          {t('knockout.void')}
        </div>
      )}

      {/* Home team */}
      <div className="flex items-center justify-between gap-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {effectiveEditable && homeTeam && !selectionLocked && (
            <input
              type="radio"
              name={`winner-${match.id}`}
              checked={localWinner === homeTeam.id}
              onChange={() => handleWinnerChange(homeTeam.id)}
              className="accent-amber-500"
              title={t('knockout.pickWinnerTitle')}
            />
          )}
          <span className={`truncate text-sm font-medium ${homeFromPrediction ? 'text-sky-300 italic' : 'text-slate-200'}`}>
            {homeFlag} {homeName}
          </span>
        </div>
        {renderTrailing(homeTeam?.id, localHome, handleHomeChange, prediction?.predicted_home)}
      </div>

      <div className="border-t border-slate-700 py-0.5 text-center text-xs text-slate-500">{t('common.vs')}</div>

      {/* Away team */}
      <div className="flex items-center justify-between gap-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {effectiveEditable && awayTeam && !selectionLocked && (
            <input
              type="radio"
              name={`winner-${match.id}`}
              checked={localWinner === awayTeam.id}
              onChange={() => handleWinnerChange(awayTeam.id)}
              className="accent-amber-500"
              title={t('knockout.pickWinnerTitle')}
            />
          )}
          <span className={`truncate text-sm font-medium ${awayFromPrediction ? 'text-sky-300 italic' : 'text-slate-200'}`}>
            {awayFlag} {awayName}
          </span>
        </div>
        {renderTrailing(awayTeam?.id, localAway, handleAwayChange, prediction?.predicted_away)}
      </div>

      {/* Penalty shootout — only when the user predicts a regulation tie. */}
      {effectiveEditable && !selectionLocked && isTie && (
        <div className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-amber-700/40 bg-amber-900/10 px-2 py-1.5">
          <span className="text-[10px] font-semibold uppercase text-amber-400">{t('knockout.pensLabel')}</span>
          <ScoreInput value={localHomePen} onChange={handleHomePenChange} />
          <span className="text-slate-500">-</span>
          <ScoreInput value={localAwayPen} onChange={handleAwayPenChange} />
        </div>
      )}
      {!effectiveEditable && prediction?.predicted_home_penalties != null && prediction?.predicted_away_penalties != null && (
        <p className="mt-2 text-center text-[11px] text-slate-400">
          {t('knockout.penPredicted', { home: prediction.predicted_home_penalties, away: prediction.predicted_away_penalties })}
        </p>
      )}

      {effectiveEditable && !selectionLocked && isTie && (
        <p className="mt-2 text-center text-xs text-slate-500">
          {t('knockout.penaltiesHint')}
        </p>
      )}
      {effectiveEditable && status === 'full' && !isTie && (
        <p className="mt-2 text-center text-xs text-slate-500">
          {t('knockout.selectWinner')}
        </p>
      )}
      {effectiveEditable && isPartial && (
        <p className="mt-2 text-center text-xs text-slate-500">
          {t('knockout.winnerForced', { name: forcedName })}
        </p>
      )}
      {slotsUnfilled && (
        <p className="mt-2 text-center text-xs text-slate-500">{t('knockout.teamsTbd')}</p>
      )}
      {(homeFromPrediction || awayFromPrediction) && !slotsUnfilled && (
        <p className="mt-2 text-center text-[10px] text-sky-400/70">{t('knockout.fromYourPicks')}</p>
      )}
    </div>
  )
}
