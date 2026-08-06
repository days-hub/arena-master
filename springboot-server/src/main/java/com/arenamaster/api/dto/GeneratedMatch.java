package com.arenamaster.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Entry in the "matches" array returned by bracket generation and round advancement. */
public record GeneratedMatch(
        @JsonProperty("match_id") Long matchId,
        @JsonProperty("team_a") String teamA,
        @JsonProperty("team_b") String teamB) {
}
