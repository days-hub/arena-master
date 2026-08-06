package com.arenamaster.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record AddMemberRequest(
        @JsonProperty("team_id") Long teamId,
        @JsonProperty("member_id") Long memberId) {
}
