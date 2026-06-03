'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addAdmin, removeAdmin } from '@/actions/admin/manageAdmins'
import { resetUserPin } from '@/actions/admin/users'
import { adminDeleteEntry } from '@/actions/entries'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n/I18nProvider'
import { roundLabel } from '@/lib/i18n/translator'
import type { TranslationKey } from '@/lib/i18n/dictionaries/en'
import type { AdminUserRow } from '@/actions/admin/users'

interface UserManagerProps {
  users: AdminUserRow[]
}

export function UserManager({ users }: UserManagerProps) {
  const t = useT()
  const [newEmail, setNewEmail] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [removeLoading, setRemoveLoading] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [resetPinLoading, setResetPinLoading] = useState<string | null>(null)
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
      setFeedback(t('admin.users.addedAsAdmin', { email: newEmail.trim() }))
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
      setFeedback(t('admin.users.removedFromAdmins', { email }))
      router.refresh()
    }
    setRemoveLoading(null)
  }

  async function handleResetPin(email: string) {
    const confirmed = window.confirm(t('admin.users.resetCodeConfirm', { email }))
    if (!confirmed) return

    setResetPinLoading(email)
    setFeedback('')
    const result = await resetUserPin(email)
    if (result.error) {
      setFeedback(result.error)
    } else {
      setFeedback(t('admin.users.codeReset', { email }))
      router.refresh()
    }
    setResetPinLoading(null)
  }

  async function handleDeleteEntry(entryId: string, entryName: string, userEmail: string) {
    const confirmed = window.confirm(t('admin.users.deleteEntryConfirm', { name: entryName, email: userEmail }))
    if (!confirmed) return

    setDeleteLoading(entryId)
    setFeedback('')
    const result = await adminDeleteEntry(entryId)
    if (result.error) {
      setFeedback(result.error)
    } else {
      setFeedback(t('admin.users.entryDeleted', { name: entryName }))
      router.refresh()
    }
    setDeleteLoading(null)
  }

  return (
    <div className="space-y-6">
      {/* Add admin */}
      <div className="rounded-2xl bg-slate-800 border border-slate-700 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          {t('admin.users.addAdmin')}
        </h2>
        <div className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddAdmin()}
            placeholder={t('admin.users.addPlaceholder')}
            className="flex-1 rounded-lg bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
          />
          <Button size="sm" variant="primary" loading={addLoading} onClick={handleAddAdmin}>
            {t('common.add')}
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
              <th className="px-6 py-3">{t('admin.users.col.user')}</th>
              <th className="px-6 py-3">{t('admin.users.col.role')}</th>
              <th className="px-6 py-3">{t('admin.users.col.entries')}</th>
              <th className="px-6 py-3">{t('admin.users.col.submission')}</th>
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
                      {t('admin.users.superAdmin')}
                    </span>
                  ) : user.isDbAdmin ? (
                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">
                      {t('admin.users.admin')}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">{t('admin.users.user')}</span>
                  )}
                  <div className="mt-1">
                    {user.hasPin ? (
                      <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-400">
                        {t('admin.users.codeSet')}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-600/40 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                        {t('admin.users.noCode')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-300">
                  {user.entries.length === 0 ? (
                    <span className="text-xs text-slate-500">{t('admin.users.none')}</span>
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
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-xs font-medium text-slate-300">{entry.name}</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={deleteLoading === entry.id}
                              onClick={() => handleDeleteEntry(entry.id, entry.name, user.email)}
                              className="text-red-400 hover:text-red-300 text-xs !px-1.5 !py-0.5"
                            >
                              {t('admin.users.deleteEntry')}
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {entry.rounds
                              .filter((r) => r.matchCount > 0)
                              .map((r) => {
                                const isActive = r.status === 'locked' || r.status === 'completed'
                                const complete = r.filledCount >= r.matchCount
                                const none = r.filledCount === 0

                                const rLabel = roundLabel(t, r.roundName)
                                const statusLabel = t(`status.${r.status}` as TranslationKey)

                                if (!isActive) {
                                  return (
                                    <span
                                      key={r.roundId}
                                      className="rounded px-1.5 py-0.5 text-xs bg-slate-700 text-slate-500"
                                      title={`${rLabel}: ${statusLabel}`}
                                    >
                                      {rLabel}
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
                                    title={`${rLabel}: ${r.filledCount}/${r.matchCount} ${t('admin.users.filled')}`}
                                  >
                                    {rLabel} {r.filledCount}/{r.matchCount}
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
                  <div className="flex flex-col items-start gap-1">
                    {user.isDbAdmin && !user.isEnvAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={removeLoading === user.email}
                        onClick={() => handleRemoveAdmin(user.email)}
                        className="text-red-400 hover:text-red-300"
                      >
                        {t('admin.users.removeAdmin')}
                      </Button>
                    )}
                    {user.hasPin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={resetPinLoading === user.email}
                        onClick={() => handleResetPin(user.email)}
                        className="text-amber-400 hover:text-amber-300"
                      >
                        {t('admin.users.resetCode')}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
