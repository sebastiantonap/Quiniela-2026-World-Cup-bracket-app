import type { MatchWithTeams, TeamStanding } from '@/types/app'
import { isStandingsTie } from './groupStandings'

/**
 * A knockout match slot ("home" / "away") carries a placeholder string that encodes which
 * earlier result feeds it. These are the shapes used in the seed:
 *   "1st Group A" / "2nd Group B"            → group finisher
 *   "Best 3rd #1".."Best 3rd #8"             → confirmed best-third teams
 *   "Winner M73"                             → winner of an absolute match number
 *   "Winner QF1" / "Winner SF2" / "Loser SF1"→ winner/loser of the Nth match in QF/SF round
 */
export type SlotSource =
  | { type: 'group'; position: 1 | 2; group: string }
  | { type: 'best_third'; rank: number }
  | { type: 'match_winner'; matchNumber: number }
  | { type: 'round_rel'; round: 'QF' | 'SF'; index: number; want: 'winner' | 'loser' }
  | { type: 'unknown' }

export interface ResolvedSlot {
  presetTeamId: string | null
  candidateTeamIds: string[]
  isTie: boolean
  ready: boolean
  note?: string
}

export interface SlotContext {
  /** group letter → standings sorted by Pts → GD → GF (computeGroupStandings) */
  groupStandings: Record<string, TeamStanding[]>
  /** the confirmed best-third teams, ranked (length 8 once confirmed) */
  bestThirds: TeamStanding[]
  /** absolute match_number → match */
  matchByNumber: Map<number, MatchWithTeams>
  /** quarterfinal matches sorted by match_number (QF1..QF4) */
  qfMatches: MatchWithTeams[]
  /** semifinal matches sorted by match_number (SF1..SF2) */
  sfMatches: MatchWithTeams[]
}

export function parseSlotPlaceholder(placeholder: string | null): SlotSource {
  if (!placeholder) return { type: 'unknown' }
  const p = placeholder.trim()

  let m = p.match(/^(1st|2nd)\s+Group\s+([A-L])$/i)
  if (m) return { type: 'group', position: m[1].toLowerCase() === '1st' ? 1 : 2, group: m[2].toUpperCase() }

  m = p.match(/^Best\s+3rd\s+#(\d+)$/i)
  if (m) return { type: 'best_third', rank: parseInt(m[1], 10) }

  m = p.match(/^Winner\s+M(\d+)$/i)
  if (m) return { type: 'match_winner', matchNumber: parseInt(m[1], 10) }

  m = p.match(/^(Winner|Loser)\s+(QF|SF)(\d+)$/i)
  if (m) {
    return {
      type: 'round_rel',
      round: m[2].toUpperCase() as 'QF' | 'SF',
      index: parseInt(m[3], 10),
      want: m[1].toLowerCase() === 'winner' ? 'winner' : 'loser',
    }
  }

  return { type: 'unknown' }
}

const EMPTY: ResolvedSlot = { presetTeamId: null, candidateTeamIds: [], isTie: false, ready: false }

/** Resolve a knockout match (won/lost) into a preset team + candidate participants. */
function resolveFromMatch(match: MatchWithTeams | undefined, want: 'winner' | 'loser', label: string): ResolvedSlot {
  if (!match) return { ...EMPTY, note: `${label} not found` }
  const participants = [match.home_team_id, match.away_team_id].filter(Boolean) as string[]
  if (!match.winner_team_id) {
    return { presetTeamId: null, candidateTeamIds: participants, isTie: false, ready: false, note: `${label} not decided` }
  }
  const winner = match.winner_team_id
  const loser = participants.find((id) => id !== winner) ?? null
  return {
    presetTeamId: want === 'winner' ? winner : loser,
    candidateTeamIds: participants,
    isTie: false,
    ready: true,
  }
}

export function resolveKnockoutSlot(source: SlotSource, ctx: SlotContext): ResolvedSlot {
  switch (source.type) {
    case 'group': {
      const standings = ctx.groupStandings[source.group] ?? []
      if (standings.length < 2) return { ...EMPTY, note: `Group ${source.group} standings incomplete` }
      const idx = source.position - 1
      const here = standings[idx]
      const candidateTeamIds = standings.map((s) => s.team.id)
      // A swap into this slot is possible only if it's fully tied with an adjacent finisher.
      const tieAbove = idx > 0 && isStandingsTie(here, standings[idx - 1])
      const tieBelow = idx < standings.length - 1 && isStandingsTie(here, standings[idx + 1])
      return {
        presetTeamId: here.team.id,
        candidateTeamIds,
        isTie: tieAbove || tieBelow,
        ready: true,
      }
    }

    case 'best_third': {
      const candidateTeamIds = ctx.bestThirds.map((s) => s.team.id)
      if (ctx.bestThirds.length < 8) {
        return { presetTeamId: null, candidateTeamIds, isTie: false, ready: false, note: 'Confirm 8 best thirds first' }
      }
      return {
        presetTeamId: ctx.bestThirds[source.rank - 1]?.team.id ?? null,
        candidateTeamIds,
        isTie: false,
        ready: true,
      }
    }

    case 'match_winner':
      return resolveFromMatch(ctx.matchByNumber.get(source.matchNumber), 'winner', `M${source.matchNumber}`)

    case 'round_rel': {
      const list = source.round === 'QF' ? ctx.qfMatches : ctx.sfMatches
      return resolveFromMatch(list[source.index - 1], source.want, `${source.round}${source.index}`)
    }

    default:
      return { ...EMPTY, note: 'Unrecognized slot' }
  }
}
