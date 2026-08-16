package com.arenamaster.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Riot API configuration. A blank key disables League features rather than
 * failing the application — same principle as the Discord integration.
 *
 * @param apiKey          Riot API key (RGAPI-...). Development keys expire
 *                        every 24 hours; a registered Personal key does not.
 * @param defaultPlatform platform routing value used when a player doesn't
 *                        specify one (na1, euw1, kr, ...).
 * @param profileTtl      how stale a cached profile may get before a refresh
 *                        is allowed. Personal keys permit only 100 requests
 *                        per 2 minutes, so profiles are served from the
 *                        database and refreshed on this cooldown.
 */
@ConfigurationProperties(prefix = "riot")
public record RiotProperties(String apiKey, String defaultPlatform, java.time.Duration profileTtl) {

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }
}
