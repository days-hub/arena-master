package com.arenamaster.api.web;

import com.arenamaster.api.dto.CurrentUserView;
import com.arenamaster.api.security.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {

    private final CurrentUser currentUser;

    public AuthController(CurrentUser currentUser) {
        this.currentUser = currentUser;
    }

    /**
     * Who am I? 200 with the user when logged in, 401 when not — the frontend
     * calls this on load to decide whether to show a login button.
     */
    @GetMapping("/api/me")
    public ResponseEntity<CurrentUserView> me() {
        return currentUser.get()
                .map(u -> ResponseEntity.ok(new CurrentUserView(
                        u.getId(), u.getDiscordId(), u.getUsername(), u.getAvatarUrl(), u.isAdmin())))
                .orElseGet(() -> ResponseEntity.status(401).build());
    }
}
