package com.arenamaster.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class ArenaMasterApiApplication {

	public static void main(String[] args) {
		SpringApplication.run(ArenaMasterApiApplication.class, args);
	}

}
