package com.arenamaster.api.riot;

import com.arenamaster.api.config.RiotProperties;
import com.arenamaster.api.error.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Calls to the Riot Games API.
 *
 * Two things about Riot's API shape are easy to get wrong:
 *
 * 1. There are two routing schemes. Account lookups are *regional*
 *    (americas/europe/asia/sea); summoner and league lookups are *platform*
 *    (na1/euw1/kr/...). Sending one to the other's host returns 404.
 * 2. Ranked entries must be fetched by puuid. The by-summoner endpoint that
 *    most guides still show was removed in June 2025 along with the rest of
 *    the encrypted-summoner-id surface.
 */
@Component
@Slf4j
public class RiotClient {

    private static final Set<String> AMERICAS = Set.of("na1", "br1", "la1", "la2");
    private static final Set<String> EUROPE = Set.of("euw1", "eun1", "tr1", "ru");
    private static final Set<String> ASIA = Set.of("kr", "jp1");
    private static final Set<String> SEA = Set.of("oc1", "ph2", "sg2", "th2", "tw2", "vn2");

    private final RestClient http;
    private final RiotProperties props;

    public RiotClient(RiotProperties props) {
        this.props = props;
        this.http = RestClient.create();
    }

    public static Set<String> supportedPlatforms() {
        return Set.of("na1", "br1", "la1", "la2", "euw1", "eun1", "tr1", "ru",
                "kr", "jp1", "oc1", "ph2", "sg2", "th2", "tw2", "vn2");
    }

    /** Regional host for a platform; account lookups are not per-platform. */
    private static String regionFor(String platform) {
        if (AMERICAS.contains(platform)) return "americas";
        if (EUROPE.contains(platform)) return "europe";
        if (ASIA.contains(platform)) return "asia";
        if (SEA.contains(platform)) return "sea";
        throw new ApiException(400, "Unknown platform '%s'".formatted(platform));
    }

    private void requireKey() {
        if (!props.isConfigured()) {
            throw new ApiException(503, "League integration is not configured on this server");
        }
    }

    /** Resolves "GameName#TAG" to the account's stable puuid. */
    public RiotAccountSummary resolveRiotId(String gameName, String tagLine, String platform) {
        requireKey();
        Map<String, Object> body = get(
                "https://%s.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{name}/{tag}"
                        .formatted(regionFor(platform)),
                "Riot ID \"%s#%s\" was not found on that region".formatted(gameName, tagLine),
                gameName, tagLine);
        return new RiotAccountSummary(
                (String) body.get("puuid"),
                (String) body.get("gameName"),
                (String) body.get("tagLine"));
    }

    /** Summoner level and profile icon. Null if the account has never played on this platform. */
    public RiotSummoner fetchSummoner(String puuid, String platform) {
        requireKey();
        try {
            Map<String, Object> body = get(
                    "https://%s.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/{puuid}"
                            .formatted(platform),
                    null, puuid);
            return new RiotSummoner(
                    asInt(body.get("summonerLevel")),
                    asInt(body.get("profileIconId")));
        } catch (ApiException e) {
            if (e.getStatus() == 404) {
                return null;
            }
            throw e;
        }
    }

    /** Solo/duo ranked entry, or null when the player is unranked. */
    public RiotRank fetchSoloQueueRank(String puuid, String platform) {
        requireKey();
        List<Map<String, Object>> entries = http.get()
                .uri("https://%s.api.riotgames.com/lol/league/v4/entries/by-puuid/{puuid}"
                        .formatted(platform), puuid)
                .header("X-Riot-Token", props.apiKey())
                .retrieve()
                // Must throw, not return: ErrorHandler#handle is void, so
                // `(req, res) -> translate(...)` would build the exception and
                // silently discard it, leaving Riot's error body to be parsed
                // as if it were data.
                .onStatus(HttpStatusCode::isError, (req, res) -> {
                    throw translate(res.getStatusCode().value(), null);
                })
                .body(new ParameterizedTypeReference<>() {
                });
        if (entries == null) {
            return null;
        }
        return entries.stream()
                .filter(e -> "RANKED_SOLO_5x5".equals(e.get("queueType")))
                .findFirst()
                .map(e -> new RiotRank(
                        (String) e.get("tier"),
                        (String) e.get("rank"),
                        asInt(e.get("leaguePoints")),
                        asInt(e.get("wins")),
                        asInt(e.get("losses"))))
                .orElse(null);
    }

    private Map<String, Object> get(String uriTemplate, String notFoundMessage, Object... vars) {
        try {
            return http.get()
                    .uri(uriTemplate, vars)
                    .header("X-Riot-Token", props.apiKey())
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, res) -> {
                        throw translate(res.getStatusCode().value(), notFoundMessage);
                    })
                    .body(new ParameterizedTypeReference<>() {
                    });
        } catch (RestClientException e) {
            log.warn("Riot API call failed: {}", e.getMessage());
            throw new ApiException(502, "Riot's API could not be reached. Please try again shortly.");
        }
    }

    /**
     * Riot's failures need translating into something a player can act on —
     * especially 403, which almost always means a development key expired
     * rather than anything the user did wrong.
     */
    private static ApiException translate(int status, String notFoundMessage) {
        return switch (status) {
            case 400 -> new ApiException(400, "Riot rejected that request as malformed");
            case 401, 403 -> new ApiException(502,
                    "The server's Riot API key was rejected. Development keys expire every 24 hours.");
            case 404 -> new ApiException(404,
                    notFoundMessage == null ? "Not found on Riot's API" : notFoundMessage);
            case 429 -> new ApiException(429,
                    "Riot's rate limit was hit. Please wait a moment and try again.");
            default -> new ApiException(502, "Riot's API returned an error (%d)".formatted(status));
        };
    }

    private static Integer asInt(Object value) {
        return value instanceof Number number ? number.intValue() : null;
    }

    public record RiotAccountSummary(String puuid, String gameName, String tagLine) {
    }

    public record RiotSummoner(Integer summonerLevel, Integer profileIconId) {
    }

    public record RiotRank(String tier, String division, Integer leaguePoints, Integer wins, Integer losses) {
    }
}
