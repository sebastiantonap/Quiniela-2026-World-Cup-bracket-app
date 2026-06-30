'use client'

import { useMemo } from 'react'
import { useT } from '@/lib/i18n/I18nProvider'
import { roundLabel } from '@/lib/i18n/translator'
import { ROUND_ORDER } from '@/lib/constants/rounds'
import type { MatchWithTeams, Prediction, Round, RoundName } from '@/types/app'

interface ResultsTabProps {
  matches: MatchWithTeams[]
  predictions: Record<string, Prediction>
  rounds: Round[]
  totalPoints: number
}

export function ResultsTab({ matches, predictions, rounds, totalPoints }: ResultsTabProps) {
  const t = useT()

  const roundMap = Object.fromEntries(rounds.map((r) => [r.name, r]))

  // Group matches by round and sort by match_number
  const matchesByRound = useMemo(() => {
    const grouped: Partial<Record<RoundName, MatchWithTeams[]>> = {}
    for (const roundName of ROUND_ORDER) {
      grouped[roundName] = matches
        .filter((m) => m.round?.name === roundName)
        .sort((a, b) => a.match_number - b.match_number)
    }
    return grouped as Record<RoundName, MatchWithTeams[]>
  }, [matches])

  // Calculate totals per round
  const roundTotals = useMemo(() => {
    const totals: Record<RoundName, number> = {} as Record<RoundName, number>
    for (const roundName of ROUND_ORDER) {
      const roundMatches = matchesByRound[roundName] ?? []
      totals[roundName] = roundMatches.reduce((sum, m) => {
        const pred = predictions[m.id]
        return sum + (pred?.points_awarded ?? 0)
      }, 0)
    }
    return totals
  }, [matchesByRound, predictions])

  function formatPrediction(pred: Prediction | undefined, match: MatchWithTeams): string {
    if (!pred) return '—'
    const home = pred.predicted_home !== null ? pred.predicted_home : '—'
    const away = pred.predicted_away !== null ? pred.predicted_away : '—'
    let text = `${home}–${away}`

    if (match.round?.name !== 'group_stage') {
      if (pred.predicted_home_penalties != null && pred.predicted_away_penalties != null) {
        text += ` (${t('results.pen')} ${pred.predicted_home_penalties}–${pred.predicted_away_penalties})`
      }
    }
    return text
  }

  function formatActualResult(match: MatchWithTeams): string {
    if (!match.result_confirmed) return '—'
    const home = match.home_score !== null ? match.home_score : '—'
    const away = match.away_score !== null ? match.away_score : '—'
    let text = `${home}–${away}`

    if (match.round?.name !== 'group_stage') {
      if (match.home_penalties != null && match.away_penalties != null) {
        text += ` (${t('results.pen')} ${match.home_penalties}–${match.away_penalties})`
      }
    }
    return text
  }

  function formatPredictedWinner(pred: Prediction | undefined, match: MatchWithTeams): string {
    if (!pred || match.round?.name === 'group_stage') return ''
    if (pred.predicted_winner_team_id === match.home_team_id) {
      return `${match.home_team?.flag_emoji ?? ''} ${match.home_team?.name ?? ''}`
    }
    if (pred.predicted_winner_team_id === match.away_team_id) {
      return `${match.away_team?.flag_emoji ?? ''} ${match.away_team?.name ?? ''}`
    }
    return '—'
  }

  function formatActualWinner(match: MatchWithTeams): string {
    if (!match.result_confirmed || match.round?.name === 'group_stage') return ''
    if (match.winner_team_id === match.home_team_id) {
      return `${match.home_team?.flag_emoji ?? ''} ${match.home_team?.name ?? ''}`
    }
    if (match.winner_team_id === match.away_team_id) {
      return `${match.away_team?.flag_emoji ?? ''} ${match.away_team?.name ?? ''}`
    }
    return '—'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-100">{t('results.title')}</h2>
        <div className="text-sm">
          <span className="text-slate-400">{t('results.total')}:</span>{' '}
          <span className="font-bold text-green-400">{totalPoints}</span>
        </div>
      </div>

      {ROUND_ORDER.map((roundName) => {
        const roundMatches = matchesByRound[roundName] ?? []
        const roundTotal = roundTotals[roundName] ?? 0
        const round = roundMap[roundName]

        if (roundMatches.length === 0) return null

        return (
          <div key={roundName} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300">{roundLabel(t, roundName)}</h3>
              <span className="text-xs text-slate-400">
                {t('results.roundTotal')}: <span className="font-bold text-green-400">{roundTotal}</span>
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="w-12 px-3 py-2 text-center">#</th>
                    <th className="px-3 py-2 text-left">{t('common.match')}</th>
                    <th className="px-3 py-2 text-left">{t('results.yourPrediction')}</th>
                    <th className="px-3 py-2 text-left">{t('results.actualResult')}</th>
                    {roundName !== 'group_stage' && (
                      <th className="px-3 py-2 text-left">{t('results.winner')}</th>
                    )}
                    <th className="w-16 px-3 py-2 text-right">{t('common.pts')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {roundMatches.map((match) => {
                    const pred = predictions[match.id]
                    const pts = pred?.points_awarded ?? 0
                    const isConfirmed = match.result_confirmed

                    return (
                      <tr key={match.id} className="hover:bg-slate-700/30">
                        <td className="px-3 py-2 text-center text-xs text-slate-500">{match.match_number}</td>
                        <td className="px-3 py-2 text-xs text-slate-300">
                          {match.home_team?.flag_emoji} {match.home_team?.name} {t('common.vs')}{' '}
                          {match.away_team?.flag_emoji} {match.away_team?.name}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-300">{formatPrediction(pred, match)}</td>
                        <td className="px-3 py-2 text-xs text-slate-300">{formatActualResult(match)}</td>
                        {roundName !== 'group_stage' && (
                          <td className="px-3 py-2 text-xs text-slate-300">
                            <div>{formatPredictedWinner(pred, match)}</div>
                            {match.result_confirmed && (
                              <div className="text-slate-500">{formatActualWinner(match)}</div>
                            )}
                          </td>
                        )}
                        <td className="px-3 py-2 text-right">
                          {!isConfirmed ? (
                            <span className="text-slate-500">—</span>
                          ) : (
                            <span
                              className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                                pts > 0 ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'
                              }`}
                            >
                              {pts > 0 ? `+${pts}` : pts}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}