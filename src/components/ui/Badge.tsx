import type { RoundStatus } from '@/types/app'

const statusConfig: Record<RoundStatus, { label: string; classes: string }> = {
  pending:               { label: 'Pending',   classes: 'bg-slate-700 text-slate-400' },
  accepting_predictions: { label: 'Open',      classes: 'bg-green-900/60 text-green-400' },
  locked:                { label: 'Locked',    classes: 'bg-amber-900/60 text-amber-400' },
  completed:             { label: 'Done',      classes: 'bg-slate-700 text-slate-300' },
}

export function RoundStatusBadge({ status }: { status: RoundStatus }) {
  const config = statusConfig[status]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.classes}`}
    >
      {config.label}
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
