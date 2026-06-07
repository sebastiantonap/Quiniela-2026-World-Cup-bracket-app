'use client'

import { InputHTMLAttributes } from 'react'

interface ScoreInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | null
  onChange: (value: number | null) => void
  disabled?: boolean
}

export function ScoreInput({ value, onChange, disabled, className = '', ...props }: ScoreInputProps) {
  return (
    <input
      type="number"
      min={0}
      max={99}
      value={value ?? ''}
      onChange={(e) => {
        const val = e.target.value
        if (val === '') {
          onChange(null)
        } else {
          const n = parseInt(val, 10)
          if (!isNaN(n) && n >= 0 && n <= 99) onChange(n)
        }
      }}
      disabled={disabled}
      className={`w-10 rounded-lg border border-slate-600 bg-slate-700 px-1 py-1.5 text-center text-sm font-semibold text-slate-100 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 ${className}`}
      {...props}
    />
  )
}
