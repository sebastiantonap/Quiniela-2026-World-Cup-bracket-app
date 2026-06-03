-- Extend leaderboard accuracy metrics to cover all three scoring tracks.
--
-- Previously `correct_predictions` and `scored_predictions` were computed only from the
-- `predictions` table (match-score picks). Points earned via `group_qualifications` and
-- `entry_best_third_selections` already flow into `total_points`, but were invisible to
-- the accuracy counts — understating accuracy for everyone.
--
-- The qualification / best-third contributions are pre-aggregated to one row per entry
-- (scalar CTEs joined on entry_id) so they do NOT multiply the one-to-many predictions
-- join. `total_points`, `rank`, `rank_delta`, and ordering are unchanged.

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
      )
        + COALESCE(gq.correct, 0)
        + COALESCE(bt.correct, 0)
                        AS correct_predictions,
      COUNT(p.id) FILTER (
        WHERE p.calculated_at IS NOT NULL
      )
        + COALESCE(gq.scored, 0)
        + COALESCE(bt.scored, 0)
                        AS scored_predictions,
      RANK() OVER (ORDER BY e.total_points DESC) AS rank
    FROM entries e
    LEFT JOIN predictions p ON p.entry_id = e.id
    LEFT JOIN (
      SELECT
        entry_id,
        COUNT(*) FILTER (WHERE calculated_at IS NOT NULL AND points_awarded > 0) AS correct,
        COUNT(*) FILTER (WHERE calculated_at IS NOT NULL)                         AS scored
      FROM group_qualifications
      GROUP BY entry_id
    ) gq ON gq.entry_id = e.id
    LEFT JOIN (
      SELECT
        entry_id,
        COUNT(*) FILTER (WHERE calculated_at IS NOT NULL AND points_awarded > 0) AS correct,
        COUNT(*) FILTER (WHERE calculated_at IS NOT NULL)                         AS scored
      FROM entry_best_third_selections
      GROUP BY entry_id
    ) bt ON bt.entry_id = e.id
    GROUP BY
      e.id, e.user_email, e.name, e.total_points, e.created_at, e.rank_snapshot,
      gq.correct, gq.scored, bt.correct, bt.scored
  ) sub
  ORDER BY rank, created_at ASC;
