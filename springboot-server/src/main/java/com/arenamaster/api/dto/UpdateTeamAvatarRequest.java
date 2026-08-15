package com.arenamaster.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record UpdateTeamAvatarRequest(@JsonProperty("avatar_url") String avatarUrl) {
}
