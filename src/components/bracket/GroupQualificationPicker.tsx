'use client'

import { useT } from '@/lib/i18n/I18nProvider'
import type { TranslationKey } from '@/lib/i18n/dictionaries/en'
import type { Team, QualPick } from '@/types/app'
import type { StandingAmbiguities } from '@/lib/standings/predictedStandings'

interface Props {
  groupId: string
  teams: Team[]
  pick: QualPick | undefined
  isEditable: boolean
  onUpdate: (groupId: string, updates: Partial<QualPick>) => void
  saving?: boolean
  /** Per-boundary ambiguity flags from simulated standings. Omit when no predictions yet. */
  ambiguities?: StandingAmbiguities
}

const POSITIONS: { labelKey: TranslationKey; key: 'predicted1st' | 'predicted2nd' | 'predicted3rd'; pts: number }[] = [
  { labelKey: 'ord.first', key: 'predicted1st', pts: 4 },
  { labelKey: 'ord.second', key: 'predicted2nd', pts: 3 },
  { labelKey: 'ord.third', key: 'predicted3rd', pts: 2 },
]

/** Which position keys are ambiguous given the boundary flags. */
function positionAmbiguous(key: typeof POSITIONS[number]['key'], amb: StandingAmbiguities): boolean {
  if (key === 'predicted1st') return amb.first
  if (key === 'predicted2nd') return amb.first || amb.second
  if (key === 'predicted3rd') return amb.second || amb.third
  return false
}

export function GroupQualificationPicker({
  groupId,
  teams,
  pick,
  isEditable,
  onUpdate,
  saving,
  ambiguities,
}: Props) {
  const t = useT()
  // Only the user's explicitly-chosen picks count as "taken" — not null positions
  // that are blank because they're ambiguous.
  const selectedIds = new Set(
    [pick?.predicted1st, pick?.predicted2nd, pick?.predicted3rd].filter(Boolean) as string[]
  )
  const hasPoints = pick?.pointsAwarded !== null && pick?.pointsAwarded !== undefined

  return (
    <div className="mt-3 border-t border-slate-700 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t('picker.title')}
        </p>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-slate-500">{t('common.saving')}</span>}
          {hasPoints && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-400">
              +{pick!.pointsAwarded} {t('common.pts')}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        {POSITIONS.map(({ labelKey, key, pts }) => {
          const currentVal = pick?.[key] ?? null
          const isAmbig = ambiguities != null && positionAmbiguous(key, ambiguities)

          return (
            <div key={key} className="flex items-center gap-2">
              <span className="w-7 flex-shrink-0 text-xs font-bold text-amber-400">{t(labelKey)}</span>
              {isEditable ? (
                <select
                  value={currentVal ?? ''}
                  onChange={(e) => onUpdate(groupId, { [key]: e.target.value || null })}
                  className={`flex-1 rounded border px-2 py-1 text-xs text-slate-100 outline-none focus:ring-1 ${
                    isAmbig
                      ? 'border-amber-500/70 bg-amber-900/20 focus:border-amber-500 focus:ring-amber-500/30'
                      : 'border-slate-600 bg-slate-700 focus:border-amber-500 focus:ring-amber-500/30'
                  }`}
                >
                  <option value="">
                    {isAmbig ? t('picker.tiedPickManually') : t('picker.pickTeam')}
                  </option>
                  {teams.map((t) => {
                    // Grey out only teams the user has explicitly placed in another slot
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
              <span className="w-10 flex-shrink-0 text-right text-xs text-slate-500">{pts} {t('common.pts')}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
