'use client'

import { useState } from 'react'
import { signInWithMagicLink } from '@/actions/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function MagicLinkForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await signInWithMagicLink(email)

    if (result.error) {
      setError(result.error)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-green-800/40 bg-green-900/20 p-6 text-center">
        <div className="mb-2 text-2xl">📬</div>
        <h3 className="font-semibold text-green-400">Check your inbox</h3>
        <p className="mt-1 text-sm text-green-500">
          We sent a magic link to <strong>{email}</strong>. Click it to sign in.
        </p>
        <button
          onClick={() => { setSent(false); setEmail('') }}
          className="mt-4 text-sm text-green-400 underline hover:text-green-300"
        >
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        id="email"
        type="email"
        label="Email address"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoFocus
        error={error ?? undefined}
      />
      <Button type="submit" loading={loading} size="lg">
        Send magic link
      </Button>
    </form>
  )
}
