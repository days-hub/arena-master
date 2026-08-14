package com.arenamaster.api.notify;

/**
 * Something worth announcing in Discord happened. Published by services and
 * delivered by {@link DiscordNotifier} once the surrounding transaction
 * commits, so an announcement can never describe a change that rolled back.
 */
public record DiscordNotification(String message) {
}
