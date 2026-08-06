package com.arenamaster.api.web;

import com.arenamaster.api.dto.AddMemberRequest;
import com.arenamaster.api.dto.CreateTeamRequest;
import com.arenamaster.api.dto.TeamView;
import com.arenamaster.api.service.TeamService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/teams")
public class TeamController {

    private final TeamService service;

    public TeamController(TeamService service) {
        this.service = service;
    }

    @PostMapping
    public TeamView create(@RequestBody CreateTeamRequest request) {
        return service.create(request);
    }

    @GetMapping
    public List<TeamView> list() {
        return service.list();
    }

    // team_name arrives as a QUERY parameter, exactly like the old endpoint.
    @PostMapping("/create-channels")
    public Map<String, String> createChannels(@RequestParam("team_name") String teamName) {
        return service.createChannelFor(teamName);
    }

    @PostMapping("/add_member")
    public Map<String, String> addMember(@RequestBody AddMemberRequest request) {
        return service.addMember(request);
    }

    @GetMapping("/by_name/{teamName}")
    public TeamView byName(@PathVariable String teamName) {
        return service.getByName(teamName);
    }

    @GetMapping("/{id}")
    public TeamView get(@PathVariable Long id) {
        return service.get(id);
    }

    @PutMapping("/{id}")
    public TeamView update(@PathVariable Long id, @RequestBody CreateTeamRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@PathVariable Long id) {
        return service.delete(id);
    }
}
