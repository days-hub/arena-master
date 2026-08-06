package com.arenamaster.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * One row of GET /api/standings. A mutable class (not a record) because the
 * standings service accumulates counts into it while walking the matches.
 */
public class TeamStanding {

    public String team;
    public int titles;
    @JsonProperty("match_wins")
    public int matchWins;
    @JsonProperty("match_losses")
    public int matchLosses;
    @JsonProperty("game_wins")
    public int gameWins;
    @JsonProperty("game_losses")
    public int gameLosses;

    public TeamStanding(String team) {
        this.team = team;
    }
}
