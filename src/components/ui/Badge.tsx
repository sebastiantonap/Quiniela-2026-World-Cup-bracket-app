import type { RoundStatus } from '@/types/app'

const statusConfig: Record<RoundStatus, { label: string; classes: string }> = {
  pending:                { label: 'Pending',      classes: 'bg-gray-100 text-gray-600' },
  accepting_predictions:  { label: 'Open',         classes: 'bg-green-100 text-green-700' },
  locked:                 { label: 'Locked',       classes: 'bg-yellow-100 text-yellow-700' },
  completed:              { label: 'Completed',    classes: 'bg-blue-100 text-blue-700' },
}

export function RoundStatusBadge({ status }: { status: RoundStatus }) {
  const config = statusConfig[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.classes}`}>
      {config.label}
    </span>
  )
}

export function PointsBadge({ points }: { points: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
      +{points}pt{points !== 1 ? 's' : ''}
    </span>
  )
}
