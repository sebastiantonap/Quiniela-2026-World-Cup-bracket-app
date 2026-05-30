CREATE TABLE entry_best_third_selections (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id       UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  team_id        UUID NOT NULL REFERENCES teams(id),
  points_awarded INT,
  calculated_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (entry_id, team_id)
);

CREATE INDEX ON entry_best_third_selections (entry_id);
