package com.arenamaster.api.security;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
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
    private final ServiceKeyAuthFilter serviceKeyAuthFilter;

    public SecurityConfig(DiscordOAuth2UserService discordUserService,
                          ObjectProvider<ClientRegistrationRepository> clientRegistrations,
                          ServiceKeyAuthFilter serviceKeyAuthFilter) {
        this.discordUserService = discordUserService;
        this.clientRegistrations = clientRegistrations;
        this.serviceKeyAuthFilter = serviceKeyAuthFilter;
    }

    /**
     * Boot registers every Filter bean in the main servlet chain as well;
     * disable that so the filter runs only where it's placed below, inside
     * the security chain.
     */
    @Bean
    public FilterRegistrationBean<ServiceKeyAuthFilter> disableAutoRegistration(ServiceKeyAuthFilter filter) {
        FilterRegistrationBean<ServiceKeyAuthFilter> registration = new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        SimpleUrlAuthenticationSuccessHandler successHandler = new SimpleUrlAuthenticationSuccessHandler(frontendUrl);
        // Don't restore a pre-login "saved request": the API request that
        // triggered the redirect isn't where a human wants to land.
        successHandler.setAlwaysUseDefaultTargetUrl(true);

        http
                // Runs before the session is consulted, so the bot's key
                // authenticates the request without needing a cookie.
                .addFilterBefore(serviceKeyAuthFilter, UsernamePasswordAuthenticationFilter.class)
                // Picks up the MVC CORS config in WebConfig.
                .cors(Customizer.withDefaults())
                // Stateless-style API consumed by a separate origin and by the
                // Discord bot; neither can carry a CSRF token. Session cookies
                // are SameSite=Lax, which blocks the cross-site form posts CSRF
                // tokens exist to stop.
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        // Reading a bracket, the standings or the dashboard
                        // stays open to anyone — spectators don't sign in.
                        .requestMatchers(HttpMethod.GET,
                                "/", "/api/games", "/api/tournaments/**", "/api/standings",
                                "/api/teams", "/api/teams/**").permitAll()
                        .requestMatchers("/actuator/health").permitAll()
                        // Reports 401 itself, with a body the frontend reads.
                        .requestMatchers("/api/me").permitAll()
                        // Login endpoints must stay reachable while signed out.
                        .requestMatchers("/oauth2/**", "/login/**").permitAll()
                        // Everything else — every write, plus the guild member
                        // list and the notify relay — needs an account.
                        .anyRequest().authenticated())
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
