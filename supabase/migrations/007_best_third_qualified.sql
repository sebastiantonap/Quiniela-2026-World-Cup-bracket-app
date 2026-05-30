-- Track which 8 third-place teams the admin has confirmed as advancing
-- to the Round of 32. Used by Phase 5 R32 auto-assignment.
ALTER TABLE teams ADD COLUMN best_third_qualified BOOLEAN NOT NULL DEFAULT FALSE;
