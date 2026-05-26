'use client'

import { useState, useRef, useCallback } from 'react'
import { upsertQualification } from '@/actions/qualifications'
import type { QualPick, QualState } from '@/types/app'

export function useQualifications(entryId: string, initialQuals: QualState) {
  const [quals, setQuals] = useState<QualState>(initialQuals)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Ref tracks latest state so debounce closure always reads fresh values
  const qualsRef = useRef<QualState>(initialQuals)
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const updateQualification = useCallback(
    (groupId: string, updates: Partial<QualPick>) => {
      setQuals((prev) => {
        const next: QualState = {
          ...prev,
          [groupId]: { ...prev[groupId], ...updates } as QualPick,
        }
        qualsRef.current = next
        return next
      })

      clearTimeout(timers.current[groupId])
      timers.current[groupId] = setTimeout(async () => {
        const current = qualsRef.current[groupId] ?? {}
        setSaving((s) => ({ ...s, [groupId]: true }))
        const result = await upsertQualification(
          entryId,
          groupId,
          current.predicted1st ?? null,
          current.predicted2nd ?? null,
          current.predicted3rd ?? null
        )
        setSaving((s) => ({ ...s, [groupId]: false }))
        if (result.error) {
          setErrors((e) => ({ ...e, [groupId]: result.error! }))
        } else {
          setErrors((e) => {
            const next = { ...e }
            delete next[groupId]
            return next
          })
        }
      }, 800)
    },
    [entryId]
  )

  return { quals, updateQualification, saving, errors }
}
