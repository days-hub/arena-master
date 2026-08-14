package com.arenamaster.api.notify;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
public class NotificationExecutorConfig {

    /**
     * Discord announcements run off the request thread but must arrive in the
     * order they happened — on the default pool they race, and a channel can
     * show a team registering after the tournament it entered has finished.
     * A single worker with a FIFO queue keeps delivery ordered while still
     * keeping the webhook call out of the request path.
     */
    @Bean
    public Executor discordNotificationExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("discord-notify-");
        executor.initialize();
        return executor;
    }
}
