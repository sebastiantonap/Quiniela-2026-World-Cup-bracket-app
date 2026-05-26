import Link from 'next/link'
import type { LeaderboardRow } from '@/types/app'

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain || local.length <= 1) return email
  return `${local[0]}***@${domain}`
}

interface LeaderboardTableProps {
  rows: LeaderboardRow[]
  currentPage: number
  totalPages: number
}

export function LeaderboardTable({ rows, currentPage, totalPages }: LeaderboardTableProps) {
  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Entry</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3 text-right">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row) => (
              <tr key={row.entry_id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-semibold text-gray-500">
                  {row.rank <= 3 ? (
                    <span>{row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : '🥉'}</span>
                  ) : (
                    `#${row.rank}`
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{row.entry_name}</td>
                <td className="px-4 py-3 text-gray-500">{maskEmail(row.user_email)}</td>
                <td className="px-4 py-3 text-right font-bold text-blue-600">{row.total_points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link
              href={`/leaderboard?page=${currentPage - 1}`}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              ← Previous
            </Link>
          )}
          <span className="text-sm text-gray-500">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              href={`/leaderboard?page=${currentPage + 1}`}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
