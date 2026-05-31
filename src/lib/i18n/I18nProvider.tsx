'use client'

import { createContext, useContext, useMemo } from 'react'
import type { Locale } from './config'
import { createTranslator, type TFunc } from './translator'

interface I18nValue {
  locale: Locale
  t: TFunc
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo<I18nValue>(() => ({ locale, t: createTranslator(locale) }), [locale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider')
  return ctx
}

/** Shorthand when you only need the translation function. */
export function useT(): TFunc {
  return useI18n().t
}
