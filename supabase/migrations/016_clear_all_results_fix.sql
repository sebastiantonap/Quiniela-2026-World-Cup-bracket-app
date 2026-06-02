-- ============================================================
-- 016: Fix + expand clear_all_results
--
-- FIX (button was broken):
--   The PostgREST connection role (authenticator) loads the
--   `safeupdate` library via session_preload_libraries, which
--   rejects any WHERE-less UPDATE/DELETE with the error
--   "UPDATE requires a WHERE clause". Migration 015's bare
--   `UPDATE matches SET ...` (Step 1) therefore aborted the whole
--   function, and the admin "Clear All Results" button failed.
--   Every UPDATE here now carries an explicit WHERE clause.
--
-- EXPAND (product decision):
--   Also reset the leaderboard so a wipe is reflected immediately.
--   total_points is the sum of points_awarded across predictions,
--   group_qualifications, and entry_best_third_selections, so all
--   three are zeroed alongside entries.total_points / rank_snapshot.
--
-- Scope (admin-controlled data + derived scoring):
--   * matches: scores, penalties, winner, confirmation, manual-override
--   * matches: knockout home/away team assignments
--   * teams.best_third_qualified
--   * scoring: predictions / group_qualifications /
--     entry_best_third_selections (points_awarded + calculated_at,
--     predictions.qualification_gated), entries.total_points + rank_snapshot
--   * change_log: single audit row
--
-- Preserves the user's actual PICKS (predicted scores/winners,
-- qualification picks, best-third selections) — only their *awarded
-- points* are cleared, so a later recalculation rebuilds them.
-- Group standings are derived in-app from match results and reset
-- automatically once results are cleared (no table to touch).
-- ============================================================

CREATE OR REPLACE FUNCTION clear_all_results(admin_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Clear scores/results on ALL matches
  UPDATE matches SET
    home_score         = NULL,
    away_score         = NULL,
    home_penalties     = NULL,
    away_penalties     = NULL,
    winner_team_id     = NULL,
    result_confirmed   = FALSE,
    is_manual_override = FALSE
  WHERE id IS NOT NULL;

  -- 2. Clear knockout team assignments (non-group-stage matches)
  UPDATE matches SET
    home_team_id = NULL,
    away_team_id = NULL
  WHERE round_id IN (
    SELECT id FROM rounds WHERE name <> 'group_stage'
  );

  -- 3. Reset best-third-qualified flags on all teams
  UPDATE teams SET best_third_qualified = FALSE
  WHERE best_third_qualified = TRUE;

  -- 4. Clear awarded scoring (picks themselves are preserved)
  UPDATE predictions SET
    points_awarded      = NULL,
    qualification_gated = FALSE,
    calculated_at       = NULL
  WHERE id IS NOT NULL;

  UPDATE group_qualifications SET
    points_awarded = NULL,
    calculated_at  = NULL
  WHERE id IS NOT NULL;

  UPDATE entry_best_third_selections SET
    points_awarded = NULL,
    calculated_at  = NULL
  WHERE id IS NOT NULL;

  -- 5. Zero the leaderboard
  UPDATE entries SET
    total_points  = 0,
    rank_snapshot = NULL,
    updated_at    = now()
  WHERE id IS NOT NULL;

  -- 6. Log the bulk clear
  INSERT INTO change_log (entity_type, entity_id, field, old_value, new_value, source, changed_by)
  VALUES ('system', '00000000-0000-0000-0000-000000000000', 'clear_all_results', NULL, NULL, 'manual', admin_email);
END;
$$;

-- Only the service role should call this; revoke from anon/authenticated.
REVOKE ALL ON FUNCTION clear_all_results(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION clear_all_results(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION clear_all_results(TEXT) TO service_role;
