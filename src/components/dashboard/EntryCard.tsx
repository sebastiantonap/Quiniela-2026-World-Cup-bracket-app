import Link from 'next/link'
import type { Entry } from '@/types/app'
import { getT } from '@/lib/i18n/server'

export async function EntryCard({ entry }: { entry: Entry }) {
  const { locale, t } = await getT()
  const createdDate = new Date(entry.created_at).toLocaleDateString(
    locale === 'es' ? 'es-ES' : 'en-US'
  )

  return (
    <Link
      href={`/entries/${entry.id}`}
      className="group flex flex-col rounded-2xl border border-slate-700 bg-slate-800 p-6 transition hover:border-amber-500/50 hover:bg-slate-700"
    >
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-slate-100 group-hover:text-amber-400 transition">
          {entry.name}
        </h3>
        <span className="ml-2 flex-shrink-0 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-sm font-bold text-amber-400">
          {entry.total_points} {t('common.pts')}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {t('entryCard.created', { date: createdDate })}
      </p>
      <p className="mt-4 text-sm font-medium text-slate-400 group-hover:text-amber-400 transition">
        {t('entryCard.viewBracket')}
      </p>
    </Link>
  )
}
