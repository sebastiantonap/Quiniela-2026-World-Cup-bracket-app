-- ============================================================
-- Per-email 4-digit PIN credentials for email + PIN login.
-- Identity is the email string (entries.user_email); this table
-- holds the secret needed to create a session for that email.
-- ============================================================

CREATE TABLE user_credentials (
  email           TEXT        PRIMARY KEY,
  pin_hash        TEXT        NOT NULL,        -- scrypt derived key (hex)
  pin_salt        TEXT        NOT NULL,        -- random 16-byte salt (hex)
  failed_attempts INT         NOT NULL DEFAULT 0,
  locked_until    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS with NO policies. The app reads/writes this table only through the
-- service-role key (getSupabaseAdminClient), which bypasses RLS — so this blocks the
-- public anon role from reading PIN hashes via the REST API without affecting the app.
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
