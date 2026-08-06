package com.arenamaster.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record RegisterTeamRequest(@JsonProperty("team_name") String teamName) {
}
