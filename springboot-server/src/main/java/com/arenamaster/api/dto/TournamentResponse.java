package com.arenamaster.api.dto;

import java.util.List;

/** Tournament details. List responses include registrations; only by-name fills matches. */
public record TournamentResponse(
        Long id,
        String name,
        String game,
        String format,
        String status,
        List<String> teams,
        List<MatchView> matches) {
}
