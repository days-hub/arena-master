package com.arenamaster.api.repository;

import com.arenamaster.api.domain.Match;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MatchRepository extends JpaRepository<Match, Long> {

    /** "TournamentId" walks the relation: match.tournament.id. */
    List<Match> findByTournamentIdOrderById(Long tournamentId);

    /** How results are recorded: the bot/frontend send a match_number. */
    Optional<Match> findByTournamentIdAndMatchNumber(Long tournamentId, Integer matchNumber);
}
