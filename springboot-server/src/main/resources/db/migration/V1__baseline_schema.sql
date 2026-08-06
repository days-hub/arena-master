-- Baseline schema for the Spring Boot port.
-- Corrects defects carried in the SQLite schema:
--   * teams had a broken column ("a" typed "avatar_url TEXT" — a stray comma);
--     avatar_url now actually exists.
--   * tournaments.team_names JSON blob is replaced by tournament_registrations
--     rows (one per registered name, ordered, duplicate-proof). No FK to teams:
--     registration is a plain name list today and names need not exist in teams.
--   * matches.tournament_id gains a real, enforced FK with cascade delete.

CREATE TABLE tournaments (
    id     BIGSERIAL PRIMARY KEY,
    name   TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Created',
    game   TEXT,
    format TEXT NOT NULL DEFAULT 'bo1'
);

-- The API rejects a new tournament whose name matches one that is still
-- Created/Ongoing (finished names may be reused). Enforce that here too.
CREATE UNIQUE INDEX uq_tournaments_active_name
    ON tournaments (name)
    WHERE status IN ('Created', 'Ongoing');

CREATE TABLE tournament_registrations (
    id            BIGSERIAL PRIMARY KEY,
    tournament_id BIGINT NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
    team_name     TEXT   NOT NULL,
    seed_order    INT    NOT NULL,
    UNIQUE (tournament_id, team_name)
);

CREATE INDEX idx_registrations_tournament ON tournament_registrations (tournament_id);

CREATE TABLE teams (
    id         BIGSERIAL PRIMARY KEY,
    name       TEXT  NOT NULL UNIQUE,
    members    JSONB NOT NULL DEFAULT '[]',
    avatar_url TEXT
);

CREATE TABLE matches (
    id            BIGSERIAL PRIMARY KEY,
    tournament_id BIGINT NOT NULL REFERENCES tournaments (id) ON DELETE CASCADE,
    team_a        TEXT,
    team_b        TEXT,
    -- Kept as TEXT for now: the old backend stores preformatted
    -- 'YYYY-MM-DD HH:MM:SS' strings and clients receive them verbatim.
    -- Converting to TIMESTAMP is a cleanup-phase change.
    start_time    TEXT,
    end_time      TEXT,
    state         TEXT,
    round_number  INT NOT NULL,
    winner        TEXT,
    -- Legacy quirk preserved: match_number mirrors the row id (it is what the
    -- Discord bot displays and what result-recording keys on).
    match_number  INT,
    team_a_score  INT NOT NULL DEFAULT 0,
    team_b_score  INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_matches_tournament ON matches (tournament_id);
