'use client'

import { useState } from 'react'
import { GroupStageTab } from './GroupStageTab'
import { KnockoutTab } from './KnockoutTab'
import { RoundStatusBadge } from '@/components/ui/Badge'
import { usePredictions } from '@/hooks/usePredictions'
import { ROUND_LABELS, ROUND_ORDER } from '@/lib/constants/rounds'
import type { MatchWithTeams, Prediction, Round, RoundName } from '@/types/app'

interface BracketShellProps {
  entryId: string
  rounds: Round[]
  matchesByRound: Record<RoundName, MatchWithTeams[]>
  initialPredictions: Record<string, Prediction>
}

export function BracketShell({
  entryId,
  rounds,
  matchesByRound,
  initialPredictions,
}: BracketShellProps) {
  const roundMap = Object.fromEntries(rounds.map((r) => [r.name, r]))

  // Default active tab: the first open round, or group_stage
  const defaultTab =
    ROUND_ORDER.find((r) => roundMap[r]?.status === 'accepting_predictions') ??
    'group_stage'
  const [activeRound, setActiveRound] = useState<RoundName>(defaultTab as RoundName)

  const { predictions, updatePrediction, saving, errors } = usePredictions(
    entryId,
    initialPredictions
  )

  const activeRoundData = roundMap[activeRound]
  const isEditable = activeRoundData?.status === 'accepting_predictions'
  const activeMatches = matchesByRound[activeRound] ?? []

  function handleGroupUpdate(matchId: string, home: number | null, away: number | null) {
    updatePrediction(matchId, {
      predictedHome: home,
      predictedAway: away,
      predictedWinnerTeamId: null,
    })
  }

  function handleKnockoutUpdate(
    matchId: string,
    home: number | null,
    away: number | null,
    winnerId: string | null
  ) {
    updatePrediction(matchId, {
      predictedHome: home,
      predictedAway: away,
      predictedWinnerTeamId: winnerId,
    })
  }

  return (
    <div>
      {/* Round tabs */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1 min-w-max">
          {ROUND_ORDER.map((roundName) => {
            const round = roundMap[roundName]
            if (!round) return null
            const isActive = activeRound === roundName
            return (
              <button
                key={roundName}
                onClick={() => setActiveRound(roundName)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {ROUND_LABELS[roundName]}
                <RoundStatusBadge status={round.status} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Round content */}
      {!isEditable && activeRoundData?.status === 'pending' && (
        <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          This round hasn't opened yet. Check back soon.
        </div>
      )}
      {!isEditable && activeRoundData?.status === 'locked' && (
        <div className="mb-4 rounded-xl bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          Predictions are locked for this round. Results are being entered.
        </div>
      )}
      {!isEditable && activeRoundData?.status === 'completed' && (
        <div className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
          This round is complete. Scores have been calculated.
        </div>
      )}

      {activeRound === 'group_stage' ? (
        <GroupStageTab
          matches={activeMatches}
          predictions={predictions}
          isEditable={isEditable}
          onUpdate={handleGroupUpdate}
          saving={saving}
          errors={errors}
        />
      ) : (
        <KnockoutTab
          matches={activeMatches}
          predictions={predictions}
          isEditable={isEditable}
          onUpdate={handleKnockoutUpdate}
          saving={saving}
        />
      )}
    </div>
  )
}
