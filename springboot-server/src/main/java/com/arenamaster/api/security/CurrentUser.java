package com.arenamaster.api.security;

import com.arenamaster.api.domain.User;
import com.arenamaster.api.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Resolves the logged-in {@link User} from the security context. The
 * authentication name is the Discord snowflake (see the provider's
 * user-name-attribute), which is what {@code users.discord_id} stores.
 */
@Component
public class CurrentUser {

    private final UserRepository users;

    public CurrentUser(UserRepository users) {
        this.users = users;
    }

    public Optional<User> get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getPrincipal() instanceof String) {
            // "anonymousUser" principal — not logged in.
            return Optional.empty();
        }
        return users.findByDiscordId(auth.getName());
    }
}
