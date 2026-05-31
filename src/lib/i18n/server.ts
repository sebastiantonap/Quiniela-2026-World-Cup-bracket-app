import { cookies } from 'next/headers'
import { LOCALE_COOKIE, DEFAULT_LOCALE, isLocale, type Locale } from './config'
import { createTranslator, type TFunc } from './translator'

/** Read the active locale from the cookie (server components / actions). */
export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  const value = store.get(LOCALE_COOKIE)?.value
  return isLocale(value) ? value : DEFAULT_LOCALE
}

/** Convenience for server components: the active locale plus a translation function. */
export async function getT(): Promise<{ locale: Locale; t: TFunc }> {
  const locale = await getLocale()
  return { locale, t: createTranslator(locale) }
}
