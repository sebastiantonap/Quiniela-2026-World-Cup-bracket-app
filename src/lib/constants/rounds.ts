import type { RoundName } from '@/types/app'

export const ROUND_POINTS: Record<RoundName, { winner: number; bonus: number }> = {
  group_stage:   { winner: 2,  bonus: 2  },
  round_of_32:   { winner: 3,  bonus: 2  },
  round_of_16:   { winner: 5,  bonus: 2  },
  quarterfinals: { winner: 7,  bonus: 2  },
  semifinals:    { winner: 9,  bonus: 4  },
  third_place:   { winner: 11, bonus: 4  },
  final:         { winner: 16, bonus: 4  },
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
