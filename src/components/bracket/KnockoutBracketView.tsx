'use client'

import { KnockoutMatchCard } from './KnockoutMatchCard'
import { RoundStatusBadge } from '@/components/ui/Badge'
import { useT } from '@/lib/i18n/I18nProvider'
import { roundLabel } from '@/lib/i18n/translator'
import type { KnockoutEligibility } from '@/lib/scoring/knockoutEligibility'
import type { MatchWithTeams, Prediction, Round, RoundName } from '@/types/app'
import type { PredictedMatch } from '@/lib/bracket/resolveUserBracket'

const KNOCKOUT_ROUNDS: RoundName[] = [
  'round_of_32',
  'round_of_16',
  'quarterfinals',
  'semifinals',
  'third_place',
  'final',
]

interface KnockoutBracketViewProps {
  matchesByRound: Record<RoundName, MatchWithTeams[]>
  predictions: Record<string, Prediction>
  predictedSlots: Record<string, PredictedMatch>
  isEditableRound: (round: RoundName) => boolean
  onUpdate: (matchId: string, home: number | null, away: number | null, winnerId: string | null, homePens: number | null, awayPens: number | null) => void
  saving: Record<string, boolean>
  eligibility: Record<string, KnockoutEligibility>
  roundMap: Record<string, Round>
  readOnly?: boolean
  revealedRounds?: Set<RoundName>
}

export function KnockoutBracketView({
  matchesByRound,
  predictions,
  predictedSlots,
  isEditableRound,
  onUpdate,
  saving,
  eligibility,
  roundMap,
  readOnly = false,
  revealedRounds,
}: KnockoutBracketViewProps) {
  const t = useT()

  return (
    <div className="space-y-8">
      {KNOCKOUT_ROUNDS.map((roundName) => {
        const matches = matchesByRound[roundName] ?? []
        if (matches.length === 0) return null
        const editable = isEditableRound(roundName)
        const roundData = roundMap[roundName]
        const isHidden = readOnly && revealedRounds && !revealedRounds.has(roundName)

        return (
          <section key={roundName}>
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                {roundLabel(t, roundName)}
              </h3>
              {roundData && <RoundStatusBadge status={roundData.status} />}
            </div>
            {isHidden ? (
              <div className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-6 text-center text-sm text-slate-400">
                {t('bracket.hiddenUntilLocked')}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {matches.map((match) => (
                  <KnockoutMatchCard
                    key={match.id}
                    match={match}
                    prediction={predictions[match.id]}
                    isEditable={editable}
                    onUpdate={(home, away, winnerId, homePens, awayPens) =>
                      onUpdate(match.id, home, away, winnerId, homePens, awayPens)
                    }
                    saving={saving[match.id]}
                    eligibility={eligibility[match.id]}
                    predictedSlot={predictedSlots[match.id]}
                  />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
