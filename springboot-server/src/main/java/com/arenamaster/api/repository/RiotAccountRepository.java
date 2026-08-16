package com.arenamaster.api.repository;

import com.arenamaster.api.domain.RiotAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RiotAccountRepository extends JpaRepository<RiotAccount, Long> {

    Optional<RiotAccount> findByUserId(Long userId);

    Optional<RiotAccount> findByPuuid(String puuid);

    /** Rosters are Discord ids, so profiles are looked up that way. */
    List<RiotAccount> findByUserDiscordIdIn(List<String> discordIds);
}
