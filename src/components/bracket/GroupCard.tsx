'use client'

import { useMemo, useEffect, useRef } from 'react'
import { MatchRow } from './MatchRow'
import { GroupQualificationPicker } from './GroupQualificationPicker'
import { computePredictedStandings } from '@/lib/standings/predictedStandings'
import type { MatchWithTeams, Prediction, Team, QualPick } from '@/types/app'
import type { StandingAmbiguities } from '@/lib/standings/predictedStandings'

interface GroupCardProps {
  letter: string
  groupId: string
  teams: Team[]
  matches: MatchWithTeams[]
  predictions: Record<string, Prediction>
  qualPick: QualPick | undefined
  isEditable: boolean
  onMatchUpdate: (matchId: string, home: number | null, away: number | null) => void
  onQualUpdate: (groupId: string, updates: Partial<QualPick>) => void
  saving: Record<string, boolean>
  errors: Record<string, string>
  qualSaving?: boolean
}

/** IDs of teams that plausibly occupy each position given the ambiguities. */
function plausibleIds(standings: ReturnType<typeof computePredictedStandings>['standings'], amb: StandingAmbiguities, pos: 0 | 1 | 2): Set<string> {
  const ids = new Set<string>()
  // pos 0 (1st): tied with pos 1 when amb.first
  if (pos === 0) {
    if (standings[0]) ids.add(standings[0].team.id)
    if (amb.first && standings[1]) ids.add(standings[1].team.id)
  }
  // pos 1 (2nd): affected by amb.first (spills up) or amb.second (spills down)
  if (pos === 1) {
    if (standings[1]) ids.add(standings[1].team.id)
    if (amb.first && standings[0]) ids.add(standings[0].team.id)
    if (amb.second && standings[2]) ids.add(standings[2].team.id)
  }
  // pos 2 (3rd): affected by amb.second (spills up) or amb.third (spills down)
  if (pos === 2) {
    if (standings[2]) ids.add(standings[2].team.id)
    if (amb.second && standings[1]) ids.add(standings[1].team.id)
    if (amb.third && standings[3]) ids.add(standings[3].team.id)
  }
  return ids
}

export function GroupCard({
  letter,
  groupId,
  teams,
  matches,
  predictions,
  qualPick,
  isEditable,
  onMatchUpdate,
  onQualUpdate,
  saving,
  errors,
  qualSaving,
}: GroupCardProps) {
  const { standings, ambiguities, predictedMatchCount, totalMatchCount } = useMemo(
    () => computePredictedStandings(teams, matches, predictions),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teams, matches, predictions]
  )

  const autoFillKeyRef = useRef('')
  const qualPickRef = useRef(qualPick)
  useEffect(() => { qualPickRef.current = qualPick })

  useEffect(() => {
    if (!isEditable || standings.length < 4 || predictedMatchCount === 0) return

    const { first: amb1, second: amb2, third: amb3 } = ambiguities

    // What auto-fill would write for each position (null = user must choose)
    const autoFirst  = amb1              ? null : standings[0].team.id
    const autoSecond = (amb1 || amb2)    ? null : standings[1].team.id
    const autoThird  = (amb2 || amb3)    ? null : (standings[2]?.team.id ?? null)

    const key = `${autoFirst ?? 'X'}|${autoSecond ?? 'X'}|${autoThird ?? 'X'}`
    if (key === autoFillKeyRef.current) return
    autoFillKeyRef.current = key

    const updates: Partial<QualPick> = {}

    // Unambiguous positions: overwrite with computed value
    if (autoFirst  !== null) updates.predicted1st = autoFirst
    if (autoSecond !== null) updates.predicted2nd = autoSecond
    if (autoThird  !== null) updates.predicted3rd = autoThird

    // Ambiguous positions: keep the user's pick only if it's still plausible;
    // otherwise clear so the picker shows an empty / required state.
    if (autoFirst === null) {
      const cur = qualPickRef.current?.predicted1st ?? null
      if (!cur || !plausibleIds(standings, ambiguities, 0).has(cur)) updates.predicted1st = null
    }
    if (autoSecond === null) {
      const cur = qualPickRef.current?.predicted2nd ?? null
      if (!cur || !plausibleIds(standings, ambiguities, 1).has(cur)) updates.predicted2nd = null
    }
    if (autoThird === null) {
      const cur = qualPickRef.current?.predicted3rd ?? null
      if (!cur || !plausibleIds(standings, ambiguities, 2).has(cur)) updates.predicted3rd = null
    }

    onQualUpdate(groupId, updates)
  }, [standings, ambiguities, predictedMatchCount, isEditable, groupId, onQualUpdate])

  // Per-row display flags
  const rowAmbig = [
    ambiguities.first,                    // row 0 (1st): tied with 2nd
    ambiguities.first || ambiguities.second, // row 1 (2nd): tied above or below
    ambiguities.second || ambiguities.third, // row 2 (3rd): tied above or below
    ambiguities.third,                    // row 3 (4th): tied with 3rd
  ]
  const hasAnyAmbiguity = ambiguities.first || ambiguities.second || ambiguities.third

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800">
      <div className="border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <h3 className="font-bold text-slate-100">Group {letter}</h3>
        <span className="text-xs text-slate-500">{predictedMatchCount}/{totalMatchCount} matches</span>
      </div>

      {/* Match score inputs */}
      <div className="divide-y divide-slate-700/50 px-2 py-2">
        {matches.map((match) => (
          <MatchRow
            key={match.id}
            match={match}
            prediction={predictions[match.id]}
            isEditable={isEditable}
            onUpdate={(home, away) => onMatchUpdate(match.id, home, away)}
            saving={saving[match.id]}
            error={errors[match.id]}
          />
        ))}
      </div>

      {/* Simulated standings — always visible, updates as scores are entered */}
      <div className="mx-4 mb-3 rounded-xl border border-slate-700 overflow-hidden">
        <div className="bg-slate-700/40 px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Simulated Standings
          </span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-t border-slate-700/60 text-[10px] text-slate-500">
              <th className="pl-3 pr-1 py-1 text-left w-5">#</th>
              <th className="px-1 py-1 text-left">Team</th>
              <th className="px-2 py-1 text-center w-9">Pts</th>
              <th className="px-2 py-1 text-center w-9">GF</th>
              <th className="px-2 py-1 text-center w-9">GA</th>
              <th className="pr-3 py-1 text-center w-10">GD</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => (
              <tr
                key={s.team.id}
                className={`border-t border-slate-700/50 ${
                  predictedMatchCount > 0 && rowAmbig[i]
                    ? 'bg-amber-900/10'
                    : i < 2
                    ? 'bg-green-900/10'
                    : ''
                }`}
              >
                <td className="pl-3 pr-1 py-1.5 text-slate-500">{i + 1}</td>
                <td className="px-1 py-1.5 font-medium text-slate-200">
                  {s.team.flag_emoji} {s.team.name}
                  {predictedMatchCount > 0 && !rowAmbig[i] && i < 2 && (
                    <span className="ml-1 text-[10px] text-green-400">Q</span>
                  )}
                  {predictedMatchCount > 0 && rowAmbig[i] && (
                    <span className="ml-1 text-[10px] text-amber-400">?</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-center font-bold text-slate-100">{s.points}</td>
                <td className="px-2 py-1.5 text-center text-slate-300">{s.goals_for}</td>
                <td className="px-2 py-1.5 text-center text-slate-300">{s.goals_against}</td>
                <td className="pr-3 py-1.5 text-center text-slate-400">
                  {s.goal_difference > 0 ? '+' : ''}{s.goal_difference}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {predictedMatchCount > 0 && hasAnyAmbiguity && (
          <p className="px-3 py-2 text-[10px] text-amber-400 bg-amber-900/10 border-t border-amber-800/30">
            Tied positions marked with ? — pick those manually below.
          </p>
        )}
      </div>

      <div className="px-4 pb-4">
        <GroupQualificationPicker
          groupId={groupId}
          teams={teams}
          pick={qualPick}
          isEditable={isEditable}
          onUpdate={onQualUpdate}
          saving={qualSaving}
          ambiguities={predictedMatchCount > 0 ? ambiguities : undefined}
        />
      </div>
    </div>
  )
}
