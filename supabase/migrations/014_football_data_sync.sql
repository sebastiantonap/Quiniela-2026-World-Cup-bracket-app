-- ============================================================
-- 014: football-data.org sync infrastructure
--
-- Adds external ID mapping for teams/matches, manual-override
-- bookkeeping, an append-only change_log, and a sync_runs
-- observability table.
-- ============================================================

-- Teams: map to football-data.org team IDs
ALTER TABLE teams ADD COLUMN fd_team_id INTEGER UNIQUE;

-- Matches: map to football-data.org match IDs + override tracking
ALTER TABLE matches ADD COLUMN fd_match_id INTEGER UNIQUE;
ALTER TABLE matches ADD COLUMN is_manual_override BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE matches ADD COLUMN api_home_score INTEGER;
ALTER TABLE matches ADD COLUMN api_away_score INTEGER;
ALTER TABLE matches ADD COLUMN api_status TEXT;
ALTER TABLE matches ADD COLUMN last_synced_at TIMESTAMPTZ;

-- Append-only audit trail for every change (manual or automated)
CREATE TABLE change_log (
  id          BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id   UUID NOT NULL,
  field       TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  source      TEXT NOT NULL,
  changed_by  TEXT,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_change_log_entity ON change_log(entity_type, entity_id);
CREATE INDEX idx_change_log_time   ON change_log(changed_at DESC);

-- Sync run observability
CREATE TABLE sync_runs (
  id              BIGSERIAL PRIMARY KEY,
  started_at      TIMESTAMPTZ DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  status          TEXT,
  matches_seen    INTEGER,
  matches_changed INTEGER,
  drift_count     INTEGER,
  error_text      TEXT
);
