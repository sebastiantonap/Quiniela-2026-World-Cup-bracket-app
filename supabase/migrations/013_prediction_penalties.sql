-- ============================================================
-- 013: Let users predict a penalty shootout for knockout matches.
-- Only meaningful when the user predicts a regulation tie. The exact-score
-- bonus for a shootout match is awarded on the per-team AGGREGATE
-- (regulation goals + penalty goals) matching the actual aggregate.
-- ============================================================

ALTER TABLE predictions ADD COLUMN predicted_home_penalties INT;
ALTER TABLE predictions ADD COLUMN predicted_away_penalties INT;
