package com.arenamaster.api.dto;

import java.util.List;

/** Tournament details. List responses omit matches; ID and by-name detail responses include them. */
public record TournamentResponse(
        Long id,
        String name,
        String game,
        String format,
        String status,
        List<String> teams,
        List<MatchView> matches) {
}
