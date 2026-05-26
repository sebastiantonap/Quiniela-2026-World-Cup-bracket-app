'use client'

import { MatchRow } from './MatchRow'
import { GroupQualificationPicker } from './GroupQualificationPicker'
import type { MatchWithTeams, Prediction, Team, QualPick } from '@/types/app'

interface GroupCardProps {
  letter: string
  groupId: string
  teams: Team[]
  matches: MatchWithTeams[]
  predictions: Record<string, Prediction>
  qualPick: QualPick | undefined
  isEditable: boolean
  onMatchUpdate: (matchId: string, home: number | null, away: number | null) => void
  onQualUpdate: (groupId: string, updates: Partial<QualPick>) => void
  saving: Record<string, boolean>
  errors: Record<string, string>
  qualSaving?: boolean
}

export function GroupCard({
  letter,
  groupId,
  teams,
  matches,
  predictions,
  qualPick,
  isEditable,
  onMatchUpdate,
  onQualUpdate,
  saving,
  errors,
  qualSaving,
}: GroupCardProps) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800">
      <div className="border-b border-slate-700 px-4 py-3">
        <h3 className="font-bold text-slate-100">Group {letter}</h3>
      </div>
      <div className="divide-y divide-slate-700/50 px-2 py-2">
        {matches.map((match) => (
          <MatchRow
            key={match.id}
            match={match}
            prediction={predictions[match.id]}
            isEditable={isEditable}
            onUpdate={(home, away) => onMatchUpdate(match.id, home, away)}
            saving={saving[match.id]}
            error={errors[match.id]}
          />
        ))}
      </div>
      <div className="px-4 pb-4">
        <GroupQualificationPicker
          groupId={groupId}
          teams={teams}
          pick={qualPick}
          isEditable={isEditable}
          onUpdate={onQualUpdate}
          saving={qualSaving}
        />
      </div>
    </div>
  )
}
