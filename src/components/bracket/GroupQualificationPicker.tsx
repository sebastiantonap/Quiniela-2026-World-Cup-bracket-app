'use client'

import type { Team, QualPick } from '@/types/app'

interface Props {
  groupId: string
  teams: Team[]
  pick: QualPick | undefined
  isEditable: boolean
  onUpdate: (groupId: string, updates: Partial<QualPick>) => void
  saving?: boolean
}

const POSITIONS = [
  { label: '1st', key: 'predicted1st' as const, pts: '4 pts' },
  { label: '2nd', key: 'predicted2nd' as const, pts: '3 pts' },
  { label: '3rd', key: 'predicted3rd' as const, pts: '2 pts' },
]

export function GroupQualificationPicker({ groupId, teams, pick, isEditable, onUpdate, saving }: Props) {
  const selectedIds = new Set([pick?.predicted1st, pick?.predicted2nd, pick?.predicted3rd].filter(Boolean) as string[])

  const hasPoints = pick?.pointsAwarded !== null && pick?.pointsAwarded !== undefined

  return (
    <div className="mt-3 border-t border-slate-700 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Group Finish Picks
        </p>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-slate-500">saving…</span>}
          {hasPoints && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400">
              +{pick!.pointsAwarded} pts
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {POSITIONS.map(({ label, key, pts }) => {
          const currentVal = pick?.[key] ?? null
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-7 flex-shrink-0 text-xs font-bold text-amber-400">{label}</span>
              {isEditable ? (
                <select
                  value={currentVal ?? ''}
                  onChange={(e) => onUpdate(groupId, { [key]: e.target.value || null })}
                  className="flex-1 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-slate-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
                >
                  <option value="">— pick a team —</option>
                  {teams.map((t) => {
                    const takenByOther = selectedIds.has(t.id) && t.id !== currentVal
                    return (
                      <option key={t.id} value={t.id} disabled={takenByOther}>
                        {t.flag_emoji} {t.name}
                      </option>
                    )
                  })}
                </select>
              ) : (
                <span className="flex-1 text-xs text-slate-300">
                  {teams.find((t) => t.id === currentVal)?.name ?? '—'}
                </span>
              )}
              <span className="w-10 flex-shrink-0 text-right text-xs text-slate-500">{pts}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
