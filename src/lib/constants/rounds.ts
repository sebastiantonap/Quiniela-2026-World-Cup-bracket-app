import type { RoundName } from '@/types/app'

export const ROUND_POINTS: Record<RoundName, { winner: number; bonus: number }> = {
  group_stage:   { winner: 1,  bonus: 2  },
  round_of_32:   { winner: 2,  bonus: 3  },
  round_of_16:   { winner: 4,  bonus: 5  },
  quarterfinals: { winner: 6,  bonus: 7  },
  semifinals:    { winner: 8,  bonus: 9  },
  third_place:   { winner: 3,  bonus: 4  },
  final:         { winner: 10, bonus: 11 },
}

export const ROUND_LABELS: Record<RoundName, string> = {
  group_stage:   'Group Stage',
  round_of_32:   'Round of 32',
  round_of_16:   'Round of 16',
  quarterfinals: 'Quarterfinals',
  semifinals:    'Semifinals',
  third_place:   '3rd Place',
  final:         'Final',
}

export const ROUND_ORDER: RoundName[] = [
  'group_stage',
  'round_of_32',
  'round_of_16',
  'quarterfinals',
  'semifinals',
  'third_place',
  'final',
]

export const GROUP_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L'] as const
export type GroupLetter = typeof GROUP_LETTERS[number]
