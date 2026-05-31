import { getSessionEmail } from '@/lib/session'
import { getEntries } from '@/actions/entries'
import { Nav } from '@/components/Nav'
import { CreateEntryButton } from '@/components/dashboard/CreateEntryButton'
import { EntryCard } from '@/components/dashboard/EntryCard'
import { getT } from '@/lib/i18n/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const email = await getSessionEmail()
  const entries = await getEntries()
  const { t } = await getT()

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{t('common.myBrackets')}</h1>
            <p className="mt-1 text-sm text-slate-400">{email}</p>
          </div>
          {entries.length < 2 && <CreateEntryButton />}
        </div>

        {entries.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-700 p-12 text-center">
            <div className="mb-3 text-4xl">📋</div>
            <h3 className="font-semibold text-slate-100">{t('dashboard.noBracketsTitle')}</h3>
            <p className="mt-1 text-sm text-slate-400">
              {t('dashboard.noBracketsDesc')}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {entries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} />
              ))}
            </div>
            {entries.length >= 2 && (
              <p className="mt-4 text-center text-sm text-slate-500">
                {t('dashboard.maxReached')}
              </p>
            )}
          </>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/leaderboard"
            className="text-sm text-amber-400 transition hover:text-amber-300 hover:underline"
          >
            {t('dashboard.viewLeaderboard')}
          </Link>
        </div>
      </main>
    </div>
  )
}
