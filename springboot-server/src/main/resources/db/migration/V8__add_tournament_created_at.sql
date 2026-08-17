ALTER TABLE tournaments
    ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX idx_tournaments_created_at ON tournaments (created_at);
