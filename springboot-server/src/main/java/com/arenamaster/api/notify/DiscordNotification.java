package com.arenamaster.api.notify;

import java.util.function.Supplier;

/**
 * Something worth announcing in Discord happened. Published by services and
 * delivered by {@link DiscordNotifier} once the surrounding transaction
 * commits, so an announcement can never describe a change that rolled back.
 *
 * The message is a supplier rather than a string so that building it can be
 * deferred too. Some announcements need to look something up from Discord
 * first (a member's display name, say); as a supplier that call happens on
 * the notifier's thread after commit, instead of holding a database
 * transaction open and delaying the caller's response.
 */
public record DiscordNotification(Supplier<String> message) {

    /** For the common case where the text is already known. */
    public static DiscordNotification of(String text) {
        return new DiscordNotification(() -> text);
    }
}
