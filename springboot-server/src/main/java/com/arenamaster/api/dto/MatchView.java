package com.arenamaster.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * One match inside the /by_name/{name} response. Key casing is verbatim from
 * the old backend: "startTime" is camelCase but "round_number" is snake_case.
 */
public record MatchView(
        Long id,
        String startTime,
        String state,
        @JsonProperty("round_number") Integer roundNumber,
        String winner,
        List<ParticipantView> participants) {
}
