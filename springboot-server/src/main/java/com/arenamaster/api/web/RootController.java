package com.arenamaster.api.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Note there is deliberately no mapping for "/". The FastAPI backend answered
 * it with {"message": "Hello World"} and the port reproduced that, but a
 * controller wins over static resources — so in the packaged image it served
 * that JSON to anyone opening the site instead of the app. The React shell
 * owns "/" now.
 */
@RestController
public class RootController {

    @GetMapping("/api/games")
    public List<String> listGames() {
        return List.of("Valorant", "Mario Kart", "Overwatch", "Marvel Rivals", "Fortnite", "League of Legends",
                "Apex Legends", "Minecraft", "Counter-Strike 2", "Rainbow Six Siege", "PUBG",
                "Dota 2", "World of Warcraft", "Hearthstone", "Rocket League", "Smite",
                "Paladins", "Heroes of the Storm", "Starcraft II", "Diablo IV",
                "Warcraft III", "Starcraft: Remastered");
    }
}
