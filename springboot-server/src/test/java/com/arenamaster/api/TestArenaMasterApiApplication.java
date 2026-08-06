package com.arenamaster.api;

import org.springframework.boot.SpringApplication;

public class TestArenaMasterApiApplication {

	public static void main(String[] args) {
		SpringApplication.from(ArenaMasterApiApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
