package com.arenamaster.api.dto;

import java.util.List;

/** Shape of the pydantic Team response model: name, members, id. */
public record TeamView(Long id, String name, List<Long> members) {
}
