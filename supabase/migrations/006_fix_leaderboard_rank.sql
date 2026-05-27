-- Fix leaderboard rank: tied players should share the same rank.
-- Remove created_at from the RANK() window so equal total_points → equal rank.

DROP VIEW IF EXISTS leaderboard;

CREATE VIEW leaderboard AS
  SELECT
    e.id         AS entry_id,
    e.user_email,
    e.name       AS entry_name,
    e.total_points,
    e.created_at,
    COUNT(p.id) FILTER (
      WHERE p.predicted_home IS NOT NULL
         OR p.predicted_winner_team_id IS NOT NULL
    )            AS predictions_count,
    RANK() OVER (ORDER BY e.total_points DESC) AS rank
  FROM entries e
  LEFT JOIN predictions p ON p.entry_id = e.id
  GROUP BY e.id, e.user_email, e.name, e.total_points, e.created_at
  ORDER BY rank, e.created_at ASC;
