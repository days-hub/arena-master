package com.arenamaster.api.security;

import com.arenamaster.api.config.DiscordProperties;
import com.arenamaster.api.discord.DiscordClient;
import com.arenamaster.api.domain.User;
import com.arenamaster.api.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * Turns a Discord login into a row in {@code users}: first login creates the
 * account, later logins refresh the display name and avatar (people rename
 * themselves) and stamp last_login_at.
 */
@Service
public class DiscordOAuth2UserService extends DefaultOAuth2UserService {

    public static final String ROLE_USER = "ROLE_USER";
    public static final String ROLE_ADMIN = "ROLE_ADMIN";

    private final UserRepository users;
    private final DiscordClient discord;
    private final DiscordProperties discordProps;
    private final List<String> adminDiscordIds;

    public DiscordOAuth2UserService(UserRepository users, DiscordClient discord,
                                    DiscordProperties discordProps,
                                    @Value("${app.admin-discord-ids:}") String adminIds) {
        this.users = users;
        this.discord = discord;
        this.discordProps = discordProps;
        // Admins come from config rather than a hand-edited database flag, so
        // a fresh deployment can bootstrap its first admin without SQL.
        this.adminDiscordIds = Arrays.stream(adminIds.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    // Deliberately not @Transactional: the upsert is a single save(), which
    // Spring Data already runs in its own transaction, and annotating this
    // method makes Spring proxy DefaultOAuth2UserService — whose final methods
    // CGLIB then warns it cannot proxy.
    @Override
    public OAuth2User loadUser(OAuth2UserRequest request) throws OAuth2AuthenticationException {
        OAuth2User oauthUser = super.loadUser(request);
        Map<String, Object> attributes = oauthUser.getAttributes();

        String discordId = (String) attributes.get("id");
        // global_name is Discord's current display name; username is the
        // legacy handle and is always present as a fallback.
        String displayName = (String) attributes.getOrDefault("global_name", null);
        if (displayName == null) {
            displayName = (String) attributes.get("username");
        }
        String avatarHash = (String) attributes.get("avatar");
        String avatarUrl = avatarHash == null ? null
                : "https://cdn.discordapp.com/avatars/%s/%s.png".formatted(discordId, avatarHash);

        // No guild configured means no community to gate on, so don't lock
        // everyone out of a single-tenant install.
        String guildId = discordProps.guildId();
        boolean guildMember = guildId == null || guildId.isBlank()
                || discord.isMemberOfGuild(request.getAccessToken().getTokenValue(), guildId);

        User user = users.findByDiscordId(discordId).orElseGet(User::new);
        user.setDiscordId(discordId);
        user.setUsername(displayName);
        user.setAvatarUrl(avatarUrl);
        user.setGuildMember(guildMember);
        user.setAdmin(adminDiscordIds.contains(discordId));
        user.setLastLoginAt(Instant.now());
        user = users.save(user);

        List<SimpleGrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority(ROLE_USER));
        if (user.isAdmin()) {
            authorities.add(new SimpleGrantedAuthority(ROLE_ADMIN));
        }
        // "id" matches user-name-attribute in the provider config, so
        // Authentication#getName returns the Discord snowflake.
        return new DefaultOAuth2User(authorities, attributes, "id");
    }
}
