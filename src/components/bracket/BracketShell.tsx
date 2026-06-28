'use client'

import { useState, useMemo, useCallback } from 'react'
import { GroupStageTab } from './GroupStageTab'
import { KnockoutBracketView } from './KnockoutBracketView'
import { ResultsTab } from './ResultsTab'
import { RoundStatusBadge } from '@/components/ui/Badge'
import { usePredictions } from '@/hooks/usePredictions'
import { useQualifications } from '@/hooks/useQualifications'
import { computePredictedStandings } from '@/lib/standings/predictedStandings'
import { classifyKnockoutMatch, PREV_ELIGIBILITY_ROUND, type KnockoutEligibility } from '@/lib/scoring/knockoutEligibility'
import { ROUND_ORDER } from '@/lib/constants/rounds'
import { resolveUserBracket, findStaleDownstream } from '@/lib/bracket/resolveUserBracket'
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
  const hasKnockoutRounds = ROUND_ORDER.some((r) => r !== 'group_stage' && roundMap[r])
  // If the default tab would be a knockout round, redirect to the bracket view
  const effectiveDefault = defaultTab !== 'group_stage' && hasKnockoutRounds
    ? 'knockout_bracket'
    : defaultTab
  const [activeRound, setActiveRound] = useState<RoundName | 'results' | 'knockout_bracket'>(effectiveDefault as RoundName)

  const { predictions, updatePrediction, clearPrediction, saving, errors } = usePredictions(entryId, initialPredictions)
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

  // Build team lookup for resolving predicted bracket slots
  const teamById = useMemo(() => {
    const map = new Map<string, Team>()
    for (const group of groups) {
      for (const team of group.teams) {
        map.set(team.id, team)
      }
    }
    // Also collect teams from match data (covers teams without group)
    for (const roundMatches of Object.values(matchesByRound)) {
      for (const m of roundMatches) {
        if (m.home_team) map.set(m.home_team.id, m.home_team)
        if (m.away_team) map.set(m.away_team.id, m.away_team)
      }
    }
    return map
  }, [groups, matchesByRound])

  // Resolve predicted teams for all knockout match slots
  const predictedSlots = useMemo(
    () => resolveUserBracket(matchesByRound, predictions, teamById),
    [matchesByRound, predictions, teamById],
  )

  const activeRoundData = roundMap[activeRound]
  const isEditable = !readOnly && activeRoundData?.status === 'accepting_predictions'
  const activeMatches = activeRound === 'results' || activeRound === 'knockout_bracket'
    ? []
    : matchesByRound[activeRound] ?? []

  const isEditableRound = useCallback(
    (roundName: RoundName) => !readOnly && roundMap[roundName]?.status === 'accepting_predictions',
    [readOnly, roundMap],
  )

  // For a competitor's bracket, rounds that haven't locked yet stay hidden.
  const activeRoundHidden =
    readOnly && activeRound !== 'results' && activeRound !== 'knockout_bracket' && !revealedSet.has(activeRound as RoundName)

  // Per-match knockout eligibility for ALL knockout rounds. Uses predicted teams
  // (from user's bracket picks) when DB teams aren't assigned yet.
  const knockoutEligibility = useMemo(() => {
    const result: Record<string, KnockoutEligibility> = {}
    const knockoutRounds: RoundName[] = ROUND_ORDER.filter((r) => r !== 'group_stage')

    for (const roundName of knockoutRounds) {
      const matches = matchesByRound[roundName] ?? []
      if (matches.length === 0) continue

      let isEligible: (teamId: string) => boolean
      if (roundName === 'round_of_32') {
        isEligible = (teamId) => eligibilitySet.has(teamId)
      } else {
        const prevRound = PREV_ELIGIBILITY_ROUND[roundName]
        const prevWinners = new Set<string>()
        for (const m of (prevRound && matchesByRound[prevRound]) ?? []) {
          const w = predictions[m.id]?.predicted_winner_team_id
          if (w) prevWinners.add(w)
        }
        isEligible = (teamId) => prevWinners.has(teamId)
      }

      for (const m of matches) {
        // Use predicted team IDs when DB team IDs are null
        const homeId = m.home_team_id ?? predictedSlots[m.id]?.home.team?.id ?? null
        const awayId = m.away_team_id ?? predictedSlots[m.id]?.away.team?.id ?? null
        result[m.id] = classifyKnockoutMatch(homeId, awayId, isEligible)
      }
    }
    return result
  }, [matchesByRound, predictions, eligibilitySet, predictedSlots])

  function handleGroupUpdate(matchId: string, home: number | null, away: number | null) {
    updatePrediction(matchId, { predictedHome: home, predictedAway: away, predictedWinnerTeamId: null })
  }

  function handleKnockoutUpdate(matchId: string, home: number | null, away: number | null, winnerId: string | null, homePens: number | null, awayPens: number | null) {
    // Find and clear downstream predictions whose teams changed
    const prevWinner = predictions[matchId]?.predicted_winner_team_id ?? null
    if (prevWinner !== winnerId) {
      const stale = findStaleDownstream(matchId, matchesByRound, predictions)
      stale.forEach((staleId) => {
        clearPrediction(staleId)
      })
    }

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
          {/* Group Stage tab */}
          {roundMap['group_stage'] && (
            <button
              key="group_stage"
              onClick={() => setActiveRound('group_stage')}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition whitespace-nowrap ${
                activeRound === 'group_stage'
                  ? 'bg-slate-700 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {roundLabel(t, 'group_stage')}
              <RoundStatusBadge status={roundMap['group_stage'].status} />
            </button>
          )}
          {/* Combined Knockout Bracket tab */}
          {hasKnockoutRounds && (
            <button
              key="knockout"
              onClick={() => setActiveRound('knockout_bracket')}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition whitespace-nowrap ${
                activeRound === 'knockout_bracket'
                  ? 'bg-slate-700 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t('bracket.knockoutBracket')}
              {unresolvedGroupCount > 0 && (
                <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                  {t(unresolvedGroupCount === 1 ? 'bracket.tieOne' : 'bracket.tieOther', { count: unresolvedGroupCount })}
                </span>
              )}
            </button>
          )}
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

      {/* Status banners — only for group stage (knockout shows per-round status inline) */}
      {activeRound === 'group_stage' && !isEditable && !activeRoundHidden && activeRoundData?.status === 'pending' && (
        <div className="mb-4 rounded-xl bg-slate-800 px-4 py-3 text-sm text-slate-400 border border-slate-700">
          {t('bracket.roundNotOpen')}
        </div>
      )}
      {activeRound === 'group_stage' && !isEditable && activeRoundData?.status === 'locked' && (
        <div className="mb-4 rounded-xl bg-amber-900/20 border border-amber-800/40 px-4 py-3 text-sm text-amber-400">
          {t('bracket.roundLocked')}
        </div>
      )}
      {activeRound === 'group_stage' && !isEditable && activeRoundData?.status === 'completed' && (
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
      ) : activeRound === 'knockout_bracket' ? (
        <KnockoutBracketView
          matchesByRound={matchesByRound}
          predictions={predictions}
          predictedSlots={predictedSlots}
          isEditableRound={isEditableRound}
          onUpdate={handleKnockoutUpdate}
          saving={saving}
          eligibility={knockoutEligibility}
        />
      ) : null}
    </div>
  )
}
