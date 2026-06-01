import type { MatchWithTeams, Team, TeamStanding } from '@/types/app'
import { computeGroupStandings, isStandingsTie } from './groupStandings'
import { GROUP_LETTERS } from '@/lib/constants/rounds'
import { THIRD_PLACE_MATRIX } from '@/lib/bracket/thirdPlaceMatrix'

/**
 * A knockout match slot ("home" / "away") carries a placeholder string that encodes which
 * earlier result feeds it. These are the shapes used in the seed:
 *   "1st Group A" / "2nd Group B"            → group finisher
 *   "Best 3rd (A/B/C/D/F)"                   → a best-third team from one of the allowed groups
 *   "Winner M73"                             → winner of an absolute match number
 *   "Winner QF1" / "Winner SF2" / "Loser SF1"→ winner/loser of the Nth match in QF/SF round
 */
export type SlotSource =
  | { type: 'group'; position: 1 | 2; group: string }
  | { type: 'best_third'; allowedGroups: string[] }
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
  /** true when every group-stage match for that group is result_confirmed */
  groupStandingsComplete: Record<string, boolean>
  /** the confirmed best-third teams, ranked (length 8 once confirmed) */
  bestThirds: TeamStanding[]
  /** third-placed team id → its group letter (for best-3rd group constraints) */
  bestThirdGroups: Map<string, string>
  /** sorted 8-letter key e.g. "ABCDFHIK", or null if fewer than 8 thirds confirmed */
  bestThirdScenarioKey: string | null
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

  m = p.match(/^Best\s+3rd\s+\(([A-L/\s]+)\)$/i)
  if (m) {
    const allowedGroups = m[1].split('/').map((g) => g.trim().toUpperCase()).filter(Boolean)
    return { type: 'best_third', allowedGroups }
  }

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

/**
 * Build the resolution context from the admin's full match + team lists.
 * Shared by the slot filler and the results-entry view.
 */
export function buildSlotContext(matches: MatchWithTeams[], teams: Team[]): SlotContext {
  const groupStageMatches = matches.filter((m) => m.round?.name === 'group_stage')

  const groupStandings: Record<string, TeamStanding[]> = {}
  const groupStandingsComplete: Record<string, boolean> = {}
  const thirds: TeamStanding[] = []
  const bestThirdGroups = new Map<string, string>()
  for (const letter of GROUP_LETTERS) {
    const groupTeams = teams.filter(
      (t) =>
        t.group_id &&
        groupStageMatches.some(
          (m) => m.group?.name === letter && (m.home_team_id === t.id || m.away_team_id === t.id)
        )
    )
    if (groupTeams.length === 0) continue
    const groupMatches = groupStageMatches.filter((m) => m.group?.name === letter)
    const standings = computeGroupStandings(groupTeams, groupMatches)
    groupStandings[letter] = standings
    groupStandingsComplete[letter] = groupMatches.length > 0 && groupMatches.every((m) => m.result_confirmed)
    if (standings[2]) {
      thirds.push(standings[2])
      bestThirdGroups.set(standings[2].team.id, letter)
    }
  }

  const bestThirds = thirds
    .filter((s) => s.team.best_third_qualified)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference
      if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for
      return a.team.name.localeCompare(b.team.name)
    })

  const qualifiedGroups = bestThirds
    .map((s) => bestThirdGroups.get(s.team.id))
    .filter((g): g is string => !!g)
    .sort()
  const bestThirdScenarioKey = qualifiedGroups.length === 8 ? qualifiedGroups.join('') : null

  const matchByNumber = new Map(matches.map((m) => [m.match_number, m]))
  const byNumber = (a: MatchWithTeams, b: MatchWithTeams) => a.match_number - b.match_number
  const qfMatches = matches.filter((m) => m.round?.name === 'quarterfinals').sort(byNumber)
  const sfMatches = matches.filter((m) => m.round?.name === 'semifinals').sort(byNumber)

  return { groupStandings, groupStandingsComplete, bestThirds, bestThirdGroups, bestThirdScenarioKey, matchByNumber, qfMatches, sfMatches }
}

/** Convenience: the team id a placeholder currently resolves to, or null if undecided. */
export function resolveSlotTeamId(placeholder: string | null, ctx: SlotContext, matchNumber?: number): string | null {
  return resolveKnockoutSlot(parseSlotPlaceholder(placeholder), ctx, matchNumber).presetTeamId
}

export function resolveKnockoutSlot(source: SlotSource, ctx: SlotContext, matchNumber?: number): ResolvedSlot {
  switch (source.type) {
    case 'group': {
      const standings = ctx.groupStandings[source.group] ?? []
      if (standings.length < 2) return { ...EMPTY, note: `Group ${source.group} standings incomplete` }
      if (!ctx.groupStandingsComplete[source.group]) {
        return { ...EMPTY, note: `Group ${source.group} results not fully confirmed` }
      }
      const idx = source.position - 1
      const here = standings[idx]
      const tieAbove = idx > 0 && isStandingsTie(here, standings[idx - 1])
      const tieBelow = idx < standings.length - 1 && isStandingsTie(here, standings[idx + 1])
      const candidates = new Set<string>()
      candidates.add(here.team.id)
      if (tieAbove) candidates.add(standings[idx - 1].team.id)
      if (tieBelow) candidates.add(standings[idx + 1].team.id)
      return {
        presetTeamId: here.team.id,
        candidateTeamIds: Array.from(candidates),
        isTie: tieAbove || tieBelow,
        ready: true,
      }
    }

    case 'best_third': {
      if (ctx.bestThirds.length < 8) {
        return { presetTeamId: null, candidateTeamIds: [], isTie: false, ready: false, note: 'Confirm 8 best thirds first' }
      }
      // Look up the FIFA combination table when scenario + match number are known.
      const scenarioRow = ctx.bestThirdScenarioKey
        ? THIRD_PLACE_MATRIX[ctx.bestThirdScenarioKey]
        : null
      const assignedGroup = matchNumber != null ? scenarioRow?.[matchNumber] ?? null : null

      if (assignedGroup) {
        const presetTeam = ctx.bestThirds.find(
          (s) => ctx.bestThirdGroups.get(s.team.id) === assignedGroup
        )
        return {
          presetTeamId: presetTeam?.team.id ?? null,
          candidateTeamIds: presetTeam ? [presetTeam.team.id] : [],
          isTie: false,
          ready: !!presetTeam,
          note: presetTeam ? undefined : `3rd of Group ${assignedGroup} not found`,
        }
      }

      // Fallback: filter by allowed groups, admin picks manually.
      const candidateTeamIds = ctx.bestThirds
        .filter((s) => source.allowedGroups.includes(ctx.bestThirdGroups.get(s.team.id) ?? ''))
        .map((s) => s.team.id)
      return {
        presetTeamId: candidateTeamIds.length === 1 ? candidateTeamIds[0] : null,
        candidateTeamIds,
        isTie: false,
        ready: candidateTeamIds.length > 0,
        note: !scenarioRow && ctx.bestThirdScenarioKey ? 'Scenario not found in matrix' : undefined,
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
