package com.arenamaster.api.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;

/**
 * Serves the React build that the container image bakes into
 * {@code classpath:/static/}.
 *
 * React Router owns paths like /profile and /bracket/Summer%20Cup. Those files
 * don't exist on disk, so a plain static handler 404s them and the app breaks
 * on refresh or on a shared link. Anything that isn't a real file falls back
 * to index.html and the router takes over in the browser.
 *
 * In development this does nothing useful — there is no static directory, the
 * React dev server serves the UI on its own port — and the fallback simply
 * doesn't resolve.
 */
@Configuration
public class SpaConfig implements WebMvcConfigurer {

    private static final Resource INDEX = new ClassPathResource("/static/index.html");

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String resourcePath, Resource location) throws IOException {
                        Resource requested = location.createRelative(resourcePath);
                        if (requested.exists() && requested.isReadable()) {
                            return requested;
                        }
                        // Never swallow API or actuator misses: a wrong URL
                        // there should 404, not silently return the HTML shell
                        // and look like a broken client.
                        if (resourcePath.startsWith("api/") || resourcePath.startsWith("actuator/")) {
                            return null;
                        }
                        return INDEX.exists() ? INDEX : null;
                    }
                });
    }
}
