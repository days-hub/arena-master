package com.arenamaster.api.service;

import com.arenamaster.api.domain.Match;
import com.arenamaster.api.domain.Team;
import com.arenamaster.api.domain.Tournament;
import com.arenamaster.api.domain.User;
import com.arenamaster.api.repository.MatchRepository;
import com.arenamaster.api.repository.TeamRepository;
import com.arenamaster.api.repository.TournamentRepository;
import com.arenamaster.api.security.AccessControl;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Sort;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ProfileServiceTest {

    @Test
    void buildsCareerFromDiscordRosterMembershipAndDecidedMatches() {
        TeamRepository teams = mock(TeamRepository.class);
        TournamentRepository tournaments = mock(TournamentRepository.class);
        MatchRepository matches = mock(MatchRepository.class);
        AccessControl access = mock(AccessControl.class);

        User user = new User();
        user.setDiscordId("123");
        user.setUsername("DaeKreX");
        user.setGuildMember(true);
        user.setCreatedAt(Instant.parse("2025-03-01T12:00:00Z"));
        when(access.requireUser()).thenReturn(user);

        Team northernLights = team(1L, "Northern Lights", 123L);
        Team bystanders = team(2L, "Bystanders", 999L);
        Tournament valorant = tournament(10L, "VCT Summer", "Valorant", "Completed",
                "Northern Lights", "Turbo Geese");
        Tournament overwatch = tournament(11L, "Overwatch League", "Overwatch", "Ongoing",
                "Northern Lights", "Chongas");
        Match title = match(100L, valorant, "Northern Lights", "Turbo Geese", "Northern Lights", 3, 1);
        Match loss = match(101L, overwatch, "Northern Lights", "Chongas", "Chongas", 1, 3);

        when(teams.findAll(any(Sort.class))).thenReturn(List.of(northernLights, bystanders));
        when(tournaments.findAll(any(Sort.class))).thenReturn(List.of(valorant, overwatch));
        when(matches.findAll(any(Sort.class))).thenReturn(List.of(title, loss));

        var profile = new ProfileService(teams, tournaments, matches, access).career();

        assertThat(profile.guildRole()).isEqualTo("Guild member");
        assertThat(profile.teams()).singleElement().satisfies(team -> {
            assertThat(team.name()).isEqualTo("Northern Lights");
            assertThat(team.tournamentAppearances()).isEqualTo(2);
            assertThat(team.titles()).isEqualTo(1);
        });
        assertThat(profile.tournamentAppearances()).isEqualTo(2);
        assertThat(profile.titles()).isEqualTo(1);
        assertThat(profile.matchWins()).isEqualTo(1);
        assertThat(profile.matchLosses()).isEqualTo(1);
        assertThat(profile.gamesPlayed()).containsExactly("Valorant", "Overwatch");
        assertThat(profile.recentMatches()).extracting(match -> match.result()).containsExactly("L", "W");
        assertThat(profile.achievements()).filteredOn(achievement -> achievement.id().equals("champion"))
                .singleElement().satisfies(achievement -> assertThat(achievement.earned()).isTrue());
        assertThat(profile.achievements()).filteredOn(achievement -> achievement.id().equals("versatile"))
                .singleElement().satisfies(achievement -> assertThat(achievement.earned()).isTrue());
    }

    private static Team team(Long id, String name, Long member) {
        Team team = new Team();
        team.setId(id);
        team.setName(name);
        team.setMembers(List.of(member));
        return team;
    }

    private static Tournament tournament(Long id, String name, String game, String status, String... teams) {
        Tournament tournament = new Tournament();
        tournament.setId(id);
        tournament.setName(name);
        tournament.setGame(game);
        tournament.setStatus(status);
        for (String team : teams) tournament.registerTeam(team);
        return tournament;
    }

    private static Match match(Long id, Tournament tournament, String teamA, String teamB,
                               String winner, int teamAScore, int teamBScore) {
        Match match = new Match();
        match.setId(id);
        match.setTournament(tournament);
        match.setTeamA(teamA);
        match.setTeamB(teamB);
        match.setWinner(winner);
        match.setRoundNumber(1);
        match.setTeamAScore(teamAScore);
        match.setTeamBScore(teamBScore);
        return match;
    }
}
