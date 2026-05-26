'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { assignKnockoutTeams } from '@/actions/admin/results'
import { Button } from '@/components/ui/Button'
import { ROUND_LABELS, ROUND_ORDER } from '@/lib/constants/rounds'
import type { MatchWithTeams, Round, RoundName, Team } from '@/types/app'

interface KnockoutSlotFillerProps {
  rounds: Round[]
  matches: MatchWithTeams[]
  teams: Team[]
}

export function KnockoutSlotFiller({ rounds, matches, teams }: KnockoutSlotFillerProps) {
  const knockoutRounds: RoundName[] = ['round_of_32', 'round_of_16', 'quarterfinals', 'semifinals', 'third_place', 'final']
  const roundMap = Object.fromEntries(rounds.map((r) => [r.name, r]))

  const [selectedRound, setSelectedRound] = useState<RoundName>('round_of_32')
  const [slots, setSlots] = useState<Record<string, { home: string; away: string }>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const router = useRouter()

  const roundMatches = matches.filter((m) => m.round?.name === selectedRound)

  function getSlot(matchId: string, side: 'home' | 'away') {
    return slots[matchId]?.[side] ?? ''
  }

  function setSlot(matchId: string, side: 'home' | 'away', value: string) {
    setSlots((prev) => ({
      ...prev,
      [matchId]: { home: prev[matchId]?.home ?? '', away: prev[matchId]?.away ?? '', [side]: value },
    }))
  }

  async function handleAssign(match: MatchWithTeams) {
    const homeId = slots[match.id]?.home || null
    const awayId = slots[match.id]?.away || null

    setLoading((prev) => ({ ...prev, [match.id]: true }))
    const result = await assignKnockoutTeams(match.id, homeId, awayId)
    setFeedback((prev) => ({ ...prev, [match.id]: result.error ?? 'Assigned!' }))
    setLoading((prev) => ({ ...prev, [match.id]: false }))
    router.refresh()
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {knockoutRounds.map((roundName) => {
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

      <div className="space-y-3">
        {roundMatches.map((match) => (
          <div
            key={match.id}
            className="flex flex-wrap items-center gap-4 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-100"
          >
            <span className="text-xs text-gray-400">M{match.match_number}</span>
            <div className="flex-1 min-w-0 text-xs text-gray-500">
              <div>{match.placeholder_home}</div>
              <div>{match.placeholder_away}</div>
            </div>

            {match.home_team && match.away_team ? (
              <span className="text-sm font-medium text-green-700">
                {match.home_team.name} vs {match.away_team.name} ✓
              </span>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={getSlot(match.id, 'home')}
                  onChange={(e) => setSlot(match.id, 'home', e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="">Home team…</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <span className="text-gray-400">vs</span>
                <select
                  value={getSlot(match.id, 'away')}
                  onChange={(e) => setSlot(match.id, 'away', e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="">Away team…</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <Button size="sm" loading={loading[match.id]} onClick={() => handleAssign(match)}>
                  Assign
                </Button>
              </div>
            )}

            {feedback[match.id] && (
              <span className={`text-xs ${feedback[match.id] === 'Assigned!' ? 'text-green-600' : 'text-red-500'}`}>
                {feedback[match.id]}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
