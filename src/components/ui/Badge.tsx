'use client'

import type { RoundStatus } from '@/types/app'
import { useT } from '@/lib/i18n/I18nProvider'
import type { TranslationKey } from '@/lib/i18n/dictionaries/en'

const statusConfig: Record<RoundStatus, { key: TranslationKey; classes: string }> = {
  pending:               { key: 'badge.pending', classes: 'bg-slate-700 text-slate-400' },
  accepting_predictions: { key: 'badge.open',    classes: 'bg-green-900/60 text-green-400' },
  locked:                { key: 'badge.locked',  classes: 'bg-amber-900/60 text-amber-400' },
  completed:             { key: 'badge.done',    classes: 'bg-slate-700 text-slate-300' },
}

export function RoundStatusBadge({ status }: { status: RoundStatus }) {
  const t = useT()
  const config = statusConfig[status]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.classes}`}
    >
      {t(config.key)}
    </span>
  )
}

export function PointsBadge({ points }: { points: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400">
      +{points}
    </span>
  )
}
