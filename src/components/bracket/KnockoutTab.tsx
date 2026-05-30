'use client'

import { KnockoutMatchCard } from './KnockoutMatchCard'
import type { MatchWithTeams, Prediction } from '@/types/app'

interface KnockoutTabProps {
  matches: MatchWithTeams[]
  predictions: Record<string, Prediction>
  isEditable: boolean
  onUpdate: (matchId: string, home: number | null, away: number | null, winnerId: string | null) => void
  saving: Record<string, boolean>
  eligibilitySet: Set<string>
}

export function KnockoutTab({ matches, predictions, isEditable, onUpdate, saving, eligibilitySet }: KnockoutTabProps) {
  if (matches.length === 0) {
    return (
      <div className="py-16 text-center text-slate-500">
        <p className="text-lg">No matches scheduled yet for this round.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {matches.map((match) => (
        <KnockoutMatchCard
          key={match.id}
          match={match}
          prediction={predictions[match.id]}
          isEditable={isEditable}
          onUpdate={(home, away, winnerId) => onUpdate(match.id, home, away, winnerId)}
          saving={saving[match.id]}
          eligibilitySet={eligibilitySet}
        />
      ))}
    </div>
  )
}
