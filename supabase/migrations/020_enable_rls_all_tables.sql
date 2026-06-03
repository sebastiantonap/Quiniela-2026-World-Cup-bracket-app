-- ============================================================
-- Enable Row Level Security on all public tables (no policies).
--
-- The app accesses the database exclusively through the service-role key
-- (getSupabaseAdminClient), which BYPASSES RLS — so enabling RLS with no
-- policies does not affect the app, but it closes the public anon role's
-- direct REST access to every row (sessions, predictions, etc.). The unused
-- anon browser client and the vestigial auth/callback route don't read tables.
--
-- user_credentials already had RLS enabled in migration 019.
-- ============================================================

ALTER TABLE groups                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_qualifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_best_third_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_log                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs                   ENABLE ROW LEVEL SECURITY;
