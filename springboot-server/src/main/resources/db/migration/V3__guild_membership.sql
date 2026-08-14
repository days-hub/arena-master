-- Whether the user belongs to the tournament's Discord server, refreshed on
-- every login from the `guilds` OAuth scope. Creating tournaments and teams
-- is limited to members, so an arbitrary Discord account can't organize
-- events in someone else's community.
ALTER TABLE users ADD COLUMN guild_member BOOLEAN NOT NULL DEFAULT FALSE;
