/**
 * Football-data.org API client — server-side only.
 * Reads FOOTBALL_DATA_API_KEY from env. Never import from client components.
 */

const BASE_URL = 'https://api.football-data.org/v4'
const COMPETITION = 'WC'

function getApiKey(): string {
  const key = process.env.FOOTBALL_DATA_API_KEY
  if (!key) throw new Error('FOOTBALL_DATA_API_KEY env var is not set')
  return key
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'X-Auth-Token': getApiKey() },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`football-data.org ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// -- Match types --

export interface FdScore {
  home: number | null
  away: number | null
}

export interface FdMatch {
  id: number
  status: string
  stage: string
  group: string | null
  matchday: number
  utcDate: string
  score: {
    winner: string | null
    duration: string
    fullTime: FdScore
    halfTime: FdScore
    regularTime: FdScore
    penalties: FdScore
  }
  homeTeam: { id: number; name: string; shortName: string; tla: string; crest: string }
  awayTeam: { id: number; name: string; shortName: string; tla: string; crest: string }
}

interface MatchesResponse {
  matches: FdMatch[]
}

export async function fetchWCMatches(): Promise<FdMatch[]> {
  const data = await apiFetch<MatchesResponse>(
    `/competitions/${COMPETITION}/matches`
  )
  return data.matches
}

// -- Team types --

export interface FdTeam {
  id: number
  name: string
  shortName: string
  tla: string
  crest: string
}

interface TeamsResponse {
  teams: FdTeam[]
}

export async function fetchWCTeams(): Promise<FdTeam[]> {
  const data = await apiFetch<TeamsResponse>(
    `/competitions/${COMPETITION}/teams`
  )
  return data.teams
}
