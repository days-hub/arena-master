package com.arenamaster.api.web;

import com.arenamaster.api.dto.MatchResultRequest;
import com.arenamaster.api.dto.RegisterTeamRequest;
import com.arenamaster.api.dto.StandingsOptions;
import com.arenamaster.api.dto.TeamStanding;
import com.arenamaster.api.dto.TournamentCreateRequest;
import com.arenamaster.api.dto.TournamentOverview;
import com.arenamaster.api.dto.TournamentResponse;
import com.arenamaster.api.service.TournamentService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
public class TournamentController {

    private final TournamentService service;

    public TournamentController(TournamentService service) {
        this.service = service;
    }

    @GetMapping("/api/tournaments")
    public List<TournamentResponse> list() {
        return service.list();
    }

    // Declared before /{id} in the old code for routing reasons; Spring picks
    // the literal path over the template automatically.
    @GetMapping("/api/tournaments/overview")
    public List<TournamentOverview> overview() {
        return service.overview();
    }

    @GetMapping("/api/standings")
    public List<TeamStanding> standings(@RequestParam(required = false) String game,
                                        @RequestParam(required = false) Long tournamentId,
                                        @RequestParam(required = false) Integer season) {
        return service.standings(game, tournamentId, season);
    }

    @GetMapping("/api/standings/options")
    public StandingsOptions standingsOptions() {
        return service.standingsOptions();
    }

    @GetMapping("/api/tournaments/{id}")
    public TournamentResponse get(@PathVariable Long id) {
        return service.get(id);
    }

    @GetMapping("/api/tournaments/by_name/{tournamentName}")
    public TournamentResponse byName(@PathVariable String tournamentName) {
        return service.byName(tournamentName);
    }

    @PostMapping("/api/tournaments")
    public TournamentResponse create(@RequestBody TournamentCreateRequest request) {
        return service.create(request);
    }

    @PutMapping("/api/tournaments/{id}")
    public TournamentResponse update(@PathVariable Long id, @RequestBody TournamentCreateRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/api/tournaments/{tournamentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long tournamentId) {
        service.delete(tournamentId);
    }

    @PostMapping("/api/tournaments/{tournamentName}/register")
    public Map<String, Object> register(@PathVariable String tournamentName,
                                        @RequestBody RegisterTeamRequest request) {
        return service.register(tournamentName, request);
    }

    @DeleteMapping("/api/tournaments/{id}/teams/{teamName}")
    public Map<String, Object> unregister(@PathVariable Long id, @PathVariable String teamName) {
        return service.unregister(id, teamName);
    }

    @PostMapping("/api/tournaments/{tournamentName}/generate_and_list_matches")
    public Map<String, Object> generateAndListMatches(@PathVariable String tournamentName,
                                                      @RequestParam(defaultValue = "false") boolean force) {
        return service.generateBracket(tournamentName, force);
    }

    @PostMapping("/api/tournaments/{tournamentName}/record_match_result")
    public Map<String, Object> recordMatchResult(@PathVariable String tournamentName,
                                                 @RequestBody MatchResultRequest request) {
        return service.recordResult(tournamentName, request);
    }

    // Identical to record_match_result in the old backend too.
    @PostMapping("/api/tournaments/{tournamentName}/record_submatch_result")
    public Map<String, Object> recordSubmatchResult(@PathVariable String tournamentName,
                                                    @RequestBody MatchResultRequest request) {
        return service.recordResult(tournamentName, request);
    }
}
