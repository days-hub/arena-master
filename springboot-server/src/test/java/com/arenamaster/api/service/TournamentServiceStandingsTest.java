package com.arenamaster.api.service;

import com.arenamaster.api.domain.Match;
import com.arenamaster.api.domain.Tournament;
import com.arenamaster.api.repository.MatchRepository;
import com.arenamaster.api.repository.TournamentRepository;
import com.arenamaster.api.security.AccessControl;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Sort;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TournamentServiceStandingsTest {

    @Test
    void scopesHistoryAndDerivesFormStreaksAndSeedUpsets() {
        TournamentRepository tournaments = mock(TournamentRepository.class);
        MatchRepository matches = mock(MatchRepository.class);
        Tournament tournament = new Tournament();
        tournament.setId(10L);
        tournament.setName("Summer Cup");
        tournament.setGame("Valorant");
        tournament.setStatus("Completed");
        tournament.setCreatedAt(OffsetDateTime.parse("2026-06-12T12:00:00Z"));
        tournament.registerTeam("Alpha");
        tournament.registerTeam("Bravo");
        tournament.registerTeam("Charlie");
        tournament.registerTeam("Delta");

        Match openingUpset = match(tournament, "Alpha", "Delta", "Delta", 1, 1, 2);
        Match titleMatch = match(tournament, "Bravo", "Delta", "Delta", 2, 0, 2);
        when(tournaments.findAll(any(Sort.class))).thenReturn(List.of(tournament));
        when(matches.findAll(any(Sort.class))).thenReturn(List.of(openingUpset, titleMatch));

        TournamentService service = new TournamentService(tournaments, matches,
                mock(ApplicationEventPublisher.class), mock(AccessControl.class));

        var standings = service.standings("Valorant", null, 2026);
        var delta = standings.stream().filter(row -> row.team.equals("Delta")).findFirst().orElseThrow();

        assertThat(delta.titles).isEqualTo(1);
        assertThat(delta.matchWins).isEqualTo(2);
        assertThat(delta.streak).isEqualTo("W2");
        assertThat(delta.recentForm).containsExactly("W", "W");
        assertThat(delta.biggestUpsetSeedGap).isEqualTo(3);
        assertThat(delta.biggestUpset).isEqualTo("Beat #1 Alpha as the #4 seed");
        assertThat(service.standings("Overwatch", null, 2026)).isEmpty();
        assertThat(service.standings("Valorant", null, 2025)).isEmpty();

        var options = service.standingsOptions();
        assertThat(options.games()).containsExactly("Valorant");
        assertThat(options.seasons()).containsExactly(2026);
        assertThat(options.tournaments()).singleElement().satisfies(option -> {
            assertThat(option.id()).isEqualTo(10L);
            assertThat(option.season()).isEqualTo(2026);
        });
    }

    private static Match match(Tournament tournament, String teamA, String teamB, String winner,
                               int round, int teamAScore, int teamBScore) {
        Match match = new Match();
        match.setTournament(tournament);
        match.setTeamA(teamA);
        match.setTeamB(teamB);
        match.setWinner(winner);
        match.setRoundNumber(round);
        match.setTeamAScore(teamAScore);
        match.setTeamBScore(teamBScore);
        return match;
    }
}
