'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveMatchResult } from '@/actions/admin/results'
import { Button } from '@/components/ui/Button'
import { ROUND_LABELS, ROUND_ORDER } from '@/lib/constants/rounds'
import type { MatchWithTeams, Round, RoundName, Team } from '@/types/app'

interface ResultsEntryProps {
  rounds: Round[]
  matches: MatchWithTeams[]
  teams: Team[]
}

export function ResultsEntry({ rounds, matches, teams }: ResultsEntryProps) {
  const roundMap = Object.fromEntries(rounds.map((r) => [r.name, r]))
  const [selectedRound, setSelectedRound] = useState<RoundName>('group_stage')
  const [scores, setScores] = useState<Record<string, { home: string; away: string; winner: string }>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const router = useRouter()

  const roundMatches = matches.filter((m) => m.round?.name === selectedRound)
  const isKnockout = selectedRound !== 'group_stage'

  function getScore(matchId: string, field: 'home' | 'away' | 'winner') {
    return scores[matchId]?.[field] ?? ''
  }

  function setScore(matchId: string, field: 'home' | 'away' | 'winner', value: string) {
    setScores((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], home: prev[matchId]?.home ?? '', away: prev[matchId]?.away ?? '', winner: prev[matchId]?.winner ?? '', [field]: value },
    }))
  }

  async function handleSave(match: MatchWithTeams) {
    const matchScore = scores[match.id]
    const home = parseInt(matchScore?.home ?? '', 10)
    const away = parseInt(matchScore?.away ?? '', 10)
    if (isNaN(home) || isNaN(away)) {
      setFeedback((prev) => ({ ...prev, [match.id]: 'Enter valid scores' }))
      return
    }

    const winnerId = isKnockout ? (matchScore?.winner || null) : null
    if (isKnockout && !winnerId) {
      setFeedback((prev) => ({ ...prev, [match.id]: 'Select winner for knockout match' }))
      return
    }

    setLoading((prev) => ({ ...prev, [match.id]: true }))
    const result = await saveMatchResult(match.id, home, away, winnerId)
    setFeedback((prev) => ({
      ...prev,
      [match.id]: result.error ?? 'Saved!',
    }))
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
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {ROUND_LABELS[roundName]}
            </button>
          )
        })}
      </div>

      <div className="space-y-2">
        {roundMatches.map((match) => {
          const homeName = match.home_team?.name ?? match.placeholder_home ?? '?'
          const awayName = match.away_team?.name ?? match.placeholder_away ?? '?'
          const homeFlag = match.home_team?.flag_emoji ?? ''
          const awayFlag = match.away_team?.flag_emoji ?? ''

          return (
            <div
              key={match.id}
              className={`flex flex-wrap items-center gap-4 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ${
                match.result_confirmed ? 'ring-green-200 bg-green-50' : 'ring-gray-100'
              }`}
            >
              <span className="w-6 text-xs text-gray-400">{match.match_number}</span>
              <span className="flex-1 min-w-0 text-sm font-medium truncate">
                {homeFlag} {homeName} vs {awayFlag} {awayName}
              </span>

              {match.result_confirmed && (
                <span className="text-sm font-bold text-green-700">
                  {match.home_score}–{match.away_score}
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
                  className="w-14 rounded border border-gray-300 px-2 py-1 text-center text-sm"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  placeholder={match.away_score?.toString() ?? 'A'}
                  value={getScore(match.id, 'away')}
                  onChange={(e) => setScore(match.id, 'away', e.target.value)}
                  className="w-14 rounded border border-gray-300 px-2 py-1 text-center text-sm"
                />

                {isKnockout && (
                  <select
                    value={getScore(match.id, 'winner')}
                    onChange={(e) => setScore(match.id, 'winner', e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1 text-sm"
                  >
                    <option value="">Winner…</option>
                    {match.home_team && (
                      <option value={match.home_team.id}>{match.home_team.name}</option>
                    )}
                    {match.away_team && (
                      <option value={match.away_team.id}>{match.away_team.name}</option>
                    )}
                  </select>
                )}

                <Button size="sm" loading={loading[match.id]} onClick={() => handleSave(match)}>
                  Save
                </Button>
              </div>

              {feedback[match.id] && (
                <span className={`text-xs ${feedback[match.id] === 'Saved!' ? 'text-green-600' : 'text-red-500'}`}>
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
