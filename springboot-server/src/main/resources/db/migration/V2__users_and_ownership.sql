-- Authentication: Discord-backed user accounts, and tournament ownership.
--
-- Identity is the Discord snowflake rather than an email: the app already
-- keys teams off Discord ids, so a login and a roster entry refer to the
-- same person without a linking step.

CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    discord_id    TEXT NOT NULL UNIQUE,
    username      TEXT NOT NULL,
    avatar_url    TEXT,
    is_admin      BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

-- Nullable on purpose: tournaments created before authentication existed have
-- no owner. Ownership checks treat NULL as "unowned legacy data" rather than
-- inventing an owner for rows nobody actually created.
ALTER TABLE tournaments ADD COLUMN created_by BIGINT REFERENCES users (id);

CREATE INDEX idx_tournaments_created_by ON tournaments (created_by);
