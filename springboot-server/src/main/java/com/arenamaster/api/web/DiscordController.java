package com.arenamaster.api.web;

import com.arenamaster.api.config.DiscordProperties;
import com.arenamaster.api.discord.DiscordClient;
import com.arenamaster.api.dto.MemberView;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@Slf4j
public class DiscordController {

    private final DiscordClient discord;
    private final DiscordProperties props;

    public DiscordController(DiscordClient discord, DiscordProperties props) {
        this.discord = discord;
        this.props = props;
    }

    @GetMapping("/api/discord/members")
    public List<MemberView> members() {
        return discord.fetchMembers();
    }

    @PostMapping("/api/notify-discord")
    public Map<String, String> notifyDiscord(@RequestBody Map<String, Object> payload) {
        Object message = payload.get("message");
        String webhookUrl = props.webhookUrl();
        // Best-effort: a missing, placeholder, or unreachable webhook should
        // not error out the action that triggered the notification.
        if (webhookUrl == null
                || !(webhookUrl.startsWith("http://") || webhookUrl.startsWith("https://"))) {
            log.warn("DISCORD_WEBHOOK_URL is not configured; skipping notification.");
            return Map.of("message", "Discord notification skipped (webhook not configured)");
        }
        boolean sent = discord.sendWebhook(message);
        return Map.of("message", sent ? "Notification sent to Discord" : "Discord notification failed");
    }
}
