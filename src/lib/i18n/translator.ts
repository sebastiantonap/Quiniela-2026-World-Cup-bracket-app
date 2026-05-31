import type { Locale } from './config'
import { en, type TranslationKey } from './dictionaries/en'
import { es } from './dictionaries/es'
import type { RoundName } from '@/types/app'

const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = { en, es }

export type TFunc = (key: TranslationKey, params?: Record<string, string | number>) => string

/** Build a translation function for a locale. Falls back to English, then the raw key. */
export function createTranslator(locale: Locale): TFunc {
  const dict = DICTIONARIES[locale] ?? en
  return (key, params) => {
    let str = dict[key] ?? en[key] ?? key
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value))
      }
    }
    return str
  }
}

/** Localized round name, e.g. roundLabel(t, 'round_of_16'). */
export function roundLabel(t: TFunc, name: RoundName): string {
  return t(`round.${name}` as TranslationKey)
}
