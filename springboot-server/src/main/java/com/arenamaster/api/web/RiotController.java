package com.arenamaster.api.web;

import com.arenamaster.api.dto.LinkRiotAccountRequest;
import com.arenamaster.api.dto.RiotAccountView;
import com.arenamaster.api.riot.RiotClient;
import com.arenamaster.api.service.RiotAccountService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Linking the signed-in player's League account. Everything lives under
 * /api/me/ because these endpoints only ever act on the caller's own account.
 */
@RestController
public class RiotController {

    private final RiotAccountService riotAccounts;

    public RiotController(RiotAccountService riotAccounts) {
        this.riotAccounts = riotAccounts;
    }

    /** Lets the UI hide League features entirely when the server has no key. */
    @GetMapping("/api/riot/status")
    public Map<String, Object> status() {
        return Map.of(
                "enabled", riotAccounts.isEnabled(),
                "platforms", List.copyOf(RiotClient.supportedPlatforms()));
    }

    @GetMapping("/api/me/riot")
    public ResponseEntity<RiotAccountView> myAccount() {
        return riotAccounts.forCurrentUser()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PostMapping("/api/me/riot")
    public RiotAccountView link(@RequestBody LinkRiotAccountRequest request) {
        return riotAccounts.link(request);
    }

    @PostMapping("/api/me/riot/refresh")
    public RiotAccountView refresh() {
        return riotAccounts.refresh();
    }

    @DeleteMapping("/api/me/riot")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unlink() {
        riotAccounts.unlink();
    }
}
