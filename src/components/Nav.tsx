import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { signOut } from '@/actions/auth'

export async function Nav() {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-slate-100">
          <span className="text-xl">⚽</span>
          <span>Quiniela 2026</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/leaderboard"
            className="text-sm text-slate-400 transition hover:text-amber-400"
          >
            Leaderboard
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-slate-400 transition hover:text-slate-100"
          >
            My Entries
          </Link>
          {user && (
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700 hover:text-slate-100"
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
