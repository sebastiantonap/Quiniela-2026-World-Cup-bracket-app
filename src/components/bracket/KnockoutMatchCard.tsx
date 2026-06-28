'use client'

import { useState, useEffect, useCallback } from 'react'
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
  /** Use compact layout for bracket view. */
  compact?: boolean
}

/** Derive the winning team id from regulation + penalty scores. */
function deriveWinner(
  homeScore: number | null,
  awayScore: number | null,
  homePen: number | null,
  awayPen: number | null,
  homeTeamId: string | undefined,
  awayTeamId: string | undefined,
): string | null {
  if (homeScore === null || awayScore === null) return null
  if (homeScore > awayScore) return homeTeamId ?? null
  if (awayScore > homeScore) return awayTeamId ?? null
  // Regulation tie — check penalties
  if (homePen !== null && awayPen !== null && homePen !== awayPen) {
    return homePen > awayPen ? (homeTeamId ?? null) : (awayTeamId ?? null)
  }
  return null
}

export function KnockoutMatchCard({ match, prediction, isEditable, onUpdate, saving, eligibility, predictedSlot, compact }: KnockoutMatchCardProps) {
  const t = useT()
  const [localHome, setLocalHome] = useState<number | null>(prediction?.predicted_home ?? null)
  const [localAway, setLocalAway] = useState<number | null>(prediction?.predicted_away ?? null)
  const [localHomePen, setLocalHomePen] = useState<number | null>(prediction?.predicted_home_penalties ?? null)
  const [localAwayPen, setLocalAwayPen] = useState<number | null>(prediction?.predicted_away_penalties ?? null)

  // Sync local state when the parent prediction changes externally (e.g. cascade clear)
  useEffect(() => {
    setLocalHome(prediction?.predicted_home ?? null)
    setLocalAway(prediction?.predicted_away ?? null)
    setLocalHomePen(prediction?.predicted_home_penalties ?? null)
    setLocalAwayPen(prediction?.predicted_away_penalties ?? null)
  }, [
    prediction?.predicted_home,
    prediction?.predicted_away,
    prediction?.predicted_winner_team_id,
    prediction?.predicted_home_penalties,
    prediction?.predicted_away_penalties,
  ])

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

  // Eligibility is informational only — users can always enter scores to
  // fill their bracket. Scoring handles partial/void point rules separately.

  // A knockout match the user predicts as a regulation tie goes to penalties.
  const isTie = localHome !== null && localAway !== null && localHome === localAway

  // Auto-derive winner from scores/penalties; fall back to persisted winner
  // for backward compatibility with predictions saved under the old radio-button flow.
  const computedWinner = deriveWinner(localHome, localAway, localHomePen, localAwayPen, homeTeam?.id, awayTeam?.id)
    ?? prediction?.predicted_winner_team_id ?? null

  // Emit update to parent with auto-computed winner
  const emitUpdate = useCallback(
    (home: number | null, away: number | null, hp: number | null, ap: number | null) => {
      const winner = deriveWinner(home, away, hp, ap, homeTeam?.id, awayTeam?.id)
      onUpdate(home, away, winner, hp, ap)
    },
    [onUpdate, homeTeam?.id, awayTeam?.id],
  )

  function handleHomeChange(val: number | null) {
    const stillTie = val !== null && localAway !== null && val === localAway
    const hp = stillTie ? localHomePen : null
    const ap = stillTie ? localAwayPen : null
    setLocalHome(val)
    if (!stillTie) { setLocalHomePen(null); setLocalAwayPen(null) }
    emitUpdate(val, localAway, hp, ap)
  }
  function handleAwayChange(val: number | null) {
    const stillTie = localHome !== null && val !== null && localHome === val
    const hp = stillTie ? localHomePen : null
    const ap = stillTie ? localAwayPen : null
    setLocalAway(val)
    if (!stillTie) { setLocalHomePen(null); setLocalAwayPen(null) }
    emitUpdate(localHome, val, hp, ap)
  }
  function handleHomePenChange(val: number | null) {
    setLocalHomePen(val)
    emitUpdate(localHome, localAway, val, localAwayPen)
  }
  function handleAwayPenChange(val: number | null) {
    setLocalAwayPen(val)
    emitUpdate(localHome, localAway, localHomePen, val)
  }

  // Visual indicator for who is winning
  const homeIsWinner = computedWinner != null && computedWinner === homeTeam?.id
  const awayIsWinner = computedWinner != null && computedWinner === awayTeam?.id

  function renderTrailing(teamId: string | undefined, localScore: number | null, onScoreChange: (v: number | null) => void, predicted: number | null | undefined) {
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
      className={`rounded-xl border bg-slate-800 ${compact ? 'p-2.5' : 'p-4'} ${
        slotsUnfilled ? 'opacity-60' : ''
      } ${borderClass}`}
    >
      <div className={`${compact ? 'mb-1.5' : 'mb-3'} flex items-center justify-between`}>
        <span className="text-xs font-medium text-slate-500">#{match.match_number}</span>
        {hasResult && pts !== null && pts !== undefined && (
          pts > 0
            ? <PointsBadge points={pts} />
            : <span className="text-xs text-slate-500">{t('knockout.zeroPts')}</span>
        )}
        {saving && <span className="text-xs text-slate-500">{t('common.saving')}</span>}
      </div>

      {/* Eligibility status banner */}
      {!compact && showEligibility && status === 'full' && (
        <div className="mb-3 rounded-lg border border-emerald-800/40 bg-emerald-900/20 px-2.5 py-1.5 text-center text-[11px] font-semibold text-emerald-400">
          {t('knockout.fullScoring')}
        </div>
      )}
      {!compact && showEligibility && isPartial && (
        <div className="mb-3 rounded-lg border border-amber-800/40 bg-amber-900/20 px-2.5 py-1.5 text-center text-[11px] font-semibold text-amber-400">
          {t('knockout.forced', { name: forcedName })}
        </div>
      )}
      {!compact && showEligibility && isVoid && (
        <div className="mb-3 rounded-lg border border-slate-600 bg-slate-700/40 px-2.5 py-1.5 text-center text-[11px] font-semibold text-slate-400">
          {t('knockout.void')}
        </div>
      )}

      {/* Home team */}
      <div className={`flex items-center justify-between gap-2 ${compact ? 'py-1' : 'py-1.5'}`}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {homeIsWinner && (
            <span className="text-[10px] text-emerald-400">▶</span>
          )}
          <span className={`truncate text-sm font-medium ${
            homeFromPrediction ? 'text-sky-300 italic' :
            homeIsWinner ? 'text-emerald-300 font-semibold' : 'text-slate-200'
          }`}>
            {homeFlag} {homeName}
          </span>
        </div>
        {renderTrailing(homeTeam?.id, localHome, handleHomeChange, prediction?.predicted_home)}
      </div>

      <div className={`border-t border-slate-700 ${compact ? 'py-0' : 'py-0.5'} text-center text-xs text-slate-500`}>{t('common.vs')}</div>

      {/* Away team */}
      <div className={`flex items-center justify-between gap-2 ${compact ? 'py-1' : 'py-1.5'}`}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {awayIsWinner && (
            <span className="text-[10px] text-emerald-400">▶</span>
          )}
          <span className={`truncate text-sm font-medium ${
            awayFromPrediction ? 'text-sky-300 italic' :
            awayIsWinner ? 'text-emerald-300 font-semibold' : 'text-slate-200'
          }`}>
            {awayFlag} {awayName}
          </span>
        </div>
        {renderTrailing(awayTeam?.id, localAway, handleAwayChange, prediction?.predicted_away)}
      </div>

      {/* Penalty shootout — only when the user predicts a regulation tie. */}
      {effectiveEditable && isTie && (
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

      {!compact && effectiveEditable && isTie && (
        <p className="mt-2 text-center text-xs text-slate-500">
          {t('knockout.penaltiesHint')}
        </p>
      )}

      {slotsUnfilled && (
        <p className="mt-2 text-center text-xs text-slate-500">{t('knockout.teamsTbd')}</p>
      )}
      {!compact && (homeFromPrediction || awayFromPrediction) && !slotsUnfilled && (
        <p className="mt-2 text-center text-[10px] text-sky-400/70">{t('knockout.fromYourPicks')}</p>
      )}
    </div>
  )
}
