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
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * One bracket match. Teams are stored by name (not FK) exactly like the old
 * backend — the bracket only ever knew names.
 *
 * Note the explicit column names on the team fields: Hibernate's default
 * camel-to-snake strategy only inserts an underscore at lower→UPPER→lower
 * boundaries, so "teamA" would map to column "teama", not "team_a".
 */
@Entity
@Table(name = "matches")
@Getter
@Setter
@NoArgsConstructor
public class Match {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tournament_id")
    private Tournament tournament;

    @Column(name = "team_a")
    private String teamA;

    @Column(name = "team_b")
    private String teamB;

    // Preformatted 'YYYY-MM-DD HH:MM:SS' strings, verbatim from the old
    // backend; becomes a real timestamp in the cleanup phase.
    private String startTime;

    private String endTime;

    private String state;

    @Column(nullable = false)
    private int roundNumber;

    private String winner;

    // Legacy quirk: mirrors the row id. It's what the Discord bot displays and
    // what result-recording looks matches up by.
    private Integer matchNumber;

    @Column(name = "team_a_score", nullable = false)
    private int teamAScore;

    @Column(name = "team_b_score", nullable = false)
    private int teamBScore;
}
