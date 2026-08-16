package com.arenamaster.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Body of POST /api/me/riot. Players know themselves as "GameName#TAG", so
 * either a combined riot_id or the split fields are accepted.
 */
public record LinkRiotAccountRequest(
        @JsonProperty("riot_id") String riotId,
        @JsonProperty("game_name") String gameName,
        @JsonProperty("tag_line") String tagLine,
        String platform) {
}
