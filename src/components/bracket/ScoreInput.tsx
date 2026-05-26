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
      className={`w-12 rounded-lg border border-gray-300 px-2 py-1.5 text-center text-sm font-semibold outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 ${className}`}
      {...props}
    />
  )
}
