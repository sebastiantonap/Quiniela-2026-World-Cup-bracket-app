import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { ROUND_POINTS, ROUND_ORDER } from '@/lib/constants/rounds'
import { getT } from '@/lib/i18n/server'
import { roundLabel } from '@/lib/i18n/translator'
import type { RoundName } from '@/types/app'

export const metadata = {
  title: 'Rules · Quiniela 2026',
}

// Nav reads the session cookie, so render per-request (no static caching of the signed-out nav).
export const dynamic = 'force-dynamic'

const group = ROUND_POINTS.group_stage
const knockoutRounds = ROUND_ORDER.filter(
  (r): r is RoundName => r !== 'group_stage'
)

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-400">
      {children}
    </h2>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      {children}
    </section>
  )
}

export default async function RulesPage() {
  const { t } = await getT()

  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">{t('rules.title')}</h1>
          <p className="mt-1 text-sm text-slate-400">{t('rules.subtitle')}</p>
        </div>

        {/* 1. Overview */}
        <Panel>
          <SectionHeading>{t('rules.overview.heading')}</SectionHeading>
          <p className="text-sm leading-relaxed text-slate-300">{t('rules.overview.body')}</p>
        </Panel>

        {/* 2. Group stage */}
        <Panel>
          <SectionHeading>{t('rules.group.heading')}</SectionHeading>
          <p className="mb-4 text-sm leading-relaxed text-slate-300">{t('rules.group.body')}</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-800 p-3">
              <div className="text-lg font-bold text-amber-400">{group.winner}</div>
              <div className="text-xs text-slate-400">{t('rules.group.correctOutcome')}</div>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <div className="text-lg font-bold text-slate-300">+{group.bonus}</div>
              <div className="text-xs text-slate-400">{t('rules.group.exactScore')}</div>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <div className="text-lg font-bold text-slate-100">
                {group.winner + group.bonus}
              </div>
              <div className="text-xs text-slate-400">{t('rules.group.maxPerGame')}</div>
            </div>
          </div>
        </Panel>

        {/* 3. Knockout match scoring */}
        <Panel>
          <SectionHeading>{t('rules.knockout.heading')}</SectionHeading>
          <p className="mb-4 text-sm leading-relaxed text-slate-300">{t('rules.knockout.body')}</p>
          <div className="overflow-hidden rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/60 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 text-left">{t('rules.knockout.col.round')}</th>
                  <th className="px-3 py-2 text-center">{t('rules.knockout.col.correctWinner')}</th>
                  <th className="px-3 py-2 text-center">{t('rules.knockout.col.exactScore')}</th>
                  <th className="px-3 py-2 text-center">{t('rules.knockout.col.max')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {knockoutRounds.map((round) => {
                  const pts = ROUND_POINTS[round]
                  return (
                    <tr key={round}>
                      <td className="px-3 py-2 font-medium text-slate-200">
                        {roundLabel(t, round)}
                      </td>
                      <td className="px-3 py-2 text-center text-slate-300">
                        {pts.winner}
                      </td>
                      <td className="px-3 py-2 text-center text-slate-400">
                        +{pts.bonus}
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-slate-100">
                        {pts.winner + pts.bonus}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* 4. Group qualification picks */}
        <Panel>
          <SectionHeading>{t('rules.qual.heading')}</SectionHeading>
          <p className="mb-4 text-sm leading-relaxed text-slate-300">{t('rules.qual.body')}</p>
          <ul className="space-y-3 text-sm leading-relaxed text-slate-300">
            <li>
              <span className="font-medium text-slate-100">{t('rules.qual.firstLabel')}</span>{' '}
              {t('rules.qual.firstDesc')}
            </li>
            <li>
              <span className="font-medium text-slate-100">{t('rules.qual.secondLabel')}</span>{' '}
              {t('rules.qual.secondDesc')}
            </li>
            <li>
              <span className="font-medium text-slate-100">{t('rules.qual.thirdLabel')}</span>{' '}
              {t('rules.qual.thirdDesc')}
            </li>
          </ul>
        </Panel>

        {/* 5. Best 8 third place */}
        <Panel>
          <SectionHeading>{t('rules.best.heading')}</SectionHeading>
          <p className="text-sm leading-relaxed text-slate-300">{t('rules.best.body')}</p>
        </Panel>

        {/* 6. Eligibility gating */}
        <Panel>
          <SectionHeading>{t('rules.elig.heading')}</SectionHeading>
          <p className="mb-4 text-sm leading-relaxed text-slate-300">{t('rules.elig.body')}</p>
          <div className="mb-4 space-y-3 text-sm leading-relaxed">
            <div className="rounded-xl border border-green-700/40 bg-green-900/15 p-3">
              <span className="font-semibold text-green-300">{t('rules.elig.bothLabel')}</span>
              <span className="text-slate-300"> {t('rules.elig.bothDesc')}</span>
            </div>
            <div className="rounded-xl border border-amber-700/40 bg-amber-900/15 p-3">
              <span className="font-semibold text-amber-300">{t('rules.elig.oneLabel')}</span>
              <span className="text-slate-300"> {t('rules.elig.oneDesc')}</span>
            </div>
            <div className="rounded-xl border border-slate-600 bg-slate-800/60 p-3">
              <span className="font-semibold text-slate-300">{t('rules.elig.neitherLabel')}</span>
              <span className="text-slate-400"> {t('rules.elig.neitherDesc')}</span>
            </div>
          </div>
          <div className="rounded-xl bg-slate-800/60 p-3 text-sm leading-relaxed text-slate-400">
            <p className="mb-2">
              <span className="font-medium text-slate-200">{t('rules.elig.owningTitle')}</span>
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                <span className="text-slate-300">{t('rules.elig.owningR32Label')}</span>{' '}
                {t('rules.elig.owningR32Desc')}
              </li>
              <li>
                <span className="text-slate-300">{t('rules.elig.owningAfterLabel')}</span>{' '}
                {t('rules.elig.owningAfterDesc')}
              </li>
            </ul>
            <p className="mt-3">
              <span className="font-medium text-slate-200">{t('rules.elig.exampleLabel')}</span>{' '}
              {t('rules.elig.exampleBody')}
            </p>
          </div>
        </Panel>

        {/* 7. Selection mechanics & tiebreakers */}
        <Panel>
          <SectionHeading>{t('rules.tiebreak.heading')}</SectionHeading>
          <p className="mb-3 text-sm leading-relaxed text-slate-300">{t('rules.tiebreak.intro')}</p>
          <ol className="mb-4 ml-4 list-decimal space-y-1 text-sm text-slate-300">
            <li>{t('rules.tiebreak.points')}</li>
            <li>{t('rules.tiebreak.gd')}</li>
            <li>{t('rules.tiebreak.gf')}</li>
          </ol>
          <p className="text-sm leading-relaxed text-slate-400">{t('rules.tiebreak.body')}</p>
        </Panel>

        <div className="mt-6 text-center">
          <Link
            href="/dashboard"
            className="text-sm text-amber-400 transition hover:text-amber-300 hover:underline"
          >
            {t('common.backToBrackets')}
          </Link>
        </div>
      </main>
    </div>
  )
}
