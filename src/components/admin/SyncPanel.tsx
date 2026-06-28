'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n/I18nProvider'
import type { Database } from '@/types/database'

type SyncRun = Database['public']['Tables']['sync_runs']['Row']

interface SyncPanelProps {
  syncRuns: SyncRun[]
  hasTeamMapping: boolean
  hasMatchMapping: boolean
  driftCount: number
}

export function SyncPanel({ syncRuns, hasTeamMapping, hasMatchMapping, driftCount }: SyncPanelProps) {
  const t = useT()
  const [syncing, setSyncing] = useState(false)
  const [seedingTeams, setSeedingTeams] = useState(false)
  const [seedingMatches, setSeedingMatches] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [seedFeedback, setSeedFeedback] = useState<string | null>(null)

  async function handleSync() {
    setSyncing(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/sync', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        setFeedback(`Error: ${data.error}`)
      } else {
        setFeedback(
          t('admin.sync.syncResult', {
            seen: data.matchesSeen,
            changed: data.matchesChanged,
            drift: data.driftCount,
            recalculated: data.roundsRecalculated,
          })
        )
      }
    } catch (err) {
      setFeedback(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSyncing(false)
    }
  }

  async function handleSeedTeams() {
    setSeedingTeams(true)
    setSeedFeedback(null)
    try {
      const res = await fetch('/api/sync/seed-teams', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        setSeedFeedback(`Error: ${data.error}`)
      } else {
        setSeedFeedback(
          `Mapped ${data.mapped} teams.${data.unmatched.length > 0 ? ` Unmatched: ${data.unmatched.join(', ')}` : ''}`
        )
      }
    } catch (err) {
      setSeedFeedback(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSeedingTeams(false)
    }
  }

  async function handleSeedMatches() {
    setSeedingMatches(true)
    setSeedFeedback(null)
    try {
      const res = await fetch('/api/sync/seed-matches', { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        setSeedFeedback(`Error: ${data.error}`)
      } else {
        setSeedFeedback(`Mapped ${data.mapped} matches. ${data.unmatched} unmatched.`)
      }
    } catch (err) {
      setSeedFeedback(`Error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSeedingMatches(false)
    }
  }

  const latestRun = syncRuns[0]

  return (
    <div className="space-y-6">
      {/* Mapping setup */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">{t('admin.sync.mappingTitle')}</h3>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${hasTeamMapping ? 'bg-green-400' : 'bg-amber-400'}`} />
            <span className="text-sm text-slate-300">
              {hasTeamMapping ? t('admin.sync.teamsMapped') : t('admin.sync.teamsNotMapped')}
            </span>
            {!hasTeamMapping && (
              <Button size="sm" loading={seedingTeams} onClick={handleSeedTeams}>
                {t('admin.sync.seedTeams')}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${hasMatchMapping ? 'bg-green-400' : 'bg-amber-400'}`} />
            <span className="text-sm text-slate-300">
              {hasMatchMapping ? t('admin.sync.matchesMapped') : t('admin.sync.matchesNotMapped')}
            </span>
            {!hasMatchMapping && hasTeamMapping && (
              <Button size="sm" loading={seedingMatches} onClick={handleSeedMatches}>
                {t('admin.sync.seedMatches')}
              </Button>
            )}
          </div>
        </div>
        {seedFeedback && (
          <p className="mt-2 text-sm text-slate-400">{seedFeedback}</p>
        )}
      </div>

      {/* Sync control */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">{t('admin.sync.title')}</h3>
          <Button size="sm" variant="primary" loading={syncing} onClick={handleSync}>
            {t('admin.sync.syncNow')}
          </Button>
        </div>

        {feedback && (
          <p className={`text-sm mb-3 ${feedback.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
            {feedback}
          </p>
        )}

        {driftCount > 0 && (
          <div className="mb-3 rounded-lg border border-amber-700/50 bg-amber-900/10 px-3 py-2 text-sm text-amber-300">
            {t('admin.sync.driftWarning', { count: driftCount })}
          </div>
        )}

        {latestRun && (
          <p className="text-xs text-slate-500 mb-4">
            {t('admin.sync.lastRun', { time: new Date(latestRun.started_at).toLocaleString() })}
            {' — '}{latestRun.status}
          </p>
        )}

        {/* Recent sync runs */}
        {syncRuns.length > 0 && (
          <div className="rounded-xl bg-slate-900/50 border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-700">
                  <th className="px-3 py-2 text-left">{t('admin.sync.col.time')}</th>
                  <th className="px-3 py-2 text-center">{t('admin.sync.col.status')}</th>
                  <th className="px-3 py-2 text-center">{t('admin.sync.col.seen')}</th>
                  <th className="px-3 py-2 text-center">{t('admin.sync.col.changed')}</th>
                  <th className="px-3 py-2 text-center">{t('admin.sync.col.drift')}</th>
                  <th className="px-3 py-2 text-left">{t('admin.sync.col.error')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {syncRuns.map((run) => (
                  <tr key={run.id}>
                    <td className="px-3 py-2 text-slate-300 text-xs">
                      {new Date(run.started_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        run.status === 'ok' ? 'bg-green-900/40 text-green-400' :
                        run.status === 'error' ? 'bg-red-900/40 text-red-400' :
                        'bg-amber-900/40 text-amber-400'
                      }`}>
                        {run.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-slate-400">{run.matches_seen ?? '—'}</td>
                    <td className="px-3 py-2 text-center text-slate-400">{run.matches_changed ?? '—'}</td>
                    <td className="px-3 py-2 text-center text-slate-400">{run.drift_count ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-red-400 truncate max-w-[200px]">{run.error_text ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
