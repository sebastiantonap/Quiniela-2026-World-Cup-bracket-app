'use client'

import { GroupCard } from './GroupCard'
import type { MatchWithTeams, Prediction, Team, Group, QualPick } from '@/types/app'
import { GROUP_LETTERS } from '@/lib/constants/rounds'

interface GroupStageTabProps {
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
}

export function GroupStageTab({
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
}: GroupStageTabProps) {
  const groupMap = Object.fromEntries(groups.map((g) => [g.name, g]))

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
    </div>
  )
}
