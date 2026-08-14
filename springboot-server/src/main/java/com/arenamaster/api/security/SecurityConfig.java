package com.arenamaster.api.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;

@Configuration
@EnableWebSecurity
@Slf4j
public class SecurityConfig {

    @Value("${app.frontend-url}")
    private String frontendUrl;

    private final DiscordOAuth2UserService discordUserService;
    private final ObjectProvider<ClientRegistrationRepository> clientRegistrations;

    public SecurityConfig(DiscordOAuth2UserService discordUserService,
                          ObjectProvider<ClientRegistrationRepository> clientRegistrations) {
        this.discordUserService = discordUserService;
        this.clientRegistrations = clientRegistrations;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        SimpleUrlAuthenticationSuccessHandler successHandler = new SimpleUrlAuthenticationSuccessHandler(frontendUrl);
        // Don't restore a pre-login "saved request": the API request that
        // triggered the redirect isn't where a human wants to land.
        successHandler.setAlwaysUseDefaultTargetUrl(true);

        http
                // Picks up the MVC CORS config in WebConfig.
                .cors(Customizer.withDefaults())
                // Stateless-style API consumed by a separate origin and by the
                // Discord bot; neither can carry a CSRF token. Session cookies
                // are SameSite=Lax, which blocks the cross-site form posts CSRF
                // tokens exist to stop.
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        // Stage A: nothing is locked down yet — logging in
                        // works and /api/me reports who you are, while every
                        // existing client keeps working unchanged.
                        .anyRequest().permitAll())
                .logout(logout -> logout
                        .logoutUrl("/api/logout")
                        .logoutSuccessHandler((request, response, authentication) ->
                                response.setStatus(HttpStatus.NO_CONTENT.value()))
                        .deleteCookies("JSESSIONID"))
                // Browsers must get a 401 to handle, not a redirect to a
                // Discord login page rendered inside an XHR response.
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)));

        // Only wire the login flow when Discord credentials exist; without
        // them the API still serves, it just has no way to sign anyone in.
        if (clientRegistrations.getIfAvailable() != null) {
            http.oauth2Login(oauth -> oauth
                    .userInfoEndpoint(info -> info.userService(discordUserService))
                    .successHandler(successHandler));
        } else {
            log.warn("DISCORD_CLIENT_ID is not set — Discord login is disabled.");
        }

        return http.build();
    }
}
