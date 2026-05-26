-- ============================================================
-- GROUP QUALIFICATIONS
-- One row per (entry, group): predicted 1st/2nd/3rd place finisher
-- ============================================================

CREATE TABLE group_qualifications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id              UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  group_id              UUID NOT NULL REFERENCES groups(id),
  predicted_1st_team_id UUID REFERENCES teams(id),
  predicted_2nd_team_id UUID REFERENCES teams(id),
  predicted_3rd_team_id UUID REFERENCES teams(id),
  points_awarded        INT,
  calculated_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entry_id, group_id)
);

ALTER TABLE group_qualifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gq_owner_all" ON group_qualifications
  FOR ALL USING (
    entry_id IN (SELECT id FROM entries WHERE user_id = auth.uid())
  );

CREATE POLICY "gq_public_read" ON group_qualifications
  FOR SELECT USING (true);

CREATE INDEX idx_gq_entry ON group_qualifications(entry_id);
CREATE INDEX idx_gq_group  ON group_qualifications(group_id);

-- ============================================================
-- UPDATE LEADERBOARD VIEW
-- Add user_id and predictions_count
-- ============================================================

DROP VIEW leaderboard;

CREATE VIEW leaderboard AS
  SELECT
    e.id            AS entry_id,
    e.user_id,
    e.name          AS entry_name,
    u.email         AS user_email,
    e.total_points,
    e.created_at,
    COUNT(p.id) FILTER (
      WHERE p.predicted_home IS NOT NULL
         OR p.predicted_winner_team_id IS NOT NULL
    )               AS predictions_count,
    RANK() OVER (ORDER BY e.total_points DESC, e.created_at ASC) AS rank
  FROM entries e
  JOIN auth.users u ON u.id = e.user_id
  LEFT JOIN predictions p ON p.entry_id = e.id
  GROUP BY e.id, e.user_id, e.name, u.email, e.total_points, e.created_at
  ORDER BY rank;
