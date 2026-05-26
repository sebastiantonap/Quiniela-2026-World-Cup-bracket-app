import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { signOut } from '@/actions/auth'

export async function Nav() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-gray-900">
          <span className="text-xl">⚽</span>
          <span>Quiniela 2026</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link href="/leaderboard" className="text-sm text-gray-600 hover:text-gray-900">
            Leaderboard
          </Link>
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
            My Entries
          </Link>
          {user && (
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Sign out
              </button>
            </form>
          )}
        </div>
      </div>
    </nav>
  )
}
