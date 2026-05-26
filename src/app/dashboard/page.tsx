import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getEntries } from '@/actions/entries'
import { Nav } from '@/components/Nav'
import { CreateEntryButton } from '@/components/dashboard/CreateEntryButton'
import { EntryCard } from '@/components/dashboard/EntryCard'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const entries = await getEntries()

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Brackets</h1>
            <p className="mt-1 text-sm text-gray-500">{user?.email}</p>
          </div>
          <CreateEntryButton />
        </div>

        {entries.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
            <div className="mb-3 text-4xl">📋</div>
            <h3 className="font-semibold text-gray-900">No brackets yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Create your first bracket to start predicting matches.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link href="/leaderboard" className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
            View leaderboard →
          </Link>
        </div>
      </main>
    </div>
  )
}
