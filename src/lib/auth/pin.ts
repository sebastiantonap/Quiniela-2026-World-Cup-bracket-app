import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const KEY_LENGTH = 32

/** A valid PIN is exactly 4 digits. */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin)
}

/** Hash a PIN with a fresh random salt. Returns hex-encoded hash + salt to store. */
export function hashPin(pin: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(pin, salt, KEY_LENGTH).toString('hex')
  return { hash, salt }
}

/** Constant-time verification of a PIN against a stored hash + salt. */
export function verifyPin(pin: string, hash: string, salt: string): boolean {
  const derived = scryptSync(pin, salt, KEY_LENGTH)
  const stored = Buffer.from(hash, 'hex')
  // timingSafeEqual throws on length mismatch — guard first.
  if (derived.length !== stored.length) return false
  return timingSafeEqual(derived, stored)
}
