package com.arenamaster.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * CORS mirror of the old CORSMiddleware(allow_origins=["*"], ...) — but the
 * origins are a property so production can restrict to the real frontend
 * domain with config, not a code change.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.cors.allowed-origins}")
    private String[] allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                // Patterns (not plain origins) because "*" combined with
                // credentials requires the echo-the-origin behavior.
                .allowedOriginPatterns(allowedOrigins)
                .allowedMethods("*")
                .allowedHeaders("*")
                .allowCredentials(true);
    }
}
