package com.arenamaster.api.web;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RootControllerTest {

    @Test
    void catalogUsesCurrentCompetitiveGameNames() {
        var games = new RootController().listGames();

        assertThat(games)
                .contains("Marvel Rivals", "Counter-Strike 2", "Diablo IV")
                .doesNotContain("CS:GO", "Diablo III", "HOTS", "SC2", "D3", "WC3", "SCR");
    }
}
