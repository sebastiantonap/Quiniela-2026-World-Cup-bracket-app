'use client'

import { useMemo } from 'react'
import { KnockoutMatchCard } from './KnockoutMatchCard'
import { RoundStatusBadge } from '@/components/ui/Badge'
import { useT } from '@/lib/i18n/I18nProvider'
import { roundLabel } from '@/lib/i18n/translator'
import { parseSlotPlaceholder } from '@/lib/standings/knockoutSlots'
import type { KnockoutEligibility } from '@/lib/scoring/knockoutEligibility'
import type { MatchWithTeams, Prediction, Round, RoundName } from '@/types/app'
import type { PredictedMatch } from '@/lib/bracket/resolveUserBracket'

/* ---------- constants ---------- */

/** Main bracket rounds (left-to-right columns). Third place handled separately. */
const BRACKET_ROUNDS: RoundName[] = [
  'round_of_32',
  'round_of_16',
  'quarterfinals',
  'semifinals',
  'final',
]

/** All knockout rounds including third place (for mobile stacked view). */
const ALL_KNOCKOUT_ROUNDS: RoundName[] = [
  'round_of_32',
  'round_of_16',
  'quarterfinals',
  'semifinals',
  'third_place',
  'final',
]

/** Card height (px) including padding/border — desktop bracket. */
const CARD_H = 140
/** Minimum gap (px) between cards in the first (densest) round. */
const BASE_GAP = 10

/* ---------- bracket topology ---------- */

interface BracketNode {
  match: MatchWithTeams
  roundName: RoundName
  slotIndex: number
}

/**
 * Build the ordered list of matches per bracket column by following the
 * placeholder references to pair feeder matches.
 */
function buildBracketOrder(
  matchesByRound: Record<RoundName, MatchWithTeams[]>,
): Map<RoundName, BracketNode[]> {
  const result = new Map<RoundName, BracketNode[]>()

  const byNumber = new Map<number, MatchWithTeams>()
  for (const matches of Object.values(matchesByRound)) {
    for (const m of matches) byNumber.set(m.match_number, m)
  }
  const qfMatches = (matchesByRound['quarterfinals'] ?? []).slice().sort((a, b) => a.match_number - b.match_number)
  const sfMatches = (matchesByRound['semifinals'] ?? []).slice().sort((a, b) => a.match_number - b.match_number)

  function feederMatchId(placeholder: string | null): string | null {
    const src = parseSlotPlaceholder(placeholder)
    if (src.type === 'match_winner') return byNumber.get(src.matchNumber)?.id ?? null
    if (src.type === 'round_rel') {
      const list = src.round === 'QF' ? qfMatches : sfMatches
      return list[src.index - 1]?.id ?? null
    }
    return null
  }

  const firstRound = BRACKET_ROUNDS[0]
  const firstMatches = (matchesByRound[firstRound] ?? []).slice().sort((a, b) => a.match_number - b.match_number)
  result.set(firstRound, firstMatches.map((m, i) => ({ match: m, roundName: firstRound, slotIndex: i })))

  for (let ri = 1; ri < BRACKET_ROUNDS.length; ri++) {
    const roundName = BRACKET_ROUNDS[ri]
    const matches = (matchesByRound[roundName] ?? []).slice()
    if (matches.length === 0) { result.set(roundName, []); continue }

    const prevNodes = result.get(BRACKET_ROUNDS[ri - 1]) ?? []
    const prevIdToIndex = new Map<string, number>()
    for (const node of prevNodes) prevIdToIndex.set(node.match.id, node.slotIndex)

    const withFeederIndex = matches.map((m) => {
      const homeFeeder = feederMatchId(m.placeholder_home)
      const awayFeeder = feederMatchId(m.placeholder_away)
      const homeIdx = homeFeeder ? prevIdToIndex.get(homeFeeder) : undefined
      const awayIdx = awayFeeder ? prevIdToIndex.get(awayFeeder) : undefined
      const minIdx = Math.min(homeIdx ?? Infinity, awayIdx ?? Infinity)
      return { match: m, sortKey: minIdx === Infinity ? m.match_number : minIdx }
    })
    withFeederIndex.sort((a, b) => a.sortKey - b.sortKey)

    result.set(roundName, withFeederIndex.map((item, i) => ({
      match: item.match, roundName, slotIndex: i,
    })))
  }

  return result
}

/* ---------- props ---------- */

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

/* ---------- shared card renderer ---------- */

function MatchCardWrapper({
  match, predictions, isEditable, onUpdate, saving, eligibility, predictedSlots, compact,
}: {
  match: MatchWithTeams
  predictions: Record<string, Prediction>
  isEditable: boolean
  onUpdate: (matchId: string, home: number | null, away: number | null, winnerId: string | null, homePens: number | null, awayPens: number | null) => void
  saving: Record<string, boolean>
  eligibility: Record<string, KnockoutEligibility>
  predictedSlots: Record<string, PredictedMatch>
  compact?: boolean
}) {
  return (
    <KnockoutMatchCard
      match={match}
      prediction={predictions[match.id]}
      isEditable={isEditable}
      onUpdate={(home, away, winnerId, homePens, awayPens) =>
        onUpdate(match.id, home, away, winnerId, homePens, awayPens)
      }
      saving={saving[match.id]}
      eligibility={eligibility[match.id]}
      predictedSlot={predictedSlots[match.id]}
      compact={compact}
    />
  )
}

/* ---------- component ---------- */

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

  const bracketOrder = useMemo(() => buildBracketOrder(matchesByRound), [matchesByRound])

  const firstRoundWithMatches = BRACKET_ROUNDS.find((r) => (matchesByRound[r] ?? []).length > 0)
  const baseMatchCount = firstRoundWithMatches ? (matchesByRound[firstRoundWithMatches] ?? []).length : 0
  const totalHeight = baseMatchCount * CARD_H + (baseMatchCount - 1) * BASE_GAP
  const activeBracketRounds = BRACKET_ROUNDS.filter((r) => (matchesByRound[r] ?? []).length > 0)
  const COL_WIDTH = 220

  // Third place
  const thirdPlaceMatches = matchesByRound['third_place'] ?? []
  const thirdPlaceEditable = isEditableRound('third_place')
  const thirdPlaceRound = roundMap['third_place']
  const thirdPlaceHidden = readOnly && revealedRounds && !revealedRounds.has('third_place')

  return (
    <div>
      {/* ==================== DESKTOP: horizontal bracket ==================== */}
      <div className="hidden md:block">
        <div className="overflow-x-auto pb-4">
          <div
            className="relative flex"
            style={{ minHeight: totalHeight, minWidth: activeBracketRounds.length * (COL_WIDTH + 48) }}
          >
            {activeBracketRounds.map((roundName, colIndex) => {
              const nodes = bracketOrder.get(roundName) ?? []
              const roundData = roundMap[roundName]
              const editable = isEditableRound(roundName)
              const isHidden = readOnly && revealedRounds && !revealedRounds.has(roundName)
              const roundMatchCount = nodes.length
              if (roundMatchCount === 0) return null

              const slotsPerMatch = baseMatchCount > 0 ? baseMatchCount / roundMatchCount : 1
              const matchSpacing = slotsPerMatch * (CARD_H + BASE_GAP) - BASE_GAP
              const topOffset = (matchSpacing - CARD_H) / 2

              return (
                <div
                  key={roundName}
                  className="relative flex-shrink-0"
                  style={{ width: COL_WIDTH, marginRight: 48 }}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {roundLabel(t, roundName)}
                    </h3>
                    {roundData && <RoundStatusBadge status={roundData.status} />}
                  </div>

                  <div className="relative" style={{ height: totalHeight }}>
                    {isHidden ? (
                      <div
                        className="absolute left-0 right-0 rounded-xl border border-slate-700 bg-slate-800 px-3 py-4 text-center text-xs text-slate-400"
                        style={{ top: topOffset }}
                      >
                        {t('bracket.hiddenUntilLocked')}
                      </div>
                    ) : (
                      nodes.map((node) => {
                        const yPos = node.slotIndex * (matchSpacing + BASE_GAP) + topOffset
                        return (
                          <div
                            key={node.match.id}
                            className="absolute left-0 right-0"
                            style={{ top: yPos, height: CARD_H }}
                          >
                            <MatchCardWrapper
                              match={node.match}
                              predictions={predictions}
                              isEditable={editable}
                              onUpdate={onUpdate}
                              saving={saving}
                              eligibility={eligibility}
                              predictedSlots={predictedSlots}
                              compact
                            />
                          </div>
                        )
                      })
                    )}

                    {/* Connector lines */}
                    {colIndex < activeBracketRounds.length - 1 && !isHidden && (
                      <svg
                        className="absolute pointer-events-none"
                        style={{ left: COL_WIDTH, top: 0, width: 48, height: totalHeight }}
                      >
                        {nodes.map((node, i) => {
                          if (i % 2 !== 0) return null
                          const nextNode = nodes[i + 1]
                          if (!nextNode) return null

                          const y1 = node.slotIndex * (matchSpacing + BASE_GAP) + topOffset + CARD_H / 2
                          const y2 = nextNode.slotIndex * (matchSpacing + BASE_GAP) + topOffset + CARD_H / 2
                          const midY = (y1 + y2) / 2

                          return (
                            <g key={node.match.id}>
                              <line x1={0} y1={y1} x2={16} y2={y1} stroke="#475569" strokeWidth={1.5} />
                              <line x1={16} y1={y1} x2={16} y2={y2} stroke="#475569" strokeWidth={1.5} />
                              <line x1={0} y1={y2} x2={16} y2={y2} stroke="#475569" strokeWidth={1.5} />
                              <line x1={16} y1={midY} x2={48} y2={midY} stroke="#475569" strokeWidth={1.5} />
                            </g>
                          )
                        })}
                      </svg>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Third place — desktop */}
        {thirdPlaceMatches.length > 0 && (
          <div className="border-t border-slate-700 pt-6">
            <div className="mb-3 flex items-center gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                {roundLabel(t, 'third_place')}
              </h3>
              {thirdPlaceRound && <RoundStatusBadge status={thirdPlaceRound.status} />}
            </div>
            {thirdPlaceHidden ? (
              <div className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-6 text-center text-sm text-slate-400">
                {t('bracket.hiddenUntilLocked')}
              </div>
            ) : (
              <div className="max-w-xs">
                {thirdPlaceMatches.map((match) => (
                  <MatchCardWrapper
                    key={match.id}
                    match={match}
                    predictions={predictions}
                    isEditable={thirdPlaceEditable}
                    onUpdate={onUpdate}
                    saving={saving}
                    eligibility={eligibility}
                    predictedSlots={predictedSlots}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== MOBILE: stacked rounds ==================== */}
      <div className="md:hidden space-y-6">
        {ALL_KNOCKOUT_ROUNDS.map((roundName) => {
          const matches = matchesByRound[roundName] ?? []
          if (matches.length === 0) return null
          const editable = isEditableRound(roundName)
          const roundData = roundMap[roundName]
          const isHidden = readOnly && revealedRounds && !revealedRounds.has(roundName)

          // Use bracket ordering for main rounds, match_number for third_place
          const orderedMatches = roundName === 'third_place'
            ? matches.slice().sort((a, b) => a.match_number - b.match_number)
            : (bracketOrder.get(roundName) ?? []).map((n) => n.match)

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
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                  {orderedMatches.map((match) => (
                    <MatchCardWrapper
                      key={match.id}
                      match={match}
                      predictions={predictions}
                      isEditable={editable}
                      onUpdate={onUpdate}
                      saving={saving}
                      eligibility={eligibility}
                      predictedSlots={predictedSlots}
                    />
                  ))}
                </div>
              )}
              {/* Flow indicator between rounds */}
              {roundName !== 'final' && roundName !== 'third_place' && (
                <div className="mt-3 flex justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" className="text-slate-500">
                    <path d="M12 4 L12 16 M7 12 L12 17 L17 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
