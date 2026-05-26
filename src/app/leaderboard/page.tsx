import { Nav } from '@/components/Nav'
import { getLeaderboard } from '@/actions/leaderboard'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'

export const revalidate = 60

interface PageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10))
  const pageSize = 25

  const { rows, total } = await getLeaderboard(page, pageSize)
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Leaderboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            {total} bracket{total !== 1 ? 's' : ''} competing
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
            <p className="text-gray-500">No entries yet. Be the first!</p>
          </div>
        ) : (
          <LeaderboardTable rows={rows} currentPage={page} totalPages={totalPages} />
        )}
      </main>
    </div>
  )
}
