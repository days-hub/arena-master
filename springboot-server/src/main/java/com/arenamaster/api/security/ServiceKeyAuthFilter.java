package com.arenamaster.api.security;

import com.arenamaster.api.domain.User;
import com.arenamaster.api.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Authenticates the Discord bot, which can't perform a browser OAuth redirect.
 *
 * The bot presents a shared secret in X-Service-Key plus the Discord id of
 * whoever typed the command in X-Acting-User. The key proves the request came
 * from the bot; the acting user decides what it's allowed to do. Bot actions
 * are therefore attributable to a person and obey exactly the same ownership
 * rules as the web UI — the alternative, a bot that is simply a superuser,
 * would make anyone who can type in the channel an admin.
 *
 * Requests carrying a valid key but no known acting user are rejected rather
 * than falling back to elevated access.
 */
@Component
@Slf4j
public class ServiceKeyAuthFilter extends OncePerRequestFilter {

    public static final String KEY_HEADER = "X-Service-Key";
    public static final String ACTING_USER_HEADER = "X-Acting-User";

    private final String serviceKey;
    private final UserRepository users;

    public ServiceKeyAuthFilter(@Value("${app.service-key:}") String serviceKey, UserRepository users) {
        this.serviceKey = serviceKey;
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String presented = request.getHeader(KEY_HEADER);
        // No key configured means service auth is switched off entirely; an
        // absent header is just a normal browser request.
        if (serviceKey.isBlank() || presented == null) {
            chain.doFilter(request, response);
            return;
        }
        if (!constantTimeEquals(presented, serviceKey)) {
            log.warn("Rejected a request with an invalid service key from {}", request.getRemoteAddr());
            deny(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid service key");
            return;
        }

        String actingDiscordId = request.getHeader(ACTING_USER_HEADER);
        if (actingDiscordId == null || actingDiscordId.isBlank()) {
            deny(response, HttpServletResponse.SC_UNAUTHORIZED,
                    "%s is required alongside %s".formatted(ACTING_USER_HEADER, KEY_HEADER));
            return;
        }

        Optional<User> acting = users.findByDiscordId(actingDiscordId);
        if (acting.isEmpty()) {
            // The person has never signed in, so there's no account whose
            // permissions could be applied.
            deny(response, HttpServletResponse.SC_FORBIDDEN,
                    "Sign in to Arena Master on the web once before using bot commands");
            return;
        }

        User user = acting.get();
        List<SimpleGrantedAuthority> authorities = new ArrayList<>();
        authorities.add(new SimpleGrantedAuthority(DiscordOAuth2UserService.ROLE_USER));
        if (user.isAdmin()) {
            authorities.add(new SimpleGrantedAuthority(DiscordOAuth2UserService.ROLE_ADMIN));
        }
        // Principal name is the Discord id, matching what CurrentUser resolves
        // for browser sessions, so downstream code can't tell the two apart.
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(user.getDiscordId(), null, authorities);
        SecurityContextHolder.getContext().setAuthentication(auth);

        user.setLastLoginAt(Instant.now());
        users.save(user);

        try {
            chain.doFilter(request, response);
        } finally {
            // Per-request only: the bot's identity must not leak into the
            // thread's next request.
            SecurityContextHolder.clearContext();
        }
    }

    /**
     * Writes the refusal directly rather than via sendError: sendError forwards
     * to /error, which re-enters the security chain as an anonymous request and
     * comes back out as a 401 no matter what status was set. Writing the body
     * here also keeps the {"detail": "..."} shape every other error uses.
     */
    private static void deny(HttpServletResponse response, int status, String detail) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"detail\":\"%s\"}".formatted(detail.replace("\"", "\\\"")));
    }

    private static boolean constantTimeEquals(String a, String b) {
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }
}
