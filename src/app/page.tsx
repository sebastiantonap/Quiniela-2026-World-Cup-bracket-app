import { MagicLinkForm } from '@/components/auth/MagicLinkForm'

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mb-4 text-5xl">⚽</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">
            Quiniela 2026
          </h1>
          <p className="mt-2 text-slate-400">
            Predict scores for every 2026 FIFA World Cup match and climb the leaderboard.
          </p>
        </div>

        {/* Features */}
        <div className="mb-8 grid grid-cols-3 gap-4 text-center text-sm">
          {[
            { icon: '📋', label: 'Fill your bracket' },
            { icon: '🏆', label: 'Earn points' },
            { icon: '📊', label: 'Beat the table' },
          ].map(({ icon, label }) => (
            <div
              key={label}
              className="rounded-xl border border-slate-700 bg-slate-800 p-4"
            >
              <div className="mb-1 text-2xl">{icon}</div>
              <p className="font-medium text-slate-300">{label}</p>
            </div>
          ))}
        </div>

        {/* Auth card */}
        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-8">
          <h2 className="mb-1 text-lg font-semibold text-slate-100">Sign in to play</h2>
          <p className="mb-6 text-sm text-slate-400">
            Enter your email to get a magic link — no password needed.
          </p>
          <MagicLinkForm />
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          No account needed — just your email address.
        </p>
      </div>
    </main>
  )
}
