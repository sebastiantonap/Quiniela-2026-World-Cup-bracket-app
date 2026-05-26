import type { Database, RoundName, RoundStatus } from './database'

export type { RoundName, RoundStatus }

export type Team = Database['public']['Tables']['teams']['Row']
export type Group = Database['public']['Tables']['groups']['Row']
export type Round = Database['public']['Tables']['rounds']['Row']
export type Match = Database['public']['Tables']['matches']['Row']
export type Entry = Database['public']['Tables']['entries']['Row']
export type Prediction = Database['public']['Tables']['predictions']['Row']

export interface MatchWithTeams extends Match {
  home_team: Team | null
  away_team: Team | null
  winner_team: Team | null
  round: Round
  group: Group | null
}

export interface GroupWithTeams extends Group {
  teams: Team[]
  matches: MatchWithTeams[]
}

export interface EntryWithPredictions extends Entry {
  predictions: Record<string, Prediction>
}

export interface LeaderboardRow {
  entry_id: string
  user_email: string
  entry_name: string
  total_points: number
  created_at: string
  predictions_count: number
  rank: number
}

export interface TeamStanding {
  team: Team
  played: number
  won: number
  drawn: number
  lost: number
  goals_for: number
  goals_against: number
  goal_difference: number
  points: number
}

export interface QualPick {
  predicted1st: string | null
  predicted2nd: string | null
  predicted3rd: string | null
  pointsAwarded: number | null
}

export type QualState = Record<string, QualPick>
