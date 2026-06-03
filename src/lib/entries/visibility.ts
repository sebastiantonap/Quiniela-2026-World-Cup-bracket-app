import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { getSessionEmail } from '@/lib/session'
import { isAdmin } from '@/lib/auth/isAdmin'
import { ROUND_ORDER } from '@/lib/constants/rounds'
import type { RoundName, RoundStatus } from '@/types/app'

// A round's picks become visible to people other than the entry owner only once the
// round is locked. Earlier rounds therefore stay visible as the tournament advances,
// while the currently-open round (and any later round) stays hidden from competitors.
export const REVEALED_STATUSES: RoundStatus[] = ['locked', 'completed']
export const isRevealedStatus = (s: RoundStatus): boolean => REVEALED_STATUSES.includes(s)

export interface EntryVisibility {
  viewerEmail: string | null
  isOwner: boolean
  isAdmin: boolean
  /** Owner and admins see everything regardless of round status. */
  revealsAll: boolean
  /** Round names whose picks this viewer is allowed to see for this entry. */
  revealedRounds: Set<RoundName>
}

/**
 * Authoritative visibility gate for an entry's picks. Resolves the current viewer, the
 * entry owner, and admin status, then computes which rounds' picks the viewer may see.
 *
 * This is the single source of truth used by the pick getters
 * (predictions / qualifications / best-third) so the gate can't be bypassed by calling
 * a server action directly, and by the entry page to drive the read-only UI.
 */
export async function resolveEntryVisibility(entryId: string): Promise<EntryVisibility> {
  const supabase = getSupabaseAdminClient()

  const [viewerEmail, { data: entry }] = await Promise.all([
    getSessionEmail(),
    supabase.from('entries').select('user_email').eq('id', entryId).single(),
  ])

  const ownerEmail = entry?.user_email ?? null
  const isOwner = !!viewerEmail && !!ownerEmail && viewerEmail === ownerEmail
  const viewerIsAdmin = isOwner ? false : await isAdmin(viewerEmail)
  const revealsAll = isOwner || viewerIsAdmin

  let revealedRounds: Set<RoundName>
  if (revealsAll) {
    revealedRounds = new Set(ROUND_ORDER)
  } else {
    const { data: rounds } = await supabase.from('rounds').select('name, status')
    revealedRounds = new Set(
      (rounds ?? [])
        .filter((r) => isRevealedStatus(r.status))
        .map((r) => r.name as RoundName)
    )
  }

  return { viewerEmail, isOwner, isAdmin: viewerIsAdmin, revealsAll, revealedRounds }
}
