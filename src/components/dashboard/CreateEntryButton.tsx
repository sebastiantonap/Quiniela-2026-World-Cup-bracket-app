'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createEntry } from '@/actions/entries'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useT } from '@/lib/i18n/I18nProvider'

export function CreateEntryButton() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)

    const result = await createEntry(name)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    router.push(`/entries/${result.id}`)
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t('createEntry.new')}</Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-100">{t('createEntry.modalTitle')}</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <Input
                id="bracket-name"
                label={t('createEntry.nameLabel')}
                placeholder={t('createEntry.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                maxLength={50}
                error={error ?? undefined}
              />
              <div className="flex gap-3">
                <Button type="submit" loading={loading} className="flex-1">
                  {t('common.create')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => { setOpen(false); setError(null); setName('') }}
                  className="flex-1"
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
