'use server'

import { cookies } from 'next/headers'
import { LOCALE_COOKIE, isLocale } from '@/lib/i18n/config'

/** Persist the chosen language in a cookie. The caller refreshes to re-render. */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return
  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
}
