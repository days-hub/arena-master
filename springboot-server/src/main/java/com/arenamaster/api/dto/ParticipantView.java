package com.arenamaster.api.dto;

/**
 * A team's slot in a match, in the @g-loot/react-tournament-brackets shape the
 * frontend renders. "id" is the team name (that's all the old bracket knew),
 * resultText is the raw game score, and status was always the literal
 * "PLAYED".
 */
public record ParticipantView(
        String id,
        Integer resultText,
        boolean isWinner,
        String status,
        String name) {
}
