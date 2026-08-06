package com.arenamaster.api.service;

import com.arenamaster.api.discord.DiscordClient;
import com.arenamaster.api.domain.Team;
import com.arenamaster.api.dto.AddMemberRequest;
import com.arenamaster.api.dto.CreateTeamRequest;
import com.arenamaster.api.dto.TeamView;
import com.arenamaster.api.error.ApiException;
import com.arenamaster.api.repository.TeamRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class TeamService {

    private final TeamRepository teams;
    private final DiscordClient discord;

    public TeamService(TeamRepository teams, DiscordClient discord) {
        this.teams = teams;
        this.discord = discord;
    }

    /**
     * Deliberately NOT @Transactional: the old backend committed the team row
     * and then tried to create its Discord channel — a Discord failure
     * errored the request but the team stayed saved. A transaction here would
     * roll the team back and change observable behavior.
     */
    public TeamView create(CreateTeamRequest request) {
        if (teams.existsByName(request.name())) {
            throw new ApiException(400, "Team already exists");
        }
        Team team = new Team();
        team.setName(request.name());
        team.setMembers(new ArrayList<>(request.membersOrEmpty()));
        team = teams.save(team);

        String channelName = request.name().toLowerCase().replace(' ', '-');
        int status = discord.createChannel(channelName);
        if (status != 201) {
            throw new ApiException(status, "Failed to create Discord channel");
        }
        return toView(team);
    }

    /** POST /api/teams/create-channels — same call, "-general" suffix, fixed 400 on failure. */
    public Map<String, String> createChannelFor(String teamName) {
        String channelName = teamName.toLowerCase().replace(' ', '-') + "-general";
        int status = discord.createChannel(channelName);
        if (status != 201) {
            throw new ApiException(400, "Failed to create Discord channel");
        }
        return Map.of("message", "Channel '%s' created for team '%s'".formatted(channelName, teamName));
    }

    public List<TeamView> list() {
        return teams.findAll(Sort.by("id")).stream().map(this::toView).toList();
    }

    public TeamView get(Long id) {
        return toView(teams.findById(id).orElseThrow(() -> new ApiException(404, "Team not found")));
    }

    public TeamView getByName(String name) {
        return toView(teams.findByName(name).orElseThrow(() -> new ApiException(404, "Team not found")));
    }

    @Transactional
    public Map<String, String> addMember(AddMemberRequest request) {
        Team team = teams.findById(request.teamId())
                .orElseThrow(() -> new ApiException(404, "Team not found"));
        if (team.getMembers().contains(request.memberId())) {
            throw new ApiException(400, "Member already exists in team");
        }
        team.getMembers().add(request.memberId());
        return Map.of("message", "Member added to team successfully");
    }

    @Transactional
    public TeamView update(Long id, CreateTeamRequest request) {
        Team team = teams.findById(id).orElseThrow(() -> new ApiException(404, "Team not found"));
        team.setName(request.name());
        team.setMembers(new ArrayList<>(request.membersOrEmpty()));
        return toView(team);
    }

    public Map<String, String> delete(Long id) {
        Team team = teams.findById(id).orElseThrow(() -> new ApiException(404, "Team not found"));
        teams.delete(team);
        return Map.of("message", "Team successfully deleted");
    }

    private TeamView toView(Team team) {
        return new TeamView(team.getId(), team.getName(), team.getMembers());
    }
}
