import Link from 'next/link'
import type { LeaderboardRow } from '@/types/app'

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

interface LeaderboardTableProps {
  rows: LeaderboardRow[]
  currentPage: number
  totalPages: number
  currentUserEmail: string | null
}

export function LeaderboardTable({ rows, currentPage, totalPages, currentUserEmail }: LeaderboardTableProps) {
  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="w-12 px-4 py-3">Rank</th>
              <th className="px-4 py-3">Bracket</th>
              <th className="hidden px-4 py-3 sm:table-cell">User</th>
              <th className="hidden px-4 py-3 text-center md:table-cell">Picks</th>
              <th className="px-4 py-3 text-right">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {rows.map((row) => {
              const isMe = currentUserEmail !== null && currentUserEmail === row.user_email
              const { icon, classes } = rankDisplay(row.rank)
              return (
                <tr
                  key={row.entry_id}
                  className={`transition ${
                    isMe ? 'bg-amber-500/10 hover:bg-amber-500/15' : 'hover:bg-slate-700/40'
                  }`}
                >
                  <td className={`px-4 py-3 ${classes}`}>
                    {icon ? <span>{icon}</span> : `#${row.rank}`}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${isMe ? 'text-amber-400' : 'text-slate-200'}`}>
                      {row.entry_name}
                    </span>
                    {isMe && (
                      <span className="ml-2 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs font-semibold text-amber-400">
                        you
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-400 sm:table-cell">
                    {maskEmail(row.user_email)}
                  </td>
                  <td className="hidden px-4 py-3 text-center text-slate-500 md:table-cell">
                    {row.predictions_count}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold tabular-nums ${isMe ? 'text-amber-400' : 'text-slate-100'}`}>
                      {row.total_points}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

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
