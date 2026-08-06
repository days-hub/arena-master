package com.arenamaster.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record MatchResultRequest(
        @JsonProperty("match_number") Integer matchNumber,
        @JsonProperty("winner_team_name") String winnerTeamName) {
}
