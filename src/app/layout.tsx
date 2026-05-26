import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Quiniela 2026 | World Cup Bracket Challenge',
  description: 'Predict scores for every 2026 FIFA World Cup match and compete with friends.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-slate-900 text-slate-100 antialiased`}>
        {children}
      </body>
    </html>
  )
}
