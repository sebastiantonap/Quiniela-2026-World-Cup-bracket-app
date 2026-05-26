'use client'

import { useCallback, useRef, useState } from 'react'
import { upsertPrediction } from '@/actions/predictions'
import type { Prediction } from '@/types/app'

interface PredictionState {
  predictedHome: number | null
  predictedAway: number | null
  predictedWinnerTeamId: string | null
}

type PredictionMap = Record<string, Prediction>

export function usePredictions(
  entryId: string,
  initialPredictions: PredictionMap
) {
  const [predictions, setPredictions] = useState<PredictionMap>(initialPredictions)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const savePrediction = useCallback(
    async (matchId: string, input: PredictionState) => {
      setSaving((prev) => ({ ...prev, [matchId]: true }))
      setErrors((prev) => { const next = { ...prev }; delete next[matchId]; return next })

      const result = await upsertPrediction({
        entryId,
        matchId,
        predictedHome: input.predictedHome,
        predictedAway: input.predictedAway,
        predictedWinnerTeamId: input.predictedWinnerTeamId,
      })

      if (result.error) {
        if (result.error === 'session_expired') {
          setErrors((prev) => ({ ...prev, [matchId]: 'Session expired — please sign in again.' }))
        } else {
          setErrors((prev) => ({ ...prev, [matchId]: result.error! }))
        }
        // Rollback optimistic update
        setPredictions((prev) => {
          const next = { ...prev }
          if (initialPredictions[matchId]) {
            next[matchId] = initialPredictions[matchId]
          } else {
            delete next[matchId]
          }
          return next
        })
      }

      setSaving((prev) => { const next = { ...prev }; delete next[matchId]; return next })
    },
    [entryId, initialPredictions]
  )

  const updatePrediction = useCallback(
    (matchId: string, input: PredictionState) => {
      // Optimistic update
      setPredictions((prev) => ({
        ...prev,
        [matchId]: {
          ...(prev[matchId] ?? {
            id: '',
            entry_id: entryId,
            match_id: matchId,
            points_awarded: null,
            calculated_at: null,
            created_at: '',
            updated_at: '',
          }),
          predicted_home: input.predictedHome,
          predicted_away: input.predictedAway,
          predicted_winner_team_id: input.predictedWinnerTeamId,
        } as Prediction,
      }))

      // Debounce save
      if (debounceTimers.current[matchId]) {
        clearTimeout(debounceTimers.current[matchId])
      }
      debounceTimers.current[matchId] = setTimeout(() => {
        savePrediction(matchId, input)
      }, 800)
    },
    [entryId, savePrediction]
  )

  return { predictions, updatePrediction, saving, errors }
}
