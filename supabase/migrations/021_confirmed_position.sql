-- Add an admin-overridable group standings position. When all four teams in a
-- group have this column set (1-4), the scoring engine uses it instead of the
-- computed standings (which fall back to alphabetical on a full tie). This lets
-- the admin record FIFA's official tiebreaker order (H2H, fair play, drawing
-- of lots) that the app cannot compute deterministically.

ALTER TABLE teams ADD COLUMN confirmed_position SMALLINT;
