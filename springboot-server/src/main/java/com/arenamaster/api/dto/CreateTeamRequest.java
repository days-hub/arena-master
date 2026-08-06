package com.arenamaster.api.dto;

import java.util.List;

public record CreateTeamRequest(String name, List<Long> members) {

    public List<Long> membersOrEmpty() {
        return members == null ? List.of() : members;
    }
}
