-- ============================================================
-- Replace Supabase Auth with simple email-based sessions
-- ============================================================

-- Session tokens: cookie value → email
CREATE TABLE user_sessions (
  token      TEXT        PRIMARY KEY,
  email      TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Drop dependents of entries.user_id FIRST
-- (policies, view, then the column itself)
-- ============================================================

-- Drop leaderboard view (references user_id via auth.users join)
DROP VIEW IF EXISTS leaderboard;

-- Drop all RLS policies that reference user_id
DROP POLICY IF EXISTS "entries_owner_write"     ON entries;
DROP POLICY IF EXISTS "entries_public_read"     ON entries;
DROP POLICY IF EXISTS "predictions_owner_write" ON predictions;
DROP POLICY IF EXISTS "predictions_public_read" ON predictions;
DROP POLICY IF EXISTS "gq_owner_all"            ON group_qualifications;
DROP POLICY IF EXISTS "gq_public_read"          ON group_qualifications;

-- Disable RLS — server actions own authorization now
ALTER TABLE entries              DISABLE ROW LEVEL SECURITY;
ALTER TABLE predictions          DISABLE ROW LEVEL SECURITY;
ALTER TABLE group_qualifications DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- Migrate entries: user_id → user_email
-- ============================================================

ALTER TABLE entries ADD COLUMN user_email TEXT;

-- Carry over emails from auth.users for any existing rows
UPDATE entries e
SET user_email = u.email
FROM auth.users u
WHERE u.id = e.user_id;

-- Drop orphaned rows (no matching auth user)
DELETE FROM entries WHERE user_email IS NULL;

ALTER TABLE entries ALTER COLUMN user_email SET NOT NULL;

-- Swap unique constraint
ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_user_id_name_key;
ALTER TABLE entries ADD CONSTRAINT entries_user_email_name_key UNIQUE (user_email, name);

-- Now safe to drop the column
ALTER TABLE entries DROP COLUMN user_id;

-- Swap index
DROP INDEX IF EXISTS idx_entries_user;
CREATE INDEX idx_entries_email ON entries(user_email);

-- ============================================================
-- Rebuild leaderboard view (no auth.users join needed)
-- ============================================================

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
    RANK() OVER (ORDER BY e.total_points DESC, e.created_at ASC) AS rank
  FROM entries e
  LEFT JOIN predictions p ON p.entry_id = e.id
  GROUP BY e.id, e.user_email, e.name, e.total_points, e.created_at
  ORDER BY rank;
