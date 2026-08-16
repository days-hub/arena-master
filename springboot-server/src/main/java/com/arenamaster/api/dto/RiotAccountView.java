package com.arenamaster.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * A linked League account as the UI shows it. The puuid is deliberately not
 * exposed: it identifies a player across every Riot service, and nothing in
 * the browser needs it.
 */
public record RiotAccountView(
        @JsonProperty("riot_id") String riotId,
        String platform,
        @JsonProperty("summoner_level") Integer summonerLevel,
        @JsonProperty("profile_icon_url") String profileIconUrl,
        String tier,
        String division,
        @JsonProperty("league_points") Integer leaguePoints,
        Integer wins,
        Integer losses,
        /** e.g. "Gold IV · 42 LP", or "Unranked". */
        @JsonProperty("rank_label") String rankLabel,
        @JsonProperty("last_synced_at") String lastSyncedAt) {
}
