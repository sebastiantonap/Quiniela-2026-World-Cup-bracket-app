'use client'

import { useState } from 'react'
import { RoundManager } from './RoundManager'
import { ResultsEntry } from './ResultsEntry'
import { KnockoutSlotFiller } from './KnockoutSlotFiller'
import { GroupStandings } from './GroupStandings'
import type { MatchWithTeams, Round, Team } from '@/types/app'

type AdminTab = 'rounds' | 'results' | 'slots' | 'standings'

interface AdminPanelProps {
  rounds: Round[]
  matches: MatchWithTeams[]
  teams: Team[]
}

export function AdminPanel({ rounds, matches, teams }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('rounds')

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'rounds', label: 'Round Manager' },
    { id: 'results', label: 'Enter Results' },
    { id: 'slots', label: 'Knockout Slots' },
    { id: 'standings', label: 'Group Standings' },
  ]

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'rounds' && <RoundManager rounds={rounds} />}
      {activeTab === 'results' && <ResultsEntry rounds={rounds} matches={matches} teams={teams} />}
      {activeTab === 'slots' && <KnockoutSlotFiller rounds={rounds} matches={matches} teams={teams} />}
      {activeTab === 'standings' && <GroupStandings matches={matches} teams={teams} />}
    </div>
  )
}
