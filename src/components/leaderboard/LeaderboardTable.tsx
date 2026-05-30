'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ROUND_LABELS, ROUND_ORDER } from '@/lib/constants/rounds'
import type { EnrichedLeaderboardRow } from '@/types/app'

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain || local.length <= 1) return email
  return `${local[0]}***@${domain}`
}

function rankDisplay(rank: number) {
  if (rank === 1) return { icon: '🥇', classes: 'text-amber-400 font-bold text-base' }
  if (rank === 2) return { icon: '🥈', classes: 'text-slate-300 font-bold text-base' }
  if (rank === 3) return { icon: '🥉', classes: 'text-amber-700 font-bold text-base' }
  return { icon: null, classes: 'text-slate-500 tabular-nums' }
}

function RankDelta({ delta, hasSnapshot }: { delta: number; hasSnapshot: boolean }) {
  if (!hasSnapshot || delta === 0) return <span className="text-slate-600 text-[10px]">—</span>
  if (delta > 0)
    return (
      <span className="text-green-400 text-[10px] font-semibold tabular-nums">↑{delta}</span>
    )
  return (
    <span className="text-red-400 text-[10px] font-semibold tabular-nums">↓{Math.abs(delta)}</span>
  )
}

function BreakdownTooltip({ row }: { row: EnrichedLeaderboardRow }) {
  const [open, setOpen] = useState(false)
  const hasBreakdown = Object.keys(row.round_breakdown).length > 0

  if (!hasBreakdown) {
    return <span className="font-bold tabular-nums text-slate-100">{row.total_points}</span>
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="font-bold tabular-nums text-slate-100 underline decoration-dotted underline-offset-2 hover:text-amber-300 transition"
        title="Click for round breakdown"
      >
        {row.total_points}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-slate-600 bg-slate-900 p-3 shadow-xl text-xs">
            <p className="mb-2 font-semibold text-slate-300 uppercase tracking-wide text-[10px]">
              Points by round
            </p>
            {ROUND_ORDER.filter((r) => row.round_breakdown[r] !== undefined).map((r) => (
              <div key={r} className="flex justify-between py-0.5 text-slate-300">
                <span>{ROUND_LABELS[r]}</span>
                <span className="font-semibold text-slate-100">{row.round_breakdown[r]}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

interface LeaderboardTableProps {
  rows: EnrichedLeaderboardRow[]
  currentPage: number
  totalPages: number
  currentUserEmail: string | null
}

export function LeaderboardTable({ rows, currentPage, totalPages, currentUserEmail }: LeaderboardTableProps) {
  const anyHasSnapshot = rows.some((r) => r.rank_snapshot !== null)

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="w-16 px-4 py-3">Rank</th>
              <th className="px-4 py-3">Bracket</th>
              <th className="hidden px-4 py-3 sm:table-cell">User</th>
              <th className="hidden px-4 py-3 text-center lg:table-cell">Correct %</th>
              <th className="hidden px-4 py-3 text-right lg:table-cell">Max</th>
              <th className="px-4 py-3 text-right">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {rows.map((row) => {
              const isMe = currentUserEmail !== null && currentUserEmail === row.user_email
              const { icon, classes } = rankDisplay(row.rank)
              const correctPct =
                row.scored_predictions > 0
                  ? Math.round((row.correct_predictions / row.scored_predictions) * 100)
                  : null

              return (
                <tr
                  key={row.entry_id}
                  className={`transition ${
                    isMe ? 'bg-amber-500/10 hover:bg-amber-500/15' : 'hover:bg-slate-700/40'
                  }`}
                >
                  {/* Rank + delta */}
                  <td className={`px-4 py-3 ${classes}`}>
                    <div className="flex flex-col items-start gap-0.5">
                      <span>{icon ? icon : `#${row.rank}`}</span>
                      {anyHasSnapshot && (
                        <RankDelta delta={row.rank_delta} hasSnapshot={row.rank_snapshot !== null} />
                      )}
                    </div>
                  </td>

                  {/* Bracket name — links to public entry view */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/entries/${row.entry_id}`}
                      className={`font-medium hover:underline ${isMe ? 'text-amber-400' : 'text-slate-200 hover:text-amber-300'}`}
                    >
                      {row.entry_name}
                    </Link>
                    {isMe && (
                      <span className="ml-2 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs font-semibold text-amber-400">
                        you
                      </span>
                    )}
                  </td>

                  {/* Masked email */}
                  <td className="hidden px-4 py-3 text-slate-400 sm:table-cell">
                    {maskEmail(row.user_email)}
                  </td>

                  {/* Correct % */}
                  <td className="hidden px-4 py-3 text-center text-slate-400 lg:table-cell">
                    {correctPct !== null ? (
                      <span className={correctPct >= 60 ? 'text-green-400' : correctPct >= 40 ? 'text-amber-400' : 'text-slate-400'}>
                        {correctPct}%
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>

                  {/* Max potential */}
                  <td className="hidden px-4 py-3 text-right text-slate-500 tabular-nums lg:table-cell">
                    ≤&nbsp;{row.max_potential}
                  </td>

                  {/* Points with breakdown tooltip */}
                  <td className={`px-4 py-3 text-right ${isMe ? 'text-amber-400' : ''}`}>
                    <BreakdownTooltip row={row} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <p className="mt-2 text-center text-xs text-slate-600">
        Click a points total to see round-by-round breakdown · Click a bracket name to view picks
      </p>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link
              href={`/leaderboard?page=${currentPage - 1}`}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-700"
            >
              ← Previous
            </Link>
          )}
          <span className="text-sm text-slate-500">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              href={`/leaderboard?page=${currentPage + 1}`}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-700"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
