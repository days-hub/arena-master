package com.arenamaster.api.dto;

import java.util.List;

/**
 * Shape of the pydantic Tournament response model. Legacy quirk carried over
 * on purpose: the list and by-id endpoints always returned teams=[] and
 * matches=[] (the old rows had no such attributes, so pydantic fell back to
 * the field defaults) — only /by_name/{name} fills them.
 */
public record TournamentResponse(
        Long id,
        String name,
        String game,
        String format,
        List<String> teams,
        List<MatchView> matches) {
}
