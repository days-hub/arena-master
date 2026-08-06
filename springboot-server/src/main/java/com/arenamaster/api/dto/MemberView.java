package com.arenamaster.api.dto;

/** One guild member in GET /api/discord/members. */
public record MemberView(String id, String name, String avatar) {
}
