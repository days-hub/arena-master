package com.arenamaster.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * A player's linked League account. The rank fields are a cached snapshot
 * refreshed on a cooldown rather than live data — see the V5 migration for
 * why.
 */
@Entity
@Table(name = "riot_accounts")
@Getter
@Setter
@NoArgsConstructor
public class RiotAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", unique = true)
    private User user;

    /** Stable across renames and regions; the real identifier. */
    @Column(nullable = false, unique = true)
    private String puuid;

    @Column(name = "game_name", nullable = false)
    private String gameName;

    @Column(name = "tag_line", nullable = false)
    private String tagLine;

    @Column(nullable = false)
    private String platform;

    private Integer summonerLevel;

    private Integer profileIconId;

    // Solo/duo snapshot; null for an unranked player.
    private String tier;

    private String division;

    private Integer leaguePoints;

    private Integer wins;

    private Integer losses;

    @Column(name = "linked_at", nullable = false, insertable = false, updatable = false)
    private Instant linkedAt;

    private Instant lastSyncedAt;

    /** "GameName#TAG", the form players recognise. */
    public String riotId() {
        return gameName + "#" + tagLine;
    }
}
