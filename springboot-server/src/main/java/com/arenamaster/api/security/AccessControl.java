package com.arenamaster.api.security;

import com.arenamaster.api.domain.Tournament;
import com.arenamaster.api.domain.User;
import com.arenamaster.api.error.ApiException;
import org.springframework.stereotype.Component;

/**
 * The authorization rules, in one place so they read as policy rather than
 * being scattered through the services.
 *
 * Throws {@link ApiException} rather than Spring Security's AccessDeniedException
 * so refusals come back in the same {"detail": "..."} shape as every other
 * error the clients already handle.
 */
@Component
public class AccessControl {

    private final CurrentUser currentUser;

    public AccessControl(CurrentUser currentUser) {
        this.currentUser = currentUser;
    }

    /** Signed in — the security filter chain normally catches this first. */
    public User requireUser() {
        return currentUser.get()
                .orElseThrow(() -> new ApiException(401, "You must be signed in to do that"));
    }

    /** Signed in and a member of the tournament's Discord server. */
    public User requireGuildMember() {
        User user = requireUser();
        if (!user.isGuildMember() && !user.isAdmin()) {
            throw new ApiException(403, "You must be a member of the tournament's Discord server");
        }
        return user;
    }

    /**
     * May modify this tournament: its creator, or an admin. Tournaments
     * created before accounts existed have no creator and are admin-only,
     * rather than being adoptable by whoever asks first.
     */
    public User requireCanManage(Tournament tournament) {
        User user = requireUser();
        if (user.isAdmin()) {
            return user;
        }
        User owner = tournament.getCreatedBy();
        if (owner == null) {
            throw new ApiException(403,
                    "This tournament predates user accounts, so only an admin can manage it");
        }
        if (!owner.getId().equals(user.getId())) {
            throw new ApiException(403, "Only the tournament's creator can do that");
        }
        return user;
    }
}
