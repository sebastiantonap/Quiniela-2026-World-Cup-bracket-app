import { Nav } from '@/components/Nav'
import { getLeaderboard } from '@/actions/leaderboard'
import { getSessionEmail } from '@/lib/session'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10))
  const pageSize = 50

  const [{ rows, total }, currentUserEmail] = await Promise.all([
    getLeaderboard(page, pageSize),
    getSessionEmail(),
  ])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Leaderboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            {total} bracket{total !== 1 ? 's' : ''} competing
          </p>
        </div>

        {/* Prize pool panel */}
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-400">
            Prize Distribution
          </h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-800 p-3">
              <div className="text-xl">🥇</div>
              <div className="mt-1 text-lg font-bold text-amber-400">75%</div>
              <div className="text-xs text-slate-400">1st place</div>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <div className="text-xl">🥈</div>
              <div className="mt-1 text-lg font-bold text-slate-300">20%</div>
              <div className="text-xs text-slate-400">2nd place</div>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <div className="text-xl">🥉</div>
              <div className="mt-1 text-lg font-bold text-amber-700">5%</div>
              <div className="text-xs text-slate-400">3rd place</div>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">Ties split pro-rata</p>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-800 p-12 text-center">
            <p className="text-slate-400">No entries yet. Be the first!</p>
          </div>
        ) : (
          <LeaderboardTable
            rows={rows}
            currentPage={page}
            totalPages={totalPages}
            currentUserEmail={currentUserEmail}
          />
        )}

        <div className="mt-6 text-center">
          <Link
            href="/dashboard"
            className="text-sm text-amber-400 transition hover:text-amber-300 hover:underline"
          >
            ← Back to my brackets
          </Link>
        </div>
      </main>
    </div>
  )
}
