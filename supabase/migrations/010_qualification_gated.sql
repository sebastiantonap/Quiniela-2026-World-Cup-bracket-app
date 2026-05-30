-- Add qualification_gated flag to predictions
-- Marks knockout predictions that scored 0 because the predicted winner
-- was not in the entry's group-stage qualification picks
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS qualification_gated BOOLEAN NOT NULL DEFAULT false;
