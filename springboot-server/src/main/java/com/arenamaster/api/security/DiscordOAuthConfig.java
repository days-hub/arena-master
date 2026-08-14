package com.arenamaster.api.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;

/**
 * Registers Discord as an OAuth2 login provider — but only when credentials
 * are actually configured.
 *
 * Boot's property-driven registration refuses to start the application at all
 * if the client id is blank, which would make a missing optional integration
 * fatal to the whole API. Building the registration here behind
 * {@code @ConditionalOnProperty} means an unconfigured install simply has no
 * login option.
 *
 * Discord isn't one of Spring's built-in providers, so every endpoint is
 * spelled out.
 */
// An expression, not @ConditionalOnProperty: the property is always declared
// (defaulting to blank), and @ConditionalOnProperty counts a blank value as
// present, which is exactly the case this needs to exclude.
@Configuration
@ConditionalOnExpression("'${discord.oauth.client-id:}'.length() > 0")
public class DiscordOAuthConfig {

    @Bean
    public ClientRegistrationRepository clientRegistrationRepository(
            @Value("${discord.oauth.client-id}") String clientId,
            @Value("${discord.oauth.client-secret}") String clientSecret) {

        ClientRegistration discord = ClientRegistration.withRegistrationId("discord")
                .clientId(clientId)
                .clientSecret(clientSecret)
                // Discord expects credentials in the form body, not a header.
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("{baseUrl}/login/oauth2/code/{registrationId}")
                // identify = who they are; guilds = which servers they're in,
                // so membership of your server can gate access later.
                .scope("identify", "guilds")
                .authorizationUri("https://discord.com/api/oauth2/authorize")
                .tokenUri("https://discord.com/api/oauth2/token")
                .userInfoUri("https://discord.com/api/users/@me")
                .userNameAttributeName("id")
                .clientName("Discord")
                .build();

        return new InMemoryClientRegistrationRepository(discord);
    }
}
