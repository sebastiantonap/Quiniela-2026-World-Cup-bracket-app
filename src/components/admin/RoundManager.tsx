'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setRoundStatus } from '@/actions/admin/rounds'
import { triggerRecalculation } from '@/actions/admin/recalculate'
import { RoundStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ROUND_LABELS } from '@/lib/constants/rounds'
import type { Round, RoundStatus } from '@/types/app'

interface RoundManagerProps {
  rounds: Round[]
}

const NEXT_STATUS: Partial<Record<RoundStatus, RoundStatus>> = {
  pending: 'accepting_predictions',
  accepting_predictions: 'locked',
  locked: 'completed',
}

export function RoundManager({ rounds }: RoundManagerProps) {
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const router = useRouter()

  async function handleTransition(round: Round) {
    const nextStatus = NEXT_STATUS[round.status]
    if (!nextStatus) return

    setLoading((prev) => ({ ...prev, [round.id]: true }))
    const result = await setRoundStatus(round.id, nextStatus)
    if (result.error) {
      setFeedback((prev) => ({ ...prev, [round.id]: result.error! }))
    } else {
      setFeedback((prev) => ({ ...prev, [round.id]: `Moved to "${nextStatus}"` }))
      router.refresh()
    }
    setLoading((prev) => ({ ...prev, [round.id]: false }))
  }

  async function handleRecalculate(round: Round) {
    setLoading((prev) => ({ ...prev, [`recalc-${round.id}`]: true }))
    const result = await triggerRecalculation(round.id)
    setFeedback((prev) => ({
      ...prev,
      [`recalc-${round.id}`]: result.error ?? 'Scores recalculated!',
    }))
    setLoading((prev) => ({ ...prev, [`recalc-${round.id}`]: false }))
    router.refresh()
  }

  return (
    <div className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-700/50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
            <th className="px-6 py-3">Round</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3">Actions</th>
            <th className="px-6 py-3">Feedback</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/60">
          {rounds.map((round) => {
            const nextStatus = NEXT_STATUS[round.status]
            return (
              <tr key={round.id}>
                <td className="px-6 py-4 font-medium text-slate-200">{ROUND_LABELS[round.name]}</td>
                <td className="px-6 py-4">
                  <RoundStatusBadge status={round.status} />
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    {nextStatus && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={loading[round.id]}
                        onClick={() => handleTransition(round)}
                      >
                        → {nextStatus.replace(/_/g, ' ')}
                      </Button>
                    )}
                    {(round.status === 'locked' || round.status === 'completed') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={loading[`recalc-${round.id}`]}
                        onClick={() => handleRecalculate(round)}
                        disabled={round.calculating}
                      >
                        {round.calculating ? 'Calculating…' : 'Recalculate'}
                      </Button>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-xs text-slate-400">
                  {feedback[round.id] && <span>{feedback[round.id]}</span>}
                  {feedback[`recalc-${round.id}`] && (
                    <span>{feedback[`recalc-${round.id}`]}</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
