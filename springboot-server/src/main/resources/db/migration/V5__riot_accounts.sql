-- League of Legends accounts, linked by the signed-in user themselves.
--
-- Keyed to users rather than to team rosters on purpose: linking is a claim
-- about your own identity, so it requires being logged in. A roster entry is
-- just a Discord id and can't consent to anything.
--
-- The rank columns are a cache, not a source of truth. Riot's personal-tier
-- keys allow only 100 requests per 2 minutes, so profiles are refreshed on a
-- cooldown and served from here in between; last_synced_at records when.

CREATE TABLE riot_accounts (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    -- Riot's stable cross-region identifier. A player can rename themselves;
    -- the puuid is what actually identifies them.
    puuid          TEXT   NOT NULL UNIQUE,
    game_name      TEXT   NOT NULL,
    tag_line       TEXT   NOT NULL,
    -- Platform routing value (na1, euw1, kr, ...) — needed for summoner and
    -- league lookups, which are per-platform rather than per-region.
    platform       TEXT   NOT NULL,

    summoner_level INT,
    profile_icon_id INT,

    -- Solo/duo ranked snapshot; all null for an unranked player.
    tier           TEXT,
    division       TEXT,
    league_points  INT,
    wins           INT,
    losses         INT,

    linked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_synced_at TIMESTAMPTZ
);

CREATE INDEX idx_riot_accounts_puuid ON riot_accounts (puuid);
