package com.arenamaster.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Discord credentials, 12-factor style: bound from properties, overridable by
 * the env vars DISCORD_BOT_TOKEN / DISCORD_GUILD_ID / DISCORD_WEBHOOK_URL —
 * the exact names the Python stack already uses in the repo-root .env.
 */
@ConfigurationProperties(prefix = "discord")
public record DiscordProperties(String botToken, String guildId, String webhookUrl) {
}
