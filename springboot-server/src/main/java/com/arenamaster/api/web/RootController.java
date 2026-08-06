package com.arenamaster.api.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
public class RootController {

    @GetMapping("/")
    public Map<String, String> root() {
        return Map.of("message", "Hello World");
    }

    @GetMapping("/api/games")
    public List<String> listGames() {
        return List.of("Valorant", "Mario Kart", "Overwatch", "Fortnite", "League of Legends",
                "Apex Legends", "Minecraft", "CS:GO", "Rainbow Six Siege", "PUBG",
                "Dota 2", "World of Warcraft", "Hearthstone", "Rocket League", "Smite",
                "Paladins", "Heroes of the Storm", "Starcraft II", "Diablo III",
                "Warcraft III", "Starcraft: Remastered", "HOTS", "SC2", "D3", "WC3", "SCR");
    }
}
