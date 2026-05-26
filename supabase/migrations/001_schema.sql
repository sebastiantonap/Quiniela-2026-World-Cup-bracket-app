-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE round_name AS ENUM (
  'group_stage',
  'round_of_32',
  'round_of_16',
  'quarterfinals',
  'semifinals',
  'third_place',
  'final'
);

CREATE TYPE round_status AS ENUM (
  'pending',
  'accepting_predictions',
  'locked',
  'completed'
);

-- ============================================================
-- GROUPS  (A–L)
-- ============================================================

CREATE TABLE groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TEAMS  (48 teams)
-- ============================================================

CREATE TABLE teams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  code         TEXT NOT NULL UNIQUE,
  flag_emoji   TEXT,
  group_id     UUID REFERENCES groups(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ROUNDS  (7 rows, pre-seeded)
-- ============================================================

CREATE TABLE rounds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        round_name NOT NULL UNIQUE,
  status      round_status NOT NULL DEFAULT 'pending',
  sort_order  INT NOT NULL,
  calculating BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- MATCHES  (104 rows total)
-- Group stage: home/away team IDs known at seed time.
-- Knockout: team IDs NULL until admin fills. placeholder_* stores
-- descriptive text like "Winner Group A".
-- ============================================================

CREATE TABLE matches (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id         UUID NOT NULL REFERENCES rounds(id),
  group_id         UUID REFERENCES groups(id),
  match_number     INT NOT NULL UNIQUE,
  home_team_id     UUID REFERENCES teams(id),
  away_team_id     UUID REFERENCES teams(id),
  placeholder_home TEXT,
  placeholder_away TEXT,
  scheduled_at     TIMESTAMPTZ,
  venue            TEXT,
  -- Actual results (entered by admin)
  home_score       INT,
  away_score       INT,
  -- winner_team_id handles pens: stores who actually advances
  winner_team_id   UUID REFERENCES teams(id),
  result_confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_matches_round   ON matches(round_id);
CREATE INDEX idx_matches_group   ON matches(group_id);
CREATE INDEX idx_matches_home    ON matches(home_team_id);
CREATE INDEX idx_matches_away    ON matches(away_team_id);

-- ============================================================
-- ENTRIES  (user brackets)
-- ============================================================

CREATE TABLE entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  total_points INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX idx_entries_user   ON entries(user_id);
CREATE INDEX idx_entries_points ON entries(total_points DESC);

-- ============================================================
-- PREDICTIONS  (one row per entry × match)
-- ============================================================

CREATE TABLE predictions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id                 UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  match_id                 UUID NOT NULL REFERENCES matches(id),
  predicted_home           INT,
  predicted_away           INT,
  -- For knockout rounds: which team does the user think wins
  predicted_winner_team_id UUID REFERENCES teams(id),
  points_awarded           INT,
  calculated_at            TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now(),
  UNIQUE (entry_id, match_id)
);

CREATE INDEX idx_predictions_entry ON predictions(entry_id);
CREATE INDEX idx_predictions_match ON predictions(match_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- Entries: owners read/write; everyone reads for leaderboard
CREATE POLICY "entries_owner_write" ON entries
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "entries_public_read" ON entries
  FOR SELECT USING (true);

-- Predictions: owners read/write
CREATE POLICY "predictions_owner_write" ON predictions
  FOR ALL USING (
    entry_id IN (
      SELECT id FROM entries WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "predictions_public_read" ON predictions
  FOR SELECT USING (true);

-- ============================================================
-- LEADERBOARD VIEW
-- ============================================================

CREATE VIEW leaderboard AS
  SELECT
    e.id            AS entry_id,
    e.name          AS entry_name,
    u.email         AS user_email,
    e.total_points,
    e.created_at,
    RANK() OVER (ORDER BY e.total_points DESC, e.created_at ASC) AS rank
  FROM entries e
  JOIN auth.users u ON u.id = e.user_id
  ORDER BY rank;
