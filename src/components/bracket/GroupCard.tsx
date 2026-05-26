'use client'

import { MatchRow } from './MatchRow'
import type { MatchWithTeams, Prediction } from '@/types/app'

interface GroupCardProps {
  letter: string
  matches: MatchWithTeams[]
  predictions: Record<string, Prediction>
  isEditable: boolean
  onUpdate: (matchId: string, home: number | null, away: number | null) => void
  saving: Record<string, boolean>
  errors: Record<string, string>
}

export function GroupCard({
  letter,
  matches,
  predictions,
  isEditable,
  onUpdate,
  saving,
  errors,
}: GroupCardProps) {
  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
      <div className="border-b border-gray-100 px-4 py-3">
        <h3 className="font-bold text-gray-900">Group {letter}</h3>
      </div>
      <div className="divide-y divide-gray-50 px-2 py-2">
        {matches.map((match) => (
          <MatchRow
            key={match.id}
            match={match}
            prediction={predictions[match.id]}
            isEditable={isEditable}
            onUpdate={(home, away) => onUpdate(match.id, home, away)}
            saving={saving[match.id]}
            error={errors[match.id]}
          />
        ))}
      </div>
    </div>
  )
}
