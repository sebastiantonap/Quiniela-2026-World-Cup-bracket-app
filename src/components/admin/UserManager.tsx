'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addAdmin, removeAdmin } from '@/actions/admin/manageAdmins'
import { Button } from '@/components/ui/Button'
import type { AdminUserRow } from '@/actions/admin/users'

interface UserManagerProps {
  users: AdminUserRow[]
}

export function UserManager({ users }: UserManagerProps) {
  const [newEmail, setNewEmail] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [removeLoading, setRemoveLoading] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const router = useRouter()

  async function handleAddAdmin() {
    if (!newEmail.trim()) return
    setAddLoading(true)
    setFeedback('')
    const result = await addAdmin(newEmail)
    if (result.error) {
      setFeedback(result.error)
    } else {
      setFeedback(`${newEmail.trim()} added as admin`)
      setNewEmail('')
      router.refresh()
    }
    setAddLoading(false)
  }

  async function handleRemoveAdmin(email: string) {
    setRemoveLoading(email)
    setFeedback('')
    const result = await removeAdmin(email)
    if (result.error) {
      setFeedback(result.error)
    } else {
      setFeedback(`${email} removed from admins`)
      router.refresh()
    }
    setRemoveLoading(null)
  }

  return (
    <div className="space-y-6">
      {/* Add admin */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Add Admin
        </h2>
        <div className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddAdmin()}
            placeholder="user@example.com"
            className="flex-1 rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          <Button size="sm" variant="primary" loading={addLoading} onClick={handleAddAdmin}>
            Add
          </Button>
        </div>
        {feedback && (
          <p className="mt-2 text-xs text-slate-400">{feedback}</p>
        )}
      </div>

      {/* Users table */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-700/50 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-6 py-3">User</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3">Entries</th>
              <th className="px-6 py-3">Submission Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60">
            {users.map((user) => (
              <tr key={user.email} className="align-top">
                <td className="px-6 py-4 font-medium text-slate-200">{user.email}</td>
                <td className="px-6 py-4">
                  {user.isEnvAdmin ? (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
                      Super Admin
                    </span>
                  ) : user.isDbAdmin ? (
                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">
                      Admin
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">User</span>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-300">
                  {user.entries.length === 0 ? (
                    <span className="text-xs text-slate-500">None</span>
                  ) : (
                    <span>{user.entries.length}</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {user.entries.length === 0 ? (
                    <span className="text-xs text-slate-500">—</span>
                  ) : (
                    <div className="space-y-2">
                      {user.entries.map((entry) => (
                        <div key={entry.id}>
                          <p className="text-xs font-medium text-slate-300 mb-1">{entry.name}</p>
                          <div className="flex flex-wrap gap-1">
                            {entry.rounds
                              .filter((r) => r.matchCount > 0)
                              .map((r) => {
                                const isActive = r.status === 'locked' || r.status === 'completed'
                                const complete = r.filledCount >= r.matchCount
                                const none = r.filledCount === 0

                                if (!isActive) {
                                  return (
                                    <span
                                      key={r.roundId}
                                      className="rounded px-1.5 py-0.5 text-xs bg-slate-700 text-slate-500"
                                      title={`${r.roundLabel}: ${r.status}`}
                                    >
                                      {r.roundLabel}
                                    </span>
                                  )
                                }
                                return (
                                  <span
                                    key={r.roundId}
                                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                                      complete
                                        ? 'bg-green-500/20 text-green-400'
                                        : none
                                        ? 'bg-red-500/20 text-red-400'
                                        : 'bg-yellow-500/20 text-yellow-400'
                                    }`}
                                    title={`${r.roundLabel}: ${r.filledCount}/${r.matchCount} filled`}
                                  >
                                    {r.roundLabel} {r.filledCount}/{r.matchCount}
                                  </span>
                                )
                              })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  {user.isDbAdmin && !user.isEnvAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={removeLoading === user.email}
                      onClick={() => handleRemoveAdmin(user.email)}
                      className="text-red-400 hover:text-red-300"
                    >
                      Remove admin
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
