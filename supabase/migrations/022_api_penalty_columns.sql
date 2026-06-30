ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS api_home_penalties integer,
  ADD COLUMN IF NOT EXISTS api_away_penalties integer;
