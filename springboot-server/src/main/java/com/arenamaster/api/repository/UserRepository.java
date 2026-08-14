package com.arenamaster.api.repository;

import com.arenamaster.api.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByDiscordId(String discordId);
}
