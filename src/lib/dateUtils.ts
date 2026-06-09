/**
 * Timezone-aware date formatting utilities.
 * All display dates are converted to America/Mexico_City (CST/CDT)
 * so that match dates align with the local schedule.
 */

const TIMEZONE = 'America/Mexico_City'

/**
 * Format a UTC date string as dd/mm in CST (America/Mexico_City).
 */
export function formatDateDDMM(utcDateStr: string): string {
  const d = new Date(utcDateStr)
  const day = d.toLocaleDateString('en-US', { timeZone: TIMEZONE, day: '2-digit' })
  const month = d.toLocaleDateString('en-US', { timeZone: TIMEZONE, month: '2-digit' })
  return `${day}/${month}`
}

/**
 * Format a UTC date string for export display (e.g. "Jun 14") in CST.
 */
export function formatDateForExport(utcDateStr: string): string {
  return new Date(utcDateStr).toLocaleDateString('en-US', {
    timeZone: TIMEZONE,
    month: 'short',
    day: 'numeric',
  })
}
