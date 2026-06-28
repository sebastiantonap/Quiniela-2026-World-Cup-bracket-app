import type { RoundName } from '@/types/app'

export type KnockoutMatchStatus = 'full' | 'partial' | 'void'

export interface KnockoutEligibility {
  homeEligible: boolean
  awayEligible: boolean
  status: KnockoutMatchStatus
  /** The single eligible team when status === 'partial' — the user is forced to have it win. */
  forcedWinnerTeamId: string | null
}

/**
 * Maps each knockout round to the round whose winner picks decide eligibility for it.
 * round_of_32 is omitted — its eligibility comes from the group-stage picks set.
 * `final` keys off the SF (SF winners go to the Final).
 * `third_place` keys off the QF (SF losers = QF winners who lost in the SF).
 */
export const PREV_ELIGIBILITY_ROUND: Partial<Record<RoundName, RoundName>> = {
  round_of_16: 'round_of_32',
  quarterfinals: 'round_of_16',
  semifinals: 'quarterfinals',
  third_place: 'quarterfinals',
  final: 'semifinals',
}

/**
 * Classify a knockout matchup by how many of its two actual teams the entry "owns":
 * - both eligible → 'full' (normal scoring)
 * - exactly one  → 'partial' (forced winner = the eligible team; advance points only)
 * - neither      → 'void' (no points possible)
 *
 * Unfilled slots (null team id) count as not eligible.
 */
export function classifyKnockoutMatch(
  homeTeamId: string | null,
  awayTeamId: string | null,
  isEligible: (teamId: string) => boolean,
): KnockoutEligibility {
  const homeEligible = homeTeamId !== null && isEligible(homeTeamId)
  const awayEligible = awayTeamId !== null && isEligible(awayTeamId)

  if (homeEligible && awayEligible) {
    return { homeEligible, awayEligible, status: 'full', forcedWinnerTeamId: null }
  }
  if (!homeEligible && !awayEligible) {
    return { homeEligible, awayEligible, status: 'void', forcedWinnerTeamId: null }
  }
  return {
    homeEligible,
    awayEligible,
    status: 'partial',
    forcedWinnerTeamId: homeEligible ? homeTeamId : awayTeamId,
  }
}
