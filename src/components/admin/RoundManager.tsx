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

const PREV_STATUS: Partial<Record<RoundStatus, RoundStatus>> = {
  accepting_predictions: 'pending',
  locked: 'accepting_predictions',
  completed: 'locked',
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

  async function handleRevert(round: Round) {
    const prevStatus = PREV_STATUS[round.status]
    if (!prevStatus) return
    const label = ROUND_LABELS[round.name]
    const confirmed = window.confirm(
      `Revert "${label}" from "${round.status.replace(/_/g, ' ')}" back to "${prevStatus.replace(/_/g, ' ')}"?`
    )
    if (!confirmed) return

    setLoading((prev) => ({ ...prev, [`revert-${round.id}`]: true }))
    const result = await setRoundStatus(round.id, prevStatus)
    if (result.error) {
      setFeedback((prev) => ({ ...prev, [round.id]: result.error! }))
    } else {
      setFeedback((prev) => ({ ...prev, [round.id]: `Reverted to "${prevStatus}"` }))
      router.refresh()
    }
    setLoading((prev) => ({ ...prev, [`revert-${round.id}`]: false }))
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
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/60">
          {rounds.map((round) => {
            const isOpen = round.status === 'accepting_predictions'
            const fb = feedback[round.id] ?? feedback[`recalc-${round.id}`]
            return (
              <tr
                key={round.id}
                className={isOpen ? 'bg-green-900/10 border-l-2 border-l-green-500' : ''}
              >
                <td className="px-6 py-4 font-medium text-slate-200">
                  {ROUND_LABELS[round.name]}
                  {isOpen && (
                    <span className="ml-2 text-xs font-normal text-green-400">● active</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <RoundStatusBadge status={round.status} />
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Primary forward action */}
                    {round.status === 'pending' && (
                      <Button size="sm" variant="primary" loading={loading[round.id]} onClick={() => handleTransition(round)}>
                        🔓 Open
                      </Button>
                    )}
                    {round.status === 'accepting_predictions' && (
                      <Button size="sm" variant="secondary" loading={loading[round.id]} onClick={() => handleTransition(round)}>
                        🔒 Lock
                      </Button>
                    )}
                    {round.status === 'locked' && (
                      <Button size="sm" variant="secondary" loading={loading[round.id]} onClick={() => handleTransition(round)}>
                        ✓ Complete
                      </Button>
                    )}

                    {/* Recalculate — available once results can be entered */}
                    {(round.status === 'locked' || round.status === 'completed') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={loading[`recalc-${round.id}`]}
                        onClick={() => handleRecalculate(round)}
                        disabled={round.calculating}
                      >
                        {round.calculating ? 'Calculating…' : '⟳ Recalculate'}
                      </Button>
                    )}

                    {/* Revert — always secondary, shown only where applicable */}
                    {PREV_STATUS[round.status] && (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={loading[`revert-${round.id}`]}
                        onClick={() => handleRevert(round)}
                        className="text-slate-500 hover:text-slate-300"
                      >
                        ↩
                      </Button>
                    )}
                  </div>
                  {fb && (
                    <p className="mt-1.5 text-xs text-slate-400">{fb}</p>
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
