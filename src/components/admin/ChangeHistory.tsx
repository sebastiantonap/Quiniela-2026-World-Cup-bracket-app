'use client'

import { useState, useMemo } from 'react'
import { useT } from '@/lib/i18n/I18nProvider'
import type { Database } from '@/types/database'

type ChangeLogRow = Database['public']['Tables']['change_log']['Row']

interface ChangeHistoryProps {
  logs: ChangeLogRow[]
  matchNumbers: Record<string, number>
}

type SourceFilter = 'all' | 'api_sync' | 'manual'

export function ChangeHistory({ logs, matchNumbers }: ChangeHistoryProps) {
  const t = useT()
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [matchFilter, setMatchFilter] = useState('')

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (sourceFilter !== 'all' && log.source !== sourceFilter) return false
      if (matchFilter) {
        const num = matchNumbers[log.entity_id]
        if (!num || !String(num).includes(matchFilter)) return false
      }
      return true
    })
  }, [logs, sourceFilter, matchFilter, matchNumbers])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-slate-800 p-1 border border-slate-700">
          {(['all', 'api_sync', 'manual'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setSourceFilter(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                sourceFilter === f
                  ? 'bg-slate-700 text-slate-100 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f === 'all' ? t('admin.history.filterAll') :
               f === 'api_sync' ? t('admin.history.filterApi') :
               t('admin.history.filterManual')}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder={t('admin.history.matchPlaceholder')}
          value={matchFilter}
          onChange={(e) => setMatchFilter(e.target.value)}
          className="w-32 rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-700 bg-slate-700/50">
              <th className="px-3 py-2 text-left">{t('admin.history.col.time')}</th>
              <th className="px-3 py-2 text-center">{t('admin.history.col.match')}</th>
              <th className="px-3 py-2 text-left">{t('admin.history.col.field')}</th>
              <th className="px-3 py-2 text-left">{t('admin.history.col.change')}</th>
              <th className="px-3 py-2 text-center">{t('admin.history.col.source')}</th>
              <th className="px-3 py-2 text-left">{t('admin.history.col.by')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                  {t('admin.history.noEntries')}
                </td>
              </tr>
            )}
            {filtered.map((log) => (
              <tr key={log.id}>
                <td className="px-3 py-2 text-xs text-slate-300">
                  {new Date(log.changed_at).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-center text-slate-400">
                  #{matchNumbers[log.entity_id] ?? '?'}
                </td>
                <td className="px-3 py-2 text-slate-300">{log.field}</td>
                <td className="px-3 py-2 text-slate-300">
                  <span className="text-red-400/70">{log.old_value ?? '—'}</span>
                  <span className="mx-1 text-slate-500">&rarr;</span>
                  <span className="text-green-400">{log.new_value ?? '—'}</span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    log.source === 'api_sync'
                      ? 'bg-blue-900/40 text-blue-400'
                      : 'bg-amber-900/40 text-amber-400'
                  }`}>
                    {log.source === 'api_sync' ? 'API' : 'Manual'}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-slate-400 truncate max-w-[160px]">
                  {log.changed_by ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
