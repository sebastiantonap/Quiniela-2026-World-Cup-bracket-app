-- ============================================================
-- 015: Atomic clear_all_results RPC
--
-- Wraps the multi-step "clear all admin-entered results" admin
-- action in a single Postgres function so it runs in one implicit
-- transaction. If any statement fails, the entire operation is
-- rolled back, preventing partially-cleared state.
--
-- Scope (admin-controlled data only):
--   * matches: scores, penalties, winner, confirmation, manual-override
--   * matches: knockout home/away team assignments
--   * teams.best_third_qualified
--   * change_log: single audit row
--
-- Does NOT touch: predictions, entries, group_qualifications,
-- entry_best_third_selections (user-entered data is preserved).
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
    is_manual_override = FALSE;

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

  -- 4. Log the bulk clear
  INSERT INTO change_log (entity_type, entity_id, field, old_value, new_value, source, changed_by)
  VALUES ('system', '00000000-0000-0000-0000-000000000000', 'clear_all_results', NULL, NULL, 'manual', admin_email);
END;
$$;

-- Only the service role should call this; revoke from anon/authenticated.
REVOKE ALL ON FUNCTION clear_all_results(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION clear_all_results(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION clear_all_results(TEXT) TO service_role;
