ALTER TABLE entries ADD COLUMN rank_snapshot INTEGER;

DROP VIEW IF EXISTS leaderboard;

CREATE VIEW leaderboard AS
  SELECT
    *,
    (COALESCE(rank_snapshot, rank))::int - rank::int AS rank_delta
  FROM (
    SELECT
      e.id              AS entry_id,
      e.user_email,
      e.name            AS entry_name,
      e.total_points,
      e.created_at,
      e.rank_snapshot,
      COUNT(p.id) FILTER (
        WHERE p.predicted_home IS NOT NULL
           OR p.predicted_winner_team_id IS NOT NULL
      )                 AS predictions_count,
      COUNT(p.id) FILTER (
        WHERE p.calculated_at IS NOT NULL AND p.points_awarded > 0
      )                 AS correct_predictions,
      COUNT(p.id) FILTER (
        WHERE p.calculated_at IS NOT NULL
      )                 AS scored_predictions,
      RANK() OVER (ORDER BY e.total_points DESC) AS rank
    FROM entries e
    LEFT JOIN predictions p ON p.entry_id = e.id
    GROUP BY e.id, e.user_email, e.name, e.total_points, e.created_at, e.rank_snapshot
  ) sub
  ORDER BY rank, created_at ASC;
