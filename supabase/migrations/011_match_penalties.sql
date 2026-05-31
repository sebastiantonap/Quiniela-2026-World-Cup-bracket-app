-- ============================================================
-- 011: Record penalty-shootout scores for knockout matches.
-- When a knockout match is tied after regulation, the shootout
-- decides the winner. These columns store the shootout score so
-- it can be displayed ("1–1, 4–2 pens"); winner_team_id still
-- holds who actually advances.
-- Group-stage matches leave these NULL (draws are allowed).
-- ============================================================

ALTER TABLE matches ADD COLUMN home_penalties INT;
ALTER TABLE matches ADD COLUMN away_penalties INT;
