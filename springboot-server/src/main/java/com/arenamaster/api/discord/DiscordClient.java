package com.arenamaster.api.discord;

import com.arenamaster.api.config.DiscordProperties;
import com.arenamaster.api.dto.MemberView;
import com.arenamaster.api.error.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * All outbound Discord REST calls, replacing the httpx blocks scattered
 * through main.py. URLs kept verbatim from the old code (channels on v9,
 * members unversioned).
 */
@Component
@Slf4j
public class DiscordClient {

    private static final String API_BASE = "https://discord.com/api/v9";

    // Discord's edge (Cloudflare) rejects unrecognized clients with HTTP 403
    // error 1010, so identify ourselves in the format Discord asks for.
    private static final String USER_AGENT =
            "ArenaMaster (https://github.com/days-hub/arena-master, 1.0)";

    private final RestClient http;
    private final DiscordProperties props;

    public DiscordClient(DiscordProperties props) {
        // Boot 4 split RestClient auto-configuration into its own starter;
        // building it here is all this client needs.
        this.http = RestClient.builder().defaultHeader("User-Agent", USER_AGENT).build();
        this.props = props;
    }

    /** Creates a guild text channel; returns Discord's HTTP status (201 = created). */
    public int createChannel(String channelName) {
        return http.post()
                .uri(API_BASE + "/guilds/{guild}/channels", props.guildId())
                .header("Authorization", "Bot " + props.botToken())
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("name", channelName, "type", 0))
                .exchange((request, response) -> response.getStatusCode().value());
    }

    /**
     * Best-effort webhook post: never throws, so a Discord outage can't fail
     * the action that triggered the announcement. Unlike the old backend it
     * does inspect the response — now that announcements originate here
     * rather than in the browser, a silently dropped one would be invisible.
     */
    public boolean sendWebhook(Object message) {
        try {
            return http.post()
                    .uri(props.webhookUrl())
                    .contentType(MediaType.APPLICATION_JSON)
                    // singletonMap, not Map.of: content may legitimately be null
                    .body(Collections.singletonMap("content", message))
                    .exchange((request, response) -> {
                        if (response.getStatusCode().isError()) {
                            log.warn("Discord rejected the webhook post: HTTP {} {}",
                                    response.getStatusCode().value(),
                                    response.bodyTo(String.class));
                            return false;
                        }
                        return true;
                    });
        } catch (RestClientException e) {
            log.warn("Failed to send Discord notification: {}", e.getMessage());
            return false;
        }
    }

    public List<MemberView> fetchMembers() {
        List<Map<String, Object>> raw = http.get()
                .uri("https://discord.com/api/guilds/{guild}/members?limit=1000", props.guildId())
                .header("Authorization", "Bot " + props.botToken())
                .retrieve()
                .onStatus(HttpStatusCode::isError, (request, response) -> {
                    throw new ApiException(response.getStatusCode().value(), "Failed to fetch Discord members");
                })
                .body(new ParameterizedTypeReference<>() {
                });

        List<MemberView> members = new ArrayList<>();
        for (Map<String, Object> member : raw) {
            @SuppressWarnings("unchecked")
            Map<String, Object> user = (Map<String, Object>) member.get("user");
            String userId = (String) user.get("id");
            String avatarHash = (String) user.get("avatar");
            String avatarUrl = avatarHash == null ? null
                    : "https://cdn.discordapp.com/avatars/%s/%s.png".formatted(userId, avatarHash);
            members.add(new MemberView(userId, (String) user.get("username"), avatarUrl));
        }
        return members;
    }
}
