'use client'

import { useState, useMemo } from 'react'
import { GroupCard } from './GroupCard'
import { ThirdPlaceSelector } from './ThirdPlaceSelector'
import { computePredictedStandings } from '@/lib/standings/predictedStandings'
import { sortThirdPlaceTeams, computeTieZone } from '@/lib/standings/thirdPlaceRanking'
import { GROUP_LETTERS } from '@/lib/constants/rounds'
import type { MatchWithTeams, Prediction, Team, Group, QualPick } from '@/types/app'

interface GroupStageTabProps {
  entryId: string
  matches: MatchWithTeams[]
  groups: (Group & { teams: Team[] })[]
  predictions: Record<string, Prediction>
  quals: Record<string, QualPick>
  isEditable: boolean
  onMatchUpdate: (matchId: string, home: number | null, away: number | null) => void
  onQualUpdate: (groupId: string, updates: Partial<QualPick>) => void
  saving: Record<string, boolean>
  errors: Record<string, string>
  qualSaving: Record<string, boolean>
  unresolvedCount: number
  initialThirdPlaceSelections: string[]
}

export function GroupStageTab({
  entryId,
  matches,
  groups,
  predictions,
  quals,
  isEditable,
  onMatchUpdate,
  onQualUpdate,
  saving,
  errors,
  qualSaving,
  unresolvedCount,
  initialThirdPlaceSelections,
}: GroupStageTabProps) {
  const groupMap = Object.fromEntries(groups.map((g) => [g.name, g]))
  const groupStageMatches = matches.filter((m) => m.round?.name === 'group_stage')
  const [showThirdPlaceModal, setShowThirdPlaceModal] = useState(false)

  // Detect whether there's an unresolved tie at the 8/9 third-place boundary
  const { hasBoundaryTie, predictedThirdCount } = useMemo(() => {
    const thirds = []
    for (const letter of GROUP_LETTERS) {
      const group = groupMap[letter]
      if (!group) continue
      const groupMatches = groupStageMatches.filter((m) => m.group?.name === letter)
      const { standings, predictedMatchCount } = computePredictedStandings(
        group.teams,
        groupMatches,
        predictions
      )
      if (predictedMatchCount === 0 || !standings[2]) continue
      const s = standings[2]
      thirds.push({
        group: letter,
        teamId: s.team.id,
        teamName: s.team.name,
        flagEmoji: s.team.flag_emoji,
        points: s.points,
        goals_for: s.goals_for,
        goals_against: s.goals_against,
        goal_difference: s.goal_difference,
      })
    }
    const sorted = sortThirdPlaceTeams(thirds)
    const { hasBoundaryTie } = computeTieZone(sorted)
    return { hasBoundaryTie, predictedThirdCount: sorted.length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, groupStageMatches, predictions])

  return (
    <div className="space-y-4">
      {unresolvedCount > 0 && isEditable && (
        <div className="rounded-xl border border-amber-700/40 bg-amber-900/20 px-4 py-3 text-sm text-amber-300">
          <span className="font-semibold">{unresolvedCount} group{unresolvedCount !== 1 ? 's' : ''}</span>
          {' '}have tied positions that need manual resolution before your bracket is complete.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {GROUP_LETTERS.map((letter) => {
          const group = groupMap[letter]
          if (!group) return null
          const groupMatches = matches.filter((m) => m.group?.name === letter)
          if (groupMatches.length === 0) return null
          return (
            <GroupCard
              key={letter}
              letter={letter}
              groupId={group.id}
              teams={group.teams}
              matches={groupMatches}
              predictions={predictions}
              qualPick={quals[group.id]}
              isEditable={isEditable}
              onMatchUpdate={onMatchUpdate}
              onQualUpdate={onQualUpdate}
              saving={saving}
              errors={errors}
              qualSaving={qualSaving[group.id]}
            />
          )
        })}
      </div>

      {/* Best 8 Third-Place trigger */}
      {predictedThirdCount > 0 && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setShowThirdPlaceModal(true)}
            className="flex items-center gap-2 rounded-xl border border-amber-700/50 bg-amber-900/20 px-5 py-3 text-sm font-medium text-amber-300 transition hover:bg-amber-900/30"
          >
            <span>Best 8 Third-Place Teams</span>
            <span className="text-xs text-slate-400">({predictedThirdCount}/12 predicted)</span>
            {hasBoundaryTie && (
              <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                tie
              </span>
            )}
            <span className="text-slate-500">→</span>
          </button>
        </div>
      )}

      {showThirdPlaceModal && (
        <ThirdPlaceSelector
          entryId={entryId}
          groups={groups}
          matches={matches}
          predictions={predictions}
          isEditable={isEditable}
          initialSelections={initialThirdPlaceSelections}
          onClose={() => setShowThirdPlaceModal(false)}
        />
      )}
    </div>
  )
}
