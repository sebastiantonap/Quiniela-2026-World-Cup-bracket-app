export type RoundName =
  | 'group_stage'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarterfinals'
  | 'semifinals'
  | 'third_place'
  | 'final'

export type RoundStatus =
  | 'pending'
  | 'accepting_predictions'
  | 'locked'
  | 'completed'

export interface Database {
  public: {
    Tables: {
      groups: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['groups']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['groups']['Insert']>
      }
      teams: {
        Row: {
          id: string
          name: string
          code: string
          flag_emoji: string | null
          group_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['teams']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['teams']['Insert']>
      }
      rounds: {
        Row: {
          id: string
          name: RoundName
          status: RoundStatus
          sort_order: number
          calculating: boolean
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['rounds']['Row'], 'updated_at'>
        Update: Partial<Database['public']['Tables']['rounds']['Insert']>
      }
      matches: {
        Row: {
          id: string
          round_id: string
          group_id: string | null
          match_number: number
          home_team_id: string | null
          away_team_id: string | null
          placeholder_home: string | null
          placeholder_away: string | null
          scheduled_at: string | null
          venue: string | null
          home_score: number | null
          away_score: number | null
          winner_team_id: string | null
          result_confirmed: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['matches']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['matches']['Insert']>
      }
      entries: {
        Row: {
          id: string
          user_id: string
          name: string
          total_points: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['entries']['Row'],
          'created_at' | 'updated_at' | 'total_points'
        >
        Update: Partial<Database['public']['Tables']['entries']['Insert']>
      }
      predictions: {
        Row: {
          id: string
          entry_id: string
          match_id: string
          predicted_home: number | null
          predicted_away: number | null
          predicted_winner_team_id: string | null
          points_awarded: number | null
          calculated_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['predictions']['Row'],
          'created_at' | 'updated_at' | 'id'
        >
        Update: Partial<Database['public']['Tables']['predictions']['Insert']>
      }
    }
    Views: {
      leaderboard: {
        Row: {
          entry_id: string
          entry_name: string
          user_email: string
          total_points: number
          created_at: string
          rank: number
        }
      }
    }
  }
}
