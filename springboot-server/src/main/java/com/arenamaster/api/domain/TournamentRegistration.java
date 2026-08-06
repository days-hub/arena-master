package com.arenamaster.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One team's entry in one tournament — a row of the roster that used to be a
 * JSON array on the tournament. Deliberately no FK to {@code teams}: a
 * registered name doesn't have to be a created Team (matches the old
 * behavior).
 */
@Entity
@Table(name = "tournament_registrations",
        uniqueConstraints = @UniqueConstraint(columnNames = {"tournament_id", "team_name"}))
@Getter
@Setter
@NoArgsConstructor
public class TournamentRegistration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // LAZY: don't load the whole tournament every time a registration row is read.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tournament_id")
    private Tournament tournament;

    @Column(name = "team_name", nullable = false)
    private String teamName;

    @Column(name = "seed_order", nullable = false)
    private int seedOrder;
}
