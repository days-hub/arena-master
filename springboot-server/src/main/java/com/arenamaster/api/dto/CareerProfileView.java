package com.arenamaster.api.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/** A signed-in player's Arena Master history, derived from real rosters and matches. */
public record CareerProfileView(
        @JsonProperty("discord_id") String discordId,
        String username,
        @JsonProperty("avatar_url") String avatarUrl,
        @JsonProperty("guild_role") String guildRole,
        @JsonProperty("member_since") String memberSince,
        List<TeamCareerView> teams,
        @JsonProperty("tournament_appearances") int tournamentAppearances,
        int titles,
        @JsonProperty("match_wins") int matchWins,
        @JsonProperty("match_losses") int matchLosses,
        @JsonProperty("game_wins") int gameWins,
        @JsonProperty("game_losses") int gameLosses,
        @JsonProperty("games_played") List<String> gamesPlayed,
        @JsonProperty("recent_matches") List<CareerMatchView> recentMatches,
        List<AchievementView> achievements) {

    public record TeamCareerView(
            Long id,
            String name,
            @JsonProperty("avatar_url") String avatarUrl,
            @JsonProperty("tournament_appearances") int tournamentAppearances,
            int titles) {
    }

    public record CareerMatchView(
            Long id,
            @JsonProperty("tournament_id") Long tournamentId,
            @JsonProperty("tournament_name") String tournamentName,
            String game,
            @JsonProperty("round_number") int roundNumber,
            String team,
            String opponent,
            @JsonProperty("team_score") int teamScore,
            @JsonProperty("opponent_score") int opponentScore,
            String result,
            @JsonProperty("played_at") String playedAt) {
    }

    public record AchievementView(
            String id,
            String name,
            String description,
            boolean earned,
            int progress,
            int goal) {
    }
}
