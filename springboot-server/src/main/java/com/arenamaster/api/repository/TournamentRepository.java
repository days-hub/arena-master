package com.arenamaster.api.repository;

import com.arenamaster.api.domain.Tournament;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.Optional;

/**
 * Spring Data derives the queries from the method names — there is no
 * implementation class anywhere. findByName becomes
 * "select * from tournaments where name = ?" at startup.
 */
public interface TournamentRepository extends JpaRepository<Tournament, Long> {

    /** First row wins, like the old fetch_one — completed tournaments may
     * share a name with a newer one (only *active* names are unique). */
    Optional<Tournament> findFirstByNameOrderById(String name);

    /** The "no duplicate active tournament name" pre-check (the DB's partial
     * unique index is the real enforcement; this gives the friendly 400). */
    boolean existsByNameAndStatusIn(String name, Collection<String> statuses);

    boolean existsByNameAndStatusInAndIdNot(String name, Collection<String> statuses, Long id);
}
