'use client'

import { useState, useMemo } from 'react'
import { GroupStageTab } from './GroupStageTab'
import { KnockoutTab } from './KnockoutTab'
import { RoundStatusBadge } from '@/components/ui/Badge'
import { usePredictions } from '@/hooks/usePredictions'
import { useQualifications } from '@/hooks/useQualifications'
import { computePredictedStandings } from '@/lib/standings/predictedStandings'
import { ROUND_LABELS, ROUND_ORDER } from '@/lib/constants/rounds'
import type { MatchWithTeams, Prediction, Round, RoundName, Team, Group, QualState } from '@/types/app'

interface BracketShellProps {
  entryId: string
  rounds: Round[]
  matchesByRound: Record<RoundName, MatchWithTeams[]>
  initialPredictions: Record<string, Prediction>
  groups: (Group & { teams: Team[] })[]
  initialQuals: QualState
}

export function BracketShell({
  entryId,
  rounds,
  matchesByRound,
  initialPredictions,
  groups,
  initialQuals,
}: BracketShellProps) {
  const roundMap = Object.fromEntries(rounds.map((r) => [r.name, r]))

  const defaultTab =
    ROUND_ORDER.find((r) => roundMap[r]?.status === 'accepting_predictions') ?? 'group_stage'
  const [activeRound, setActiveRound] = useState<RoundName>(defaultTab as RoundName)

  const { predictions, updatePrediction, saving, errors } = usePredictions(entryId, initialPredictions)
  const { quals, updateQualification, saving: qualSaving } = useQualifications(entryId, initialQuals)

  // Count groups with tied positions that haven't been manually resolved yet
  const unresolvedGroupCount = useMemo(() => {
    const groupStageMatches = matchesByRound['group_stage'] ?? []
    return groups.reduce((count, group) => {
      const gMatches = groupStageMatches.filter((m) => m.group?.name === group.name)
      const { ambiguities, predictedMatchCount } = computePredictedStandings(
        group.teams, gMatches, predictions
      )
      if (predictedMatchCount === 0) return count
      const pick = quals[group.id]
      const unresolved =
        (ambiguities.first && !pick?.predicted1st) ||
        ((ambiguities.first || ambiguities.second) && !pick?.predicted2nd) ||
        ((ambiguities.second || ambiguities.third) && !pick?.predicted3rd)
      return count + (unresolved ? 1 : 0)
    }, 0)
  }, [groups, matchesByRound, predictions, quals])

  const activeRoundData = roundMap[activeRound]
  const isEditable = activeRoundData?.status === 'accepting_predictions'
  const activeMatches = matchesByRound[activeRound] ?? []

  function handleGroupUpdate(matchId: string, home: number | null, away: number | null) {
    updatePrediction(matchId, { predictedHome: home, predictedAway: away, predictedWinnerTeamId: null })
  }

  function handleKnockoutUpdate(matchId: string, home: number | null, away: number | null, winnerId: string | null) {
    updatePrediction(matchId, { predictedHome: home, predictedAway: away, predictedWinnerTeamId: winnerId })
  }

  return (
    <div>
      {/* Round tabs */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-1 rounded-xl bg-slate-800 p-1 min-w-max">
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
                    ? 'bg-slate-700 text-slate-100 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {ROUND_LABELS[roundName]}
                <RoundStatusBadge status={round.status} />
                {roundName !== 'group_stage' && unresolvedGroupCount > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                    {unresolvedGroupCount} tie{unresolvedGroupCount !== 1 ? 's' : ''}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Status banners */}
      {!isEditable && activeRoundData?.status === 'pending' && (
        <div className="mb-4 rounded-xl bg-slate-800 px-4 py-3 text-sm text-slate-400 border border-slate-700">
          This round hasn't opened yet. Check back soon.
        </div>
      )}
      {!isEditable && activeRoundData?.status === 'locked' && (
        <div className="mb-4 rounded-xl bg-amber-900/20 border border-amber-800/40 px-4 py-3 text-sm text-amber-400">
          Predictions are locked for this round. Results are being entered.
        </div>
      )}
      {!isEditable && activeRoundData?.status === 'completed' && (
        <div className="mb-4 rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-sm text-slate-400">
          This round is complete. Scores have been calculated.
        </div>
      )}

      {activeRound === 'group_stage' ? (
        <GroupStageTab
          matches={activeMatches}
          groups={groups}
          predictions={predictions}
          quals={quals}
          isEditable={isEditable}
          onMatchUpdate={handleGroupUpdate}
          onQualUpdate={updateQualification}
          saving={saving}
          errors={errors}
          qualSaving={qualSaving}
          unresolvedCount={unresolvedGroupCount}
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
