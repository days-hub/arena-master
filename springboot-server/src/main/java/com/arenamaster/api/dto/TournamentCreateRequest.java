package com.arenamaster.api.dto;

/** Body of POST/PUT /api/tournaments — pydantic TournamentCreate. */
public record TournamentCreateRequest(String name, String game, String format) {

    /** pydantic defaulted format to 'bo1' when the field was omitted. */
    public String formatOrDefault() {
        return format == null ? "bo1" : format;
    }
}
