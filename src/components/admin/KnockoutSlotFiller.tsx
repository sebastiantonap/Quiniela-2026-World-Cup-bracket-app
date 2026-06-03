'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { assignKnockoutTeams } from '@/actions/admin/results'
import { Button } from '@/components/ui/Button'
import {
  buildSlotContext,
  parseSlotPlaceholder,
  resolveKnockoutSlot,
  type ResolvedSlot,
} from '@/lib/standings/knockoutSlots'
import { useT } from '@/lib/i18n/I18nProvider'
import { roundLabel } from '@/lib/i18n/translator'
import type { MatchWithTeams, Round, RoundName, Team } from '@/types/app'

interface KnockoutSlotFillerProps {
  rounds: Round[]
  matches: MatchWithTeams[]
  teams: Team[]
  onNavigateToStandings?: () => void
}

export function KnockoutSlotFiller({ rounds, matches, teams, onNavigateToStandings }: KnockoutSlotFillerProps) {
  const t = useT()
  const knockoutRounds: RoundName[] = ['round_of_32', 'round_of_16', 'quarterfinals', 'semifinals', 'third_place', 'final']
  const roundMap = Object.fromEntries(rounds.map((r) => [r.name, r]))

  const [selectedRound, setSelectedRound] = useState<RoundName>('round_of_32')

  // Pre-flight checklist conditions
  const groupStageMatches = matches.filter((m) => m.round?.name === 'group_stage')
  const allGroupMatchesConfirmed = groupStageMatches.length === 72 && groupStageMatches.every((m) => m.result_confirmed)
  const bestThirdCount = teams.filter((t) => t.best_third_qualified).length
  const bestThirdConfirmed = bestThirdCount === 8
  const r32Matches = matches.filter((m) => m.round?.name === 'round_of_32')
  const r32SlotsAssigned = r32Matches.filter((m) => m.home_team && m.away_team).length
  const [slots, setSlots] = useState<Record<string, { home?: string; away?: string }>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const [bulkLoading, setBulkLoading] = useState(false)
  const router = useRouter()

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])

  // Context for resolving slot presets, built from existing props (no fetch).
  const ctx = useMemo(() => buildSlotContext(matches, teams), [matches, teams])

  const roundMatches = useMemo(
    () => matches.filter((m) => m.round?.name === selectedRound).sort((a, b) => a.match_number - b.match_number),
    [matches, selectedRound]
  )

  // Resolved preset/candidates per unfilled match in the selected round.
  const resolved = useMemo(() => {
    const out: Record<string, { home: ResolvedSlot; away: ResolvedSlot }> = {}
    for (const m of roundMatches) {
      out[m.id] = {
        home: resolveKnockoutSlot(parseSlotPlaceholder(m.placeholder_home), ctx, m.match_number),
        away: resolveKnockoutSlot(parseSlotPlaceholder(m.placeholder_away), ctx, m.match_number),
      }
    }
    return out
  }, [roundMatches, ctx])

  function getSlot(matchId: string, side: 'home' | 'away') {
    return slots[matchId]?.[side] ?? resolved[matchId]?.[side].presetTeamId ?? ''
  }

  // Show the actual team instead of the raw placeholder (e.g. "Winner M73" → "🇧🇷 Brazil"):
  // prefer the team assigned to this slot, then the resolved feeding-match winner, and only
  // fall back to the placeholder while the slot is still undecided.
  function slotLabel(team: Team | null, placeholder: string | null, slot?: ResolvedSlot): string {
    const resolved = team ?? (slot?.presetTeamId ? teamById.get(slot.presetTeamId) ?? null : null)
    return resolved ? `${resolved.flag_emoji} ${resolved.name}`.trim() : placeholder ?? ''
  }

  function setSlot(matchId: string, side: 'home' | 'away', value: string) {
    setSlots((prev) => ({ ...prev, [matchId]: { ...prev[matchId], [side]: value } }))
  }

  async function assignOne(match: MatchWithTeams) {
    const homeId = getSlot(match.id, 'home') || null
    const awayId = getSlot(match.id, 'away') || null
    if (homeId && awayId && homeId === awayId) {
      setFeedback((prev) => ({ ...prev, [match.id]: t('admin.slots.sameTeam') }))
      return false
    }
    const result = await assignKnockoutTeams(match.id, homeId, awayId)
    setFeedback((prev) => ({ ...prev, [match.id]: result.error ?? t('admin.slots.assigned') }))
    return !result.error
  }

  async function handleAssign(match: MatchWithTeams) {
    setLoading((prev) => ({ ...prev, [match.id]: true }))
    await assignOne(match)
    setLoading((prev) => ({ ...prev, [match.id]: false }))
    router.refresh()
  }

  // Matches whose both sides are ready and not flagged as ties — safe to auto-assign in bulk.
  const autoAssignable = roundMatches.filter((m) => {
    if (m.home_team && m.away_team) return false
    const r = resolved[m.id]
    return (
      r &&
      r.home.ready && r.away.ready &&
      !r.home.isTie && !r.away.isTie &&
      !!r.home.presetTeamId && !!r.away.presetTeamId
    )
  })

  async function handleAssignAll() {
    setBulkLoading(true)
    for (const m of autoAssignable) await assignOne(m)
    setBulkLoading(false)
    router.refresh()
  }

  // Teams already placed elsewhere in this round (assigned or pending selection) are
  // excluded from other slots' dropdowns so the same team can't fill two slots.
  function currentTeamFor(m: MatchWithTeams, side: 'home' | 'away'): string {
    const assigned = side === 'home' ? m.home_team_id : m.away_team_id
    return assigned ?? getSlot(m.id, side)
  }
  const chosen = roundMatches.flatMap((m) => [
    { key: `${m.id}:home`, teamId: currentTeamFor(m, 'home') },
    { key: `${m.id}:away`, teamId: currentTeamFor(m, 'away') },
  ]).filter((c) => c.teamId)
  function excludedFor(matchId: string, side: 'home' | 'away'): Set<string> {
    const selfKey = `${matchId}:${side}`
    return new Set(chosen.filter((c) => c.key !== selfKey).map((c) => c.teamId))
  }

  return (
    <div>
      {/* Pre-flight checklist for Round of 32 */}
      {selectedRound === 'round_of_32' && (
        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3">
          <div className="mb-2 text-sm font-semibold text-slate-300">{t('admin.slots.r32Checklist')}</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className={allGroupMatchesConfirmed ? 'text-green-400' : 'text-slate-500'}>
                {allGroupMatchesConfirmed ? '✅' : '⬜'}
              </span>
              <span className={allGroupMatchesConfirmed ? 'text-slate-300' : 'text-slate-400'}>
                {t('admin.slots.allGroupMatchesConfirmed', { count: groupStageMatches.length })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className={bestThirdConfirmed ? 'text-green-400' : 'text-slate-500'}>
                {bestThirdConfirmed ? '✅' : '⬜'}
              </span>
              <span className={bestThirdConfirmed ? 'text-slate-300' : 'text-slate-400'}>
                {t('admin.slots.bestThirdConfirmed', { count: bestThirdCount })}
              </span>
              {!bestThirdConfirmed && onNavigateToStandings && (
                <button
                  onClick={onNavigateToStandings}
                  className="ml-2 text-amber-400 hover:text-amber-300 underline"
                >
                  → {t('admin.slots.confirmNow')}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className={r32SlotsAssigned === 16 ? 'text-green-400' : 'text-slate-500'}>
                {r32SlotsAssigned === 16 ? '✅' : '⬜'}
              </span>
              <span className={r32SlotsAssigned === 16 ? 'text-slate-300' : 'text-slate-400'}>
                {t('admin.slots.r32SlotsAssigned', { count: r32SlotsAssigned })}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {knockoutRounds.map((roundName) => {
          const round = roundMap[roundName]
          if (!round) return null
          return (
            <button
              key={roundName}
              onClick={() => setSelectedRound(roundName)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                selectedRound === roundName
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {roundLabel(t, roundName)}
            </button>
          )
        })}
      </div>

      {autoAssignable.length > 0 && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-slate-800/60 border border-slate-700 px-4 py-2">
          <span className="text-xs text-slate-400">
            {t(autoAssignable.length === 1 ? 'admin.slots.canFillOne' : 'admin.slots.canFillOther', { count: autoAssignable.length })}
          </span>
          <Button size="sm" loading={bulkLoading} onClick={handleAssignAll}>
            {t('admin.slots.assignAll')}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {roundMatches.map((match) => {
          const r = resolved[match.id]
          const filled = match.home_team && match.away_team
          const notReady = !filled && r && (!r.home.ready || !r.away.ready)
          const tie = !filled && r && (r.home.isTie || r.away.isTie)

          return (
            <div
              key={match.id}
              className={`flex flex-wrap items-center gap-4 rounded-xl bg-slate-800 border px-4 py-3 ${
                tie ? 'border-amber-700/60' : 'border-slate-700'
              }`}
            >
              <span className="text-xs text-slate-500">M{match.match_number}</span>
              <div className="flex-1 min-w-0 text-xs text-slate-400">
                <div>{slotLabel(match.home_team, match.placeholder_home, r?.home)}</div>
                <div>{slotLabel(match.away_team, match.placeholder_away, r?.away)}</div>
              </div>

              {filled ? (
                <span className="text-sm font-medium text-green-400">
                  {match.home_team!.name} {t('common.vs')} {match.away_team!.name} ✓
                </span>
              ) : (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SlotSelect
                      value={getSlot(match.id, 'home')}
                      candidates={r?.home.candidateTeamIds ?? []}
                      excluded={excludedFor(match.id, 'home')}
                      teamById={teamById}
                      placeholder={t('admin.slots.homeTeam')}
                      onChange={(v) => setSlot(match.id, 'home', v)}
                    />
                    <span className="text-slate-500">{t('common.vs')}</span>
                    <SlotSelect
                      value={getSlot(match.id, 'away')}
                      candidates={r?.away.candidateTeamIds ?? []}
                      excluded={excludedFor(match.id, 'away')}
                      teamById={teamById}
                      placeholder={t('admin.slots.awayTeam')}
                      onChange={(v) => setSlot(match.id, 'away', v)}
                    />
                    <Button
                      size="sm"
                      loading={loading[match.id]}
                      disabled={notReady || !getSlot(match.id, 'home') || !getSlot(match.id, 'away')}
                      onClick={() => handleAssign(match)}
                    >
                      {t('admin.slots.assign')}
                    </Button>
                  </div>
                  {tie && (
                    <span className="text-[11px] text-amber-400">{t('admin.slots.tieVerify')}</span>
                  )}
                  {notReady && (
                    <span className="text-[11px] text-slate-500">
                      {r?.home.note || r?.away.note || t('admin.slots.prevNotDecided')}
                    </span>
                  )}
                </div>
              )}

              {feedback[match.id] && (
                <span className={`text-xs ${feedback[match.id] === t('admin.slots.assigned') ? 'text-green-400' : 'text-red-400'}`}>
                  {feedback[match.id]}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SlotSelect({
  value,
  candidates,
  excluded,
  teamById,
  placeholder,
  onChange,
}: {
  value: string
  candidates: string[]
  excluded?: Set<string>
  teamById: Map<string, Team>
  placeholder: string
  onChange: (value: string) => void
}) {
  // Keep the currently selected team visible; drop teams already used in other slots.
  const options = candidates.filter((id) => id === value || !excluded?.has(id))
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-sm text-slate-200"
    >
      <option value="">{placeholder}</option>
      {options.map((id) => {
        const t = teamById.get(id)
        if (!t) return null
        return (
          <option key={id} value={id}>
            {t.flag_emoji} {t.name}
          </option>
        )
      })}
    </select>
  )
}
