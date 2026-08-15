-- Distinguishes a member-selected team emblem from the automatic avatar of
-- the latest roster member. Existing icons are treated as automatic.
ALTER TABLE teams ADD COLUMN avatar_custom BOOLEAN NOT NULL DEFAULT FALSE;
