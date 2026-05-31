import Link from 'next/link'
import { getSessionEmail } from '@/lib/session'
import { isAdmin } from '@/lib/auth/isAdmin'
import { signOut } from '@/actions/auth'
import { getT } from '@/lib/i18n/server'
import { LanguageToggle } from '@/components/LanguageToggle'

export async function Nav() {
  const email = await getSessionEmail()
  const adminUser = await isAdmin(email)
  const { t } = await getT()

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
            {t('nav.leaderboard')}
          </Link>
          <Link
            href="/rules"
            className="text-sm text-slate-400 transition hover:text-amber-400"
          >
            {t('nav.rules')}
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-slate-400 transition hover:text-slate-100"
          >
            {t('nav.myEntries')}
          </Link>
          {adminUser && (
            <Link
              href="/admin"
              className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-sm font-medium text-amber-400 transition hover:bg-amber-500/30 hover:text-amber-300"
            >
              {t('nav.admin')}
            </Link>
          )}
          <LanguageToggle />
          {email && (
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-slate-700 hover:text-slate-100"
              >
                {t('nav.signOut')}
              </button>
            </form>
          )}
        </div>
      </div>
    </nav>
  )
}
