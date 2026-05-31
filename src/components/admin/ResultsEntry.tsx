'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { saveMatchResult, clearMatchResult } from '@/actions/admin/results'
import { Button } from '@/components/ui/Button'
import { buildSlotContext, resolveSlotTeamId } from '@/lib/standings/knockoutSlots'
import { ROUND_ORDER } from '@/lib/constants/rounds'
import { useT } from '@/lib/i18n/I18nProvider'
import { roundLabel } from '@/lib/i18n/translator'
import type { MatchWithTeams, Round, RoundName, Team } from '@/types/app'

interface ResultsEntryProps {
  rounds: Round[]
  matches: MatchWithTeams[]
  teams: Team[]
}

type ScoreState = { home: string; away: string; hpen: string; apen: string }

export function ResultsEntry({ rounds, matches, teams }: ResultsEntryProps) {
  const t = useT()
  const roundMap = Object.fromEntries(rounds.map((r) => [r.name, r]))
  const [selectedRound, setSelectedRound] = useState<RoundName>('group_stage')
  const [scores, setScores] = useState<Record<string, ScoreState>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const router = useRouter()

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])
  const ctx = useMemo(() => buildSlotContext(matches, teams), [matches, teams])

  const roundMatches = matches.filter((m) => m.round?.name === selectedRound)
  const isKnockout = selectedRound !== 'group_stage'

  function getScore(matchId: string, field: keyof ScoreState) {
    return scores[matchId]?.[field] ?? ''
  }

  function setScore(matchId: string, field: keyof ScoreState, value: string) {
    setScores((prev) => ({
      ...prev,
      [matchId]: {
        home: prev[matchId]?.home ?? '',
        away: prev[matchId]?.away ?? '',
        hpen: prev[matchId]?.hpen ?? '',
        apen: prev[matchId]?.apen ?? '',
        [field]: value,
      },
    }))
  }

  // Resolve a side's display: assigned team → resolved feeding-match winner → raw placeholder.
  function sideDisplay(team: Team | null, placeholder: string | null) {
    if (team) return `${team.flag_emoji ?? ''} ${team.name}`.trim()
    const resolvedId = resolveSlotTeamId(placeholder, ctx)
    const resolved = resolvedId ? teamById.get(resolvedId) : null
    if (resolved) return `${resolved.flag_emoji ?? ''} ${resolved.name}`.trim()
    return placeholder ?? '?'
  }

  async function handleClear(match: MatchWithTeams) {
    const homeName = sideDisplay(match.home_team, match.placeholder_home)
    const awayName = sideDisplay(match.away_team, match.placeholder_away)
    const confirmed = window.confirm(
      t('admin.results.clearConfirm', { number: match.match_number, home: homeName, away: awayName })
    )
    if (!confirmed) return

    setLoading((prev) => ({ ...prev, [`clear-${match.id}`]: true }))
    const result = await clearMatchResult(match.id)
    setFeedback((prev) => ({ ...prev, [match.id]: result.error ?? t('admin.results.resultCleared') }))
    setLoading((prev) => ({ ...prev, [`clear-${match.id}`]: false }))
    router.refresh()
  }

  async function handleSave(match: MatchWithTeams) {
    const s = scores[match.id]
    const home = parseInt(s?.home ?? '', 10)
    const away = parseInt(s?.away ?? '', 10)
    if (isNaN(home) || isNaN(away)) {
      setFeedback((prev) => ({ ...prev, [match.id]: t('admin.results.enterValidScores') }))
      return
    }

    let hpen: number | null = null
    let apen: number | null = null
    if (isKnockout) {
      if (!match.home_team_id || !match.away_team_id) {
        setFeedback((prev) => ({ ...prev, [match.id]: t('admin.results.assignBothTeams') }))
        return
      }
      if (home === away) {
        hpen = parseInt(s?.hpen ?? '', 10)
        apen = parseInt(s?.apen ?? '', 10)
        if (isNaN(hpen) || isNaN(apen)) {
          setFeedback((prev) => ({ ...prev, [match.id]: t('admin.results.tiedEnterPens') }))
          return
        }
        if (hpen === apen) {
          setFeedback((prev) => ({ ...prev, [match.id]: t('admin.results.pensNotEqual') }))
          return
        }
      }
    }

    setLoading((prev) => ({ ...prev, [match.id]: true }))
    const result = await saveMatchResult(match.id, home, away, hpen, apen)
    setFeedback((prev) => ({ ...prev, [match.id]: result.error ?? t('admin.results.saved') }))
    setLoading((prev) => ({ ...prev, [match.id]: false }))
    router.refresh()
  }

  return (
    <div>
      {/* Round selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {ROUND_ORDER.map((roundName) => {
          const round = roundMap[roundName]
          if (!round) return null
          return (
            <button
              key={roundName}
              onClick={() => setSelectedRound(roundName)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                selectedRound === roundName
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {roundLabel(t, roundName)}
            </button>
          )
        })}
      </div>

      <div className="space-y-2">
        {roundMatches.map((match) => {
          const homeLabel = sideDisplay(match.home_team, match.placeholder_home)
          const awayLabel = sideDisplay(match.away_team, match.placeholder_away)

          // Live tie detection drives the penalty inputs (knockout only).
          const h = parseInt(getScore(match.id, 'home'), 10)
          const a = parseInt(getScore(match.id, 'away'), 10)
          const isTie = !isNaN(h) && !isNaN(a) && h === a
          const showPens = isKnockout && isTie

          // Derived winner for the in-progress entry.
          let winnerLabel = ''
          if (isKnockout && !isNaN(h) && !isNaN(a)) {
            if (h > a) winnerLabel = homeLabel
            else if (a > h) winnerLabel = awayLabel
            else {
              const hp = parseInt(getScore(match.id, 'hpen'), 10)
              const ap = parseInt(getScore(match.id, 'apen'), 10)
              if (!isNaN(hp) && !isNaN(ap) && hp !== ap) winnerLabel = hp > ap ? homeLabel : awayLabel
            }
          }

          return (
            <div
              key={match.id}
              className={`flex flex-wrap items-center gap-4 rounded-xl px-4 py-3 border ${
                match.result_confirmed ? 'border-green-700/50 bg-green-900/20' : 'border-slate-700 bg-slate-800'
              }`}
            >
              <span className="w-6 text-xs text-slate-500">{match.match_number}</span>
              <span className="flex-1 min-w-0 text-sm font-medium text-slate-200 truncate">
                {homeLabel} {t('common.vs')} {awayLabel}
              </span>

              {match.result_confirmed && (
                <span className="text-sm font-bold text-green-400">
                  {match.home_score}–{match.away_score}
                  {match.home_penalties !== null && match.away_penalties !== null && (
                    <span className="ml-1 text-xs font-medium text-green-500/80">
                      {t('admin.results.pensSuffix', { home: match.home_penalties, away: match.away_penalties })}
                    </span>
                  )}
                </span>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={99}
                  placeholder={match.home_score?.toString() ?? 'H'}
                  value={getScore(match.id, 'home')}
                  onChange={(e) => setScore(match.id, 'home', e.target.value)}
                  className="w-14 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-center text-sm text-slate-200 placeholder:text-slate-500"
                />
                <span className="text-slate-500">-</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  placeholder={match.away_score?.toString() ?? 'A'}
                  value={getScore(match.id, 'away')}
                  onChange={(e) => setScore(match.id, 'away', e.target.value)}
                  className="w-14 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-center text-sm text-slate-200 placeholder:text-slate-500"
                />

                {showPens && (
                  <div className="flex items-center gap-1 rounded-lg border border-amber-700/50 bg-amber-900/10 px-2 py-1">
                    <span className="text-[10px] font-semibold uppercase text-amber-400">{t('admin.results.pens')}</span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      placeholder="H"
                      value={getScore(match.id, 'hpen')}
                      onChange={(e) => setScore(match.id, 'hpen', e.target.value)}
                      className="w-11 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-center text-sm text-slate-200 placeholder:text-slate-500"
                    />
                    <span className="text-slate-500">-</span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      placeholder="A"
                      value={getScore(match.id, 'apen')}
                      onChange={(e) => setScore(match.id, 'apen', e.target.value)}
                      className="w-11 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-center text-sm text-slate-200 placeholder:text-slate-500"
                    />
                  </div>
                )}

                <Button size="sm" loading={loading[match.id]} onClick={() => handleSave(match)}>
                  {t('common.save')}
                </Button>
                {match.result_confirmed && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={loading[`clear-${match.id}`]}
                    onClick={() => handleClear(match)}
                    className="text-red-400 hover:text-red-300"
                  >
                    {t('admin.results.clear')}
                  </Button>
                )}
              </div>

              {winnerLabel && (
                <span className="text-xs text-slate-400">
                  {t('admin.results.winner')} <span className="font-semibold text-slate-200">{winnerLabel}</span>
                </span>
              )}

              {feedback[match.id] && (
                <span className={`text-xs ${feedback[match.id] === t('admin.results.saved') || feedback[match.id] === t('admin.results.resultCleared') ? 'text-green-400' : 'text-red-400'}`}>
                  {feedback[match.id]}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
