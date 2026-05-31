import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { ROUND_POINTS, ROUND_LABELS, ROUND_ORDER } from '@/lib/constants/rounds'
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

export default function RulesPage() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100">Rules &amp; Scoring</h1>
          <p className="mt-1 text-sm text-slate-400">
            Exactly how points are awarded and how team selection works — your
            reference whenever a score looks surprising.
          </p>
        </div>

        {/* 1. Overview */}
        <Panel>
          <SectionHeading>How scoring works</SectionHeading>
          <p className="text-sm leading-relaxed text-slate-300">
            Your total is the sum of four things: your{' '}
            <span className="text-slate-100">match-score predictions</span> (every
            game, group stage through the final), your{' '}
            <span className="text-slate-100">group qualification picks</span> (who
            finishes 1st/2nd/3rd in each group), your{' '}
            <span className="text-slate-100">best-8 third-place picks</span>, and
            the bonuses for getting an{' '}
            <span className="text-slate-100">exact scoreline</span>. Knockout
            matches have an extra twist —{' '}
            <a href="#eligibility" className="text-amber-400 hover:underline">
              eligibility gating
            </a>{' '}
            — explained below.
          </p>
        </Panel>

        {/* 2. Group stage */}
        <Panel>
          <SectionHeading>Group-stage match scoring</SectionHeading>
          <p className="mb-4 text-sm leading-relaxed text-slate-300">
            For each group-stage game you predict the final score. You earn points
            for getting the <span className="text-slate-100">outcome</span> right
            (home win, draw, or away win), with a bonus for nailing the{' '}
            <span className="text-slate-100">exact scoreline</span>.
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-800 p-3">
              <div className="text-lg font-bold text-amber-400">{group.winner}</div>
              <div className="text-xs text-slate-400">Correct outcome</div>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <div className="text-lg font-bold text-slate-300">+{group.bonus}</div>
              <div className="text-xs text-slate-400">Exact score</div>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <div className="text-lg font-bold text-slate-100">
                {group.winner + group.bonus}
              </div>
              <div className="text-xs text-slate-400">Max per game</div>
            </div>
          </div>
        </Panel>

        {/* 3. Knockout match scoring */}
        <Panel>
          <SectionHeading>Knockout match scoring</SectionHeading>
          <p className="mb-4 text-sm leading-relaxed text-slate-300">
            Knockout points climb each round. You earn the{' '}
            <span className="text-slate-100">winner</span> value for picking the
            team that advances, plus the{' '}
            <span className="text-slate-100">exact-score</span> bonus on top.
          </p>
          <div className="overflow-hidden rounded-xl border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/60 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 text-left">Round</th>
                  <th className="px-3 py-2 text-center">Correct winner</th>
                  <th className="px-3 py-2 text-center">+ Exact score</th>
                  <th className="px-3 py-2 text-center">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {knockoutRounds.map((round) => {
                  const pts = ROUND_POINTS[round]
                  return (
                    <tr key={round}>
                      <td className="px-3 py-2 font-medium text-slate-200">
                        {ROUND_LABELS[round]}
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
          <SectionHeading>Group qualification picks</SectionHeading>
          <p className="mb-4 text-sm leading-relaxed text-slate-300">
            For every group you also pick who finishes{' '}
            <span className="text-slate-100">1st, 2nd, and 3rd</span>. You score the
            full value for an exact finish, and a consolation{' '}
            <span className="text-slate-100">1 point</span> if your team still
            qualified somewhere close.
          </p>
          <ul className="space-y-3 text-sm leading-relaxed text-slate-300">
            <li>
              <span className="font-medium text-slate-100">Your 1st-place pick:</span>{' '}
              <span className="text-amber-400">4 pts</span> if it finishes 1st · else{' '}
              <span className="text-amber-400">1 pt</span> if it finishes in the top 2
              or 3rd.
            </li>
            <li>
              <span className="font-medium text-slate-100">Your 2nd-place pick:</span>{' '}
              <span className="text-amber-400">3 pts</span> if it finishes 2nd · else{' '}
              <span className="text-amber-400">1 pt</span> if it finishes in the top 2
              or 3rd.
            </li>
            <li>
              <span className="font-medium text-slate-100">Your 3rd-place pick:</span>{' '}
              <span className="text-amber-400">2 pts</span> if it finishes 3rd · else{' '}
              <span className="text-amber-400">1 pt</span> if it finishes in the top 2.
            </li>
          </ul>
        </Panel>

        {/* 5. Best 8 third place */}
        <Panel>
          <SectionHeading>Best 8 third-place teams</SectionHeading>
          <p className="text-sm leading-relaxed text-slate-300">
            Twelve teams finish 3rd in their group, but only{' '}
            <span className="text-slate-100">8 advance</span> to the Round of 32. You
            pick which 8 you think make it. Each team you pick that actually advances
            is worth <span className="text-amber-400">1 point</span>. You must select
            exactly 8.
          </p>
        </Panel>

        {/* 6. Eligibility gating */}
        <Panel>
          <span id="eligibility" className="block -mt-24 pt-24" aria-hidden />
          <SectionHeading>Knockout eligibility — the important twist</SectionHeading>
          <p className="mb-4 text-sm leading-relaxed text-slate-300">
            In knockout rounds you only score a match if you correctly had its teams
            advancing that far. For each real-life matchup we look at the two teams
            actually playing and check how many of them{' '}
            <span className="text-slate-100">you correctly advanced</span> (&ldquo;own&rdquo;):
          </p>
          <div className="mb-4 space-y-3 text-sm leading-relaxed">
            <div className="rounded-xl border border-green-700/40 bg-green-900/15 p-3">
              <span className="font-semibold text-green-300">Both teams yours</span>
              <span className="text-slate-300">
                {' '}— full normal scoring: winner points plus the exact-score bonus.
              </span>
            </div>
            <div className="rounded-xl border border-amber-700/40 bg-amber-900/15 p-3">
              <span className="font-semibold text-amber-300">One team yours</span>
              <span className="text-slate-300">
                {' '}— you&rsquo;re forced to have your one team win. You earn the
                round&rsquo;s winner points <span className="text-slate-100">only if
                that team actually wins</span> — no exact-score bonus, and your own
                scoreline pick is ignored.
              </span>
            </div>
            <div className="rounded-xl border border-slate-600 bg-slate-800/60 p-3">
              <span className="font-semibold text-slate-300">Neither team yours</span>
              <span className="text-slate-400">
                {' '}— the match is void for you: 0 points possible.
              </span>
            </div>
          </div>
          <div className="rounded-xl bg-slate-800/60 p-3 text-sm leading-relaxed text-slate-400">
            <p className="mb-2">
              <span className="font-medium text-slate-200">Where &ldquo;owning&rdquo; a team comes from:</span>
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                <span className="text-slate-300">Round of 32:</span> the teams you
                predicted 1st/2nd in their group, plus your best-8 third-place picks.
              </li>
              <li>
                <span className="text-slate-300">Every round after:</span> the teams
                you picked to win their match in the previous round.
              </li>
            </ul>
            <p className="mt-3">
              <span className="font-medium text-slate-200">Example:</span> A
              quarterfinal is Brazil vs. France. You correctly advanced Brazil from
              the Round of 16 but had France knocked out. That&rsquo;s a{' '}
              <span className="text-amber-300">one-team-yours</span> match: you bank
              the quarterfinal winner points only if Brazil actually wins — your
              predicted score doesn&rsquo;t matter.
            </p>
          </div>
        </Panel>

        {/* 7. Selection mechanics & tiebreakers */}
        <Panel>
          <SectionHeading>Standings &amp; tiebreakers</SectionHeading>
          <p className="mb-3 text-sm leading-relaxed text-slate-300">
            Group standings and the best-third ranking are ordered by:
          </p>
          <ol className="mb-4 ml-4 list-decimal space-y-1 text-sm text-slate-300">
            <li>Points</li>
            <li>Goal difference</li>
            <li>Goals for</li>
          </ol>
          <p className="text-sm leading-relaxed text-slate-400">
            When teams are level on all three at a qualification boundary, the order
            can&rsquo;t be decided automatically — the admin resolves it using
            FIFA&rsquo;s further tiebreakers (head-to-head, fair play, drawing of
            lots). In the best-8 third-place picker, the clear top 8 lock
            automatically; only teams tied right at the 8th/9th boundary are left for
            you to choose between.
          </p>
        </Panel>

        <div className="mt-6 text-center">
          <Link
            href="/dashboard"
            className="text-sm text-amber-400 transition hover:text-amber-300 hover:underline"
          >
            ← Back to my brackets
          </Link>
        </div>
      </main>
    </div>
  )
}
