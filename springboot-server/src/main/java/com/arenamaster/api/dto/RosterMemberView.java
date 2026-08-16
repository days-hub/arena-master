package com.arenamaster.api.dto;

/**
 * A team member as shown on a roster: their Discord identity, plus their
 * linked League account when they have one. {@code riot} is null for members
 * who have never signed in or never linked — most of a roster, typically.
 */
public record RosterMemberView(
        String id,
        String name,
        String avatar,
        RiotAccountView riot) {
}
