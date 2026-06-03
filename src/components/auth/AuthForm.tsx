'use client'

import { useState } from 'react'
import { beginAuth, authenticate, type AuthMode } from '@/actions/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useT } from '@/lib/i18n/I18nProvider'
import type { TranslationKey } from '@/lib/i18n/dictionaries/en'

type Step = 'email' | 'code'

export function AuthForm() {
  const t = useT()
  const [step, setStep] = useState<Step>('email')
  const [mode, setMode] = useState<AuthMode>('login')
  const [locked, setLocked] = useState(false)

  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Actions return translation keys (e.g. 'auth.error.incorrect'); translate here.
  const showError = (key?: string) => setError(key ? t(key as TranslationKey) : null)

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await beginAuth(email)
    setLoading(false)
    if (result.error) {
      showError(result.error)
      return
    }
    setMode(result.mode ?? 'login')
    setLocked(!!result.locked)
    setPin('')
    setPinConfirm('')
    setStep('code')
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    // authenticate redirects on success; if it returns, it's an error.
    const result = await authenticate({
      email,
      pin,
      pinConfirm: mode === 'signup' ? pinConfirm : undefined,
    })
    if (result?.error) {
      showError(result.error)
      if (result.error === 'auth.error.locked') setLocked(true)
    }
    setLoading(false)
  }

  function resetToEmail() {
    setStep('email')
    setError(null)
    setPin('')
    setPinConfirm('')
    setLocked(false)
  }

  if (step === 'email') {
    return (
      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
        <Input
          id="email"
          type="email"
          label={t('auth.emailLabel')}
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          error={error ?? undefined}
        />
        <Button type="submit" loading={loading} size="lg">
          {t('auth.continue')}
        </Button>
      </form>
    )
  }

  return (
    <form onSubmit={handleCodeSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">
        {mode === 'signup' ? t('auth.setPinHint') : t('auth.enterPinHint')}{' '}
        <span className="font-medium text-slate-300">{email}</span>
      </p>

      <Input
        id="pin"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={4}
        pattern="\d{4}"
        label={t('auth.pinLabel')}
        placeholder="••••"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
        required
        autoFocus
        error={mode === 'login' ? error ?? undefined : undefined}
      />

      {mode === 'signup' && (
        <Input
          id="pinConfirm"
          type="text"
          inputMode="numeric"
          maxLength={4}
          pattern="\d{4}"
          label={t('auth.pinConfirmLabel')}
          placeholder="••••"
          value={pinConfirm}
          onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
          required
          error={error ?? undefined}
        />
      )}

      <Button type="submit" loading={loading} size="lg" disabled={locked}>
        {mode === 'signup' ? t('auth.createCta') : t('auth.signInCta')}
      </Button>

      <button
        type="button"
        onClick={resetToEmail}
        className="text-center text-xs text-slate-500 transition hover:text-slate-300"
      >
        {t('auth.useDifferentEmail')}
      </button>
    </form>
  )
}
