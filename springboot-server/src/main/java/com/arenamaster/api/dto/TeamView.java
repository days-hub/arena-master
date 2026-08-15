package com.arenamaster.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/** Discord snowflakes are strings in JSON so browsers never round them. */
public record TeamView(
        Long id,
        String name,
        List<String> members,
        @JsonProperty("avatar_url") String avatarUrl) {
}
