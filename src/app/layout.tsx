import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { getLocale } from '@/lib/i18n/server'
import { I18nProvider } from '@/lib/i18n/I18nProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Quiniela 2026 | World Cup Bracket Challenge',
  description: 'Predict scores for every 2026 FIFA World Cup match and compete with friends.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()

  return (
    <html lang={locale} className="dark">
      <body className={`${inter.className} min-h-screen bg-slate-900 text-slate-100 antialiased`}>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  )
}
