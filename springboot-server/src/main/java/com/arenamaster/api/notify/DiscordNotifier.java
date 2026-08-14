package com.arenamaster.api.notify;

import com.arenamaster.api.config.DiscordProperties;
import com.arenamaster.api.discord.DiscordClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Delivers {@link DiscordNotification}s to the configured webhook.
 *
 * Notifications used to be sent by the React frontend, which meant results
 * recorded through the Discord bot or the API announced nothing. Publishing
 * them here makes announcements a property of the action rather than of the
 * client that happened to trigger it.
 *
 * AFTER_COMMIT so nothing is announced that later rolls back;
 * fallbackExecution so events published outside a transaction (team creation
 * is deliberately non-transactional) still get delivered; @Async on a
 * single-threaded executor so a slow Discord never delays the API response
 * while announcements still arrive in the order they happened.
 */
@Component
@Slf4j
public class DiscordNotifier {

    private final DiscordClient discord;
    private final DiscordProperties props;

    public DiscordNotifier(DiscordClient discord, DiscordProperties props) {
        this.discord = discord;
        this.props = props;
    }

    @Async("discordNotificationExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onNotification(DiscordNotification notification) {
        String webhookUrl = props.webhookUrl();
        // Best-effort: a missing or placeholder webhook is a normal
        // configuration, not an error.
        if (webhookUrl == null
                || !(webhookUrl.startsWith("http://") || webhookUrl.startsWith("https://"))) {
            log.debug("DISCORD_WEBHOOK_URL is not configured; skipping notification.");
            return;
        }
        discord.sendWebhook(notification.message());
    }
}
