'use client'

import { GroupCard } from './GroupCard'
import type { MatchWithTeams, Prediction } from '@/types/app'
import { GROUP_LETTERS } from '@/lib/constants/rounds'

interface GroupStageTabProps {
  matches: MatchWithTeams[]
  predictions: Record<string, Prediction>
  isEditable: boolean
  onUpdate: (matchId: string, home: number | null, away: number | null) => void
  saving: Record<string, boolean>
  errors: Record<string, string>
}

export function GroupStageTab({
  matches,
  predictions,
  isEditable,
  onUpdate,
  saving,
  errors,
}: GroupStageTabProps) {
  const byGroup = GROUP_LETTERS.reduce<Record<string, MatchWithTeams[]>>((acc, letter) => {
    acc[letter] = matches.filter((m) => m.group?.name === letter)
    return acc
  }, {})

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {GROUP_LETTERS.map((letter) => {
        const groupMatches = byGroup[letter]
        if (!groupMatches || groupMatches.length === 0) return null
        return (
          <GroupCard
            key={letter}
            letter={letter}
            matches={groupMatches}
            predictions={predictions}
            isEditable={isEditable}
            onUpdate={onUpdate}
            saving={saving}
            errors={errors}
          />
        )
      })}
    </div>
  )
}
