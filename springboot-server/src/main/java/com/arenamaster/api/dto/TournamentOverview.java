package com.arenamaster.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/** One dashboard row of GET /api/tournaments/overview. */
public record TournamentOverview(
        Long id,
        String name,
        String game,
        String format,
        String status,
        @JsonProperty("team_count") int teamCount,
        @JsonProperty("matches_total") int matchesTotal,
        @JsonProperty("matches_decided") int matchesDecided,
        @JsonProperty("current_round") int currentRound,
        @JsonProperty("total_rounds") int totalRounds,
        String champion) {
}
