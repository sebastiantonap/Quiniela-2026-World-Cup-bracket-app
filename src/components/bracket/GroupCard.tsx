'use client'

import { useMemo, useEffect, useRef } from 'react'
import { MatchRow } from './MatchRow'
import { GroupQualificationPicker } from './GroupQualificationPicker'
import { computePredictedStandings } from '@/lib/standings/predictedStandings'
import type { MatchWithTeams, Prediction, Team, QualPick } from '@/types/app'

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
  const { standings, hasAmbiguity, ambiguousTeams, predictedMatchCount, totalMatchCount } =
    useMemo(
      () => computePredictedStandings(teams, matches, predictions),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [teams, matches, predictions]
    )

  const autoFillKeyRef = useRef('')
  const qualPickRef = useRef(qualPick)
  useEffect(() => { qualPickRef.current = qualPick })

  useEffect(() => {
    // Only auto-fill when there's real prediction data and the round is open
    if (!isEditable || standings.length < 2 || predictedMatchCount === 0) return

    const first = standings[0].team.id
    const second = standings[1].team.id
    const thirdId = standings[2]?.team.id ?? null
    const key = `${first}|${second}|${hasAmbiguity ? 'AMB' : (thirdId ?? 'NONE')}`

    if (key === autoFillKeyRef.current) return
    autoFillKeyRef.current = key

    const updates: Partial<QualPick> = { predicted1st: first, predicted2nd: second }

    if (!hasAmbiguity) {
      updates.predicted3rd = thirdId
    } else {
      // Ambiguous: keep the user's 3rd pick only if it's one of the two tied teams
      const current3rd = qualPickRef.current?.predicted3rd ?? null
      const ambigIds = new Set(ambiguousTeams?.map((t) => t.id) ?? [])
      if (!current3rd || !ambigIds.has(current3rd)) {
        updates.predicted3rd = null
      }
    }

    onQualUpdate(groupId, updates)
  }, [standings, hasAmbiguity, ambiguousTeams, predictedMatchCount, isEditable, groupId, onQualUpdate])

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
            {standings.map((s, i) => {
              const isAmbig = hasAmbiguity && (i === 2 || i === 3)
              return (
                <tr
                  key={s.team.id}
                  className={`border-t border-slate-700/50 ${
                    i < 2 ? 'bg-green-900/10' : isAmbig ? 'bg-amber-900/10' : ''
                  }`}
                >
                  <td className="pl-3 pr-1 py-1.5 text-slate-500">{i + 1}</td>
                  <td className="px-1 py-1.5 font-medium text-slate-200">
                    {s.team.flag_emoji} {s.team.name}
                    {i < 2 && <span className="ml-1 text-[10px] text-green-400">Q</span>}
                    {isAmbig && <span className="ml-1 text-[10px] text-amber-400">?</span>}
                  </td>
                  <td className="px-2 py-1.5 text-center font-bold text-slate-100">{s.points}</td>
                  <td className="px-2 py-1.5 text-center text-slate-300">{s.goals_for}</td>
                  <td className="px-2 py-1.5 text-center text-slate-300">{s.goals_against}</td>
                  <td className="pr-3 py-1.5 text-center text-slate-400">
                    {s.goal_difference > 0 ? '+' : ''}{s.goal_difference}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {hasAmbiguity && ambiguousTeams && (
          <p className="px-3 py-2 text-[10px] text-amber-400 bg-amber-900/10 border-t border-amber-800/30">
            {ambiguousTeams[0].name} and {ambiguousTeams[1].name} are tied on all tiebreakers — pick 3rd place manually below.
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
          ambiguousTeams={hasAmbiguity ? ambiguousTeams : null}
        />
      </div>
    </div>
  )
}
