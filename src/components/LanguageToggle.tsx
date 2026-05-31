'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/I18nProvider'
import { setLocale } from '@/actions/locale'
import { LOCALES, type Locale } from '@/lib/i18n/config'

export function LanguageToggle() {
  const { locale } = useI18n()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function choose(next: Locale) {
    if (next === locale) return
    startTransition(async () => {
      await setLocale(next)
      router.refresh()
    })
  }

  return (
    <div
      className="flex items-center rounded-lg border border-slate-700 bg-slate-800 p-0.5 text-xs font-semibold"
      aria-busy={isPending}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          aria-pressed={locale === l}
          className={`rounded-md px-2 py-1 uppercase transition ${
            locale === l
              ? 'bg-slate-700 text-amber-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
