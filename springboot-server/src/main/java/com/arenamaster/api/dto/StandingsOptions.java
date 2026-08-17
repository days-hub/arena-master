package com.arenamaster.api.dto;

import java.util.List;

/** Available scopes for the standings history desk. Seasons are calendar years. */
public record StandingsOptions(
        List<String> games,
        List<TournamentOption> tournaments,
        List<Integer> seasons) {

    public record TournamentOption(Long id, String name, String game, int season) {
    }
}
