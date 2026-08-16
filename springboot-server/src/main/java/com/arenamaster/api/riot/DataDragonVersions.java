package com.arenamaster.api.riot;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Resolves the current Data Dragon version for asset URLs (profile icons and
 * the like).
 *
 * Pinning a version means every asset added after it 404s, and the gap only
 * widens: a version hardcoded at release is years stale by the time anyone
 * notices players with newer icons have broken avatars. Data Dragon is a
 * static CDN with no API key and no rate limit, so this simply asks.
 */
@Component
@Slf4j
public class DataDragonVersions {

    private static final String VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json";
    private static final Duration TTL = Duration.ofHours(12);
    /** Used until the first successful fetch; known to serve. */
    private static final String FALLBACK = "14.1.1";

    private final RestClient http = RestClient.create();

    private volatile String cached = FALLBACK;
    private volatile Instant fetchedAt = Instant.EPOCH;

    public String latest() {
        if (fetchedAt.isAfter(Instant.now().minus(TTL))) {
            return cached;
        }
        try {
            List<String> versions = http.get()
                    .uri(VERSIONS_URL)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {
                    });
            if (versions != null && !versions.isEmpty()) {
                cached = versions.get(0); // newest first
                fetchedAt = Instant.now();
            }
        } catch (RestClientException e) {
            // Keep serving the last known version rather than breaking images.
            log.warn("Could not read Data Dragon versions, staying on {}: {}", cached, e.getMessage());
            fetchedAt = Instant.now().minus(TTL).plus(Duration.ofMinutes(5));
        }
        return cached;
    }

    public String profileIconUrl(int profileIconId) {
        return "https://ddragon.leagueoflegends.com/cdn/%s/img/profileicon/%d.png"
                .formatted(latest(), profileIconId);
    }
}
