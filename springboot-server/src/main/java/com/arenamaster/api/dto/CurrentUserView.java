package com.arenamaster.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Response of GET /api/me. */
public record CurrentUserView(
        Long id,
        @JsonProperty("discord_id") String discordId,
        String username,
        @JsonProperty("avatar_url") String avatarUrl,
        @JsonProperty("is_admin") boolean admin) {
}
