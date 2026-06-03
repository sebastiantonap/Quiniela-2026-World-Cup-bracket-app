'use client'

import { useState, useMemo } from 'react'
import { GroupStageTab } from './GroupStageTab'
import { KnockoutTab } from './KnockoutTab'
import { ResultsTab } from './ResultsTab'
import { RoundStatusBadge } from '@/components/ui/Badge'
import { usePredictions } from '@/hooks/usePredictions'
import { useQualifications } from '@/hooks/useQualifications'
import { computePredictedStandings } from '@/lib/standings/predictedStandings'
import { classifyKnockoutMatch, PREV_ELIGIBILITY_ROUND, type KnockoutEligibility } from '@/lib/scoring/knockoutEligibility'
import { ROUND_ORDER } from '@/lib/constants/rounds'
import { useT } from '@/lib/i18n/I18nProvider'
import { roundLabel } from '@/lib/i18n/translator'
import type { MatchWithTeams, Prediction, Round, RoundName, Team, Group, QualState } from '@/types/app'

interface BracketShellProps {
  entryId: string
  rounds: Round[]
  matchesByRound: Record<RoundName, MatchWithTeams[]>
  initialPredictions: Record<string, Prediction>
  groups: (Group & { teams: Team[] })[]
  initialQuals: QualState
  initialThirdPlaceSelections: string[]
  entryTotalPoints: number
  readOnly?: boolean
  /** Rounds whose picks the viewer may see. Owners/admins get all; others only locked
   *  rounds. Defaults to every round so the owner/edit flow is unaffected. */
  revealedRounds?: RoundName[]
}

export function BracketShell({
  entryId,
  rounds,
  matchesByRound,
  initialPredictions,
  groups,
  initialQuals,
  initialThirdPlaceSelections,
  entryTotalPoints,
  readOnly = false,
  revealedRounds = ROUND_ORDER,
}: BracketShellProps) {
  const t = useT()
  const roundMap = Object.fromEntries(rounds.map((r) => [r.name, r]))
  const revealedSet = useMemo(() => new Set(revealedRounds), [revealedRounds])

  // Owners/editors land on the round currently accepting predictions. Read-only viewers
  // can't see open rounds, so default them to the latest round they're allowed to see.
  const defaultTab = readOnly
    ? [...ROUND_ORDER].reverse().find((r) => roundMap[r] && revealedSet.has(r)) ?? 'group_stage'
    : ROUND_ORDER.find((r) => roundMap[r]?.status === 'accepting_predictions') ?? 'group_stage'
  const [activeRound, setActiveRound] = useState<RoundName | 'results'>(defaultTab as RoundName)

  const { predictions, updatePrediction, saving, errors } = usePredictions(entryId, initialPredictions)
  const { quals, updateQualification, saving: qualSaving } = useQualifications(entryId, initialQuals)

  // Check if there are any confirmed results to show the Results tab
  const hasConfirmedResults = useMemo(() => {
    return Object.values(matchesByRound).some((roundMatches) =>
      roundMatches.some((m) => m.result_confirmed)
    )
  }, [matchesByRound])

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

  // Teams the user predicted to qualify from the group stage (1st/2nd per group + best-8 thirds)
  const eligibilitySet = useMemo(() => {
    const set = new Set<string>()
    for (const pick of Object.values(quals)) {
      if (pick.predicted1st) set.add(pick.predicted1st)
      if (pick.predicted2nd) set.add(pick.predicted2nd)
    }
    for (const teamId of initialThirdPlaceSelections) set.add(teamId)
    return set
  }, [quals, initialThirdPlaceSelections])

  const activeRoundData = roundMap[activeRound]
  const isEditable = !readOnly && activeRoundData?.status === 'accepting_predictions'
  const activeMatches = activeRound === 'results' ? [] : matchesByRound[activeRound] ?? []

  // For a competitor's bracket, rounds that haven't locked yet stay hidden.
  const activeRoundHidden =
    readOnly && activeRound !== 'results' && !revealedSet.has(activeRound as RoundName)

  // Per-match knockout eligibility for the active round. A team is "yours" if you correctly
  // had it advancing into this round: group picks feed Round of 32, then each round keys off
  // who you picked to win in the previous round. Mirrors the scoring engine.
  const knockoutEligibility = useMemo(() => {
    const result: Record<string, KnockoutEligibility> = {}
    if (activeRound === 'group_stage' || activeRound === 'results') return result

    let isEligible: (teamId: string) => boolean
    if (activeRound === 'round_of_32') {
      isEligible = (teamId) => eligibilitySet.has(teamId)
    } else {
      const prevRound = PREV_ELIGIBILITY_ROUND[activeRound as RoundName]
      const prevWinners = new Set<string>()
      for (const m of (prevRound && matchesByRound[prevRound]) ?? []) {
        const w = predictions[m.id]?.predicted_winner_team_id
        if (w) prevWinners.add(w)
      }
      isEligible = (teamId) => prevWinners.has(teamId)
    }

    for (const m of activeMatches) {
      result[m.id] = classifyKnockoutMatch(m.home_team_id, m.away_team_id, isEligible)
    }
    return result
  }, [activeRound, activeMatches, matchesByRound, predictions, eligibilitySet])

  function handleGroupUpdate(matchId: string, home: number | null, away: number | null) {
    updatePrediction(matchId, { predictedHome: home, predictedAway: away, predictedWinnerTeamId: null })
  }

  function handleKnockoutUpdate(matchId: string, home: number | null, away: number | null, winnerId: string | null, homePens: number | null, awayPens: number | null) {
    updatePrediction(matchId, {
      predictedHome: home,
      predictedAway: away,
      predictedHomePenalties: homePens,
      predictedAwayPenalties: awayPens,
      predictedWinnerTeamId: winnerId,
    })
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
                {roundLabel(t, roundName)}
                <RoundStatusBadge status={round.status} />
                {roundName !== 'group_stage' && unresolvedGroupCount > 0 && (
                  <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                    {t(unresolvedGroupCount === 1 ? 'bracket.tieOne' : 'bracket.tieOther', { count: unresolvedGroupCount })}
                  </span>
                )}
              </button>
            )
          })}
          {hasConfirmedResults && (
            <button
              key="results"
              onClick={() => setActiveRound('results')}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition whitespace-nowrap ${
                activeRound === 'results'
                  ? 'bg-slate-700 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('results.title')}
            </button>
          )}
        </div>
      </div>

      {/* Status banners */}
      {!isEditable && !activeRoundHidden && activeRoundData?.status === 'pending' && (
        <div className="mb-4 rounded-xl bg-slate-800 px-4 py-3 text-sm text-slate-400 border border-slate-700">
          {t('bracket.roundNotOpen')}
        </div>
      )}
      {!isEditable && activeRoundData?.status === 'locked' && (
        <div className="mb-4 rounded-xl bg-amber-900/20 border border-amber-800/40 px-4 py-3 text-sm text-amber-400">
          {t('bracket.roundLocked')}
        </div>
      )}
      {!isEditable && activeRoundData?.status === 'completed' && (
        <div className="mb-4 rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-sm text-slate-400">
          {t('bracket.roundCompleted')}
        </div>
      )}

      {activeRound === 'results' ? (
        <ResultsTab
          matches={Object.values(matchesByRound).flat()}
          predictions={predictions}
          rounds={rounds}
          totalPoints={entryTotalPoints}
        />
      ) : activeRoundHidden ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-8 text-center text-sm text-slate-400">
          {t('bracket.hiddenUntilLocked')}
        </div>
      ) : activeRound === 'group_stage' ? (
        <GroupStageTab
          entryId={entryId}
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
          initialThirdPlaceSelections={initialThirdPlaceSelections}
        />
      ) : (
        <KnockoutTab
          matches={activeMatches}
          predictions={predictions}
          isEditable={isEditable}
          onUpdate={handleKnockoutUpdate}
          saving={saving}
          eligibility={knockoutEligibility}
        />
      )}
    </div>
  )
}
