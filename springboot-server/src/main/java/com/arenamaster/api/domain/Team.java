package com.arenamaster.api.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.ArrayList;
import java.util.List;

/**
 * A Discord-facing team: a name plus the Discord user ids of its members.
 * Distinct from tournament rosters, which are plain name lists.
 */
@Entity
@Table(name = "teams")
@Getter
@Setter
@NoArgsConstructor
public class Team {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    /**
     * Discord user ids (snowflakes — they need a 64-bit type). Stored as a
     * jsonb column; Hibernate serializes the list to JSON transparently, so
     * no more json.loads/json.dumps at every call site like the old backend.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<Long> members = new ArrayList<>();

    private String avatarUrl;
}
