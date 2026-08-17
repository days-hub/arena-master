package com.arenamaster.api.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * A tournament. Replaces the old SQLite row whose roster lived in a
 * "team_names" JSON string; the roster is now real {@link TournamentRegistration}
 * rows, owned by this entity (cascade = registrations live and die with their
 * tournament).
 */
@Entity
@Table(name = "tournaments")
@Getter
@Setter
@NoArgsConstructor
public class Tournament {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY) // Postgres BIGSERIAL assigns the id
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String status = "Created";

    private String game;

    @Column(nullable = false)
    private String format = "bo1";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @OneToMany(mappedBy = "tournament", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("seedOrder")
    private List<TournamentRegistration> registrations = new ArrayList<>();

    /** Null for tournaments created before authentication existed. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    /** The roster as plain names — the shape the old API exposed as "teams". */
    public List<String> teamNames() {
        return registrations.stream().map(TournamentRegistration::getTeamName).toList();
    }

    public boolean hasTeam(String teamName) {
        return registrations.stream().anyMatch(r -> r.getTeamName().equals(teamName));
    }

    /** Appends a team at the end of the seeding order; saved via cascade. */
    public void registerTeam(String teamName) {
        TournamentRegistration registration = new TournamentRegistration();
        registration.setTournament(this);
        registration.setTeamName(teamName);
        registration.setSeedOrder(registrations.size());
        registrations.add(registration);
    }
}
