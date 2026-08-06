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

    private final RestClient http;
    private final DiscordProperties props;

    public DiscordClient(DiscordProperties props) {
        // Boot 4 split RestClient auto-configuration into its own starter;
        // plain create() is all this client needs.
        this.http = RestClient.create();
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
     * Best-effort webhook post. Faithful to the old backend: only transport
     * failures count as failure — an error *response* from Discord was never
     * checked, so it isn't here either.
     */
    public boolean sendWebhook(Object message) {
        try {
            http.post()
                    .uri(props.webhookUrl())
                    .contentType(MediaType.APPLICATION_JSON)
                    // singletonMap, not Map.of: content may legitimately be null
                    .body(Collections.singletonMap("content", message))
                    .exchange((request, response) -> true);
            return true;
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
