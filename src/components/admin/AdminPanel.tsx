'use client'

import { useState } from 'react'
import { RoundManager } from './RoundManager'
import { ResultsEntry } from './ResultsEntry'
import { KnockoutSlotFiller } from './KnockoutSlotFiller'
import { GroupStandings } from './GroupStandings'
import { SyncPanel } from './SyncPanel'
import { ChangeHistory } from './ChangeHistory'
import { UserManager } from './UserManager'
import { useT } from '@/lib/i18n/I18nProvider'
import type { TranslationKey } from '@/lib/i18n/dictionaries/en'
import type { MatchWithTeams, Round, Team } from '@/types/app'
import type { AdminUserRow } from '@/actions/admin/users'
import type { Database } from '@/types/database'

type SyncRun = Database['public']['Tables']['sync_runs']['Row']
type ChangeLogRow = Database['public']['Tables']['change_log']['Row']

type AdminTab = 'rounds' | 'results' | 'slots' | 'standings' | 'sync' | 'history' | 'users'

interface AdminPanelProps {
  rounds: Round[]
  matches: MatchWithTeams[]
  teams: Team[]
  users: AdminUserRow[]
  syncRuns: SyncRun[]
  changeLogs: ChangeLogRow[]
  hasTeamMapping: boolean
  hasMatchMapping: boolean
}

export function AdminPanel({ rounds, matches, teams, users, syncRuns, changeLogs, hasTeamMapping, hasMatchMapping }: AdminPanelProps) {
  const t = useT()
  const [activeTab, setActiveTab] = useState<AdminTab>('rounds')

  const tabs: { id: AdminTab; labelKey: TranslationKey }[] = [
    { id: 'rounds', labelKey: 'admin.tab.rounds' },
    { id: 'results', labelKey: 'admin.tab.results' },
    { id: 'slots', labelKey: 'admin.tab.slots' },
    { id: 'standings', labelKey: 'admin.tab.standings' },
    { id: 'sync', labelKey: 'admin.tab.sync' },
    { id: 'history', labelKey: 'admin.tab.history' },
    { id: 'users', labelKey: 'admin.tab.users' },
  ]

  // Build match id → match_number lookup for change history
  const matchNumbers: Record<string, number> = {}
  for (const m of matches) {
    matchNumbers[m.id] = m.match_number
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <a
          href="/api/admin/export"
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-sm text-slate-200 transition-colors"
        >
          {t('admin.exportXlsx')}
        </a>
      </div>
      <div className="mb-6 flex gap-1 rounded-xl bg-slate-800 p-1 w-fit border border-slate-700 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-slate-700 text-slate-100 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {activeTab === 'rounds' && <RoundManager rounds={rounds} />}
      {activeTab === 'results' && <ResultsEntry rounds={rounds} matches={matches} teams={teams} />}
      {activeTab === 'slots' && <KnockoutSlotFiller rounds={rounds} matches={matches} teams={teams} />}
      {activeTab === 'standings' && <GroupStandings matches={matches} teams={teams} />}
      {activeTab === 'sync' && <SyncPanel syncRuns={syncRuns} hasTeamMapping={hasTeamMapping} hasMatchMapping={hasMatchMapping} />}
      {activeTab === 'history' && <ChangeHistory logs={changeLogs} matchNumbers={matchNumbers} />}
      {activeTab === 'users' && <UserManager users={users} />}
    </div>
  )
}
