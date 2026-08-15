package com.arenamaster.api.service;

import com.arenamaster.api.discord.DiscordClient;
import com.arenamaster.api.domain.Team;
import com.arenamaster.api.dto.AddMemberRequest;
import com.arenamaster.api.dto.CreateTeamRequest;
import com.arenamaster.api.dto.MemberView;
import com.arenamaster.api.dto.TeamView;
import com.arenamaster.api.dto.UpdateTeamAvatarRequest;
import com.arenamaster.api.error.ApiException;
import com.arenamaster.api.notify.DiscordNotification;
import com.arenamaster.api.repository.TeamRepository;
import com.arenamaster.api.security.AccessControl;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

@Service
public class TeamService {

    private final TeamRepository teams;
    private final DiscordClient discord;
    private final ApplicationEventPublisher events;
    private final AccessControl access;
    private final TournamentService tournamentService;

    public TeamService(TeamRepository teams, DiscordClient discord, ApplicationEventPublisher events,
                       AccessControl access, TournamentService tournamentService) {
        this.teams = teams;
        this.discord = discord;
        this.events = events;
        this.access = access;
        this.tournamentService = tournamentService;
    }

    private void announce(String message) {
        events.publishEvent(DiscordNotification.of(message));
    }

    /** For messages that need a lookup before they can be written. */
    private void announceLazy(Supplier<String> message) {
        events.publishEvent(new DiscordNotification(message));
    }

    /**
     * Deliberately NOT @Transactional: the old backend committed the team row
     * and then tried to create its Discord channel — a Discord failure
     * errored the request but the team stayed saved. A transaction here would
     * roll the team back and change observable behavior.
     */
    public TeamView create(CreateTeamRequest request) {
        access.requireGuildMember();
        if (teams.existsByName(request.name())) {
            throw new ApiException(400, "Team already exists");
        }
        Team team = new Team();
        team.setName(request.name());
        team.setMembers(new ArrayList<>(request.membersOrEmpty()));
        refreshAutomaticAvatar(team);
        team = teams.save(team);

        String channelName = request.name().toLowerCase().replace(' ', '-');
        announce("Team \"%s\" has been created.".formatted(request.name()));
        int status = discord.createChannel(channelName);
        if (status != 201) {
            throw new ApiException(status, "Failed to create Discord channel");
        }
        return toView(team);
    }

    /** POST /api/teams/create-channels — same call, "-general" suffix, fixed 400 on failure. */
    public Map<String, String> createChannelFor(String teamName) {
        access.requireGuildMember();
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

    /** Public presentation roster: resolves only members belonging to this team. */
    public List<MemberView> getRosterByName(String name) {
        Team team = teams.findByName(name).orElseThrow(() -> new ApiException(404, "Team not found"));
        List<MemberView> roster = new ArrayList<>();
        for (int index = 0; index < team.getMembers().size(); index++) {
            Long memberId = team.getMembers().get(index);
            MemberView member = discord.fetchMember(memberId);
            roster.add(member != null
                    ? member
                    : new MemberView(String.valueOf(memberId), "Player " + (index + 1), null));
        }
        return roster;
    }

    @Transactional
    public Map<String, String> addMember(AddMemberRequest request) {
        access.requireGuildMember();
        Team team = teams.findById(request.teamId())
                .orElseThrow(() -> new ApiException(404, "Team not found"));
        if (team.getMembers().contains(request.memberId())) {
            throw new ApiException(400, "Member already exists in team");
        }
        team.getMembers().add(request.memberId());
        if (!team.isAvatarCustom()) {
            MemberView latestMember = discord.fetchMember(request.memberId());
            team.setAvatarUrl(latestMember == null ? null : latestMember.avatar());
        }

        // Resolved after commit, off the request thread: we store snowflakes,
        // and announcing a raw id at people would be useless. If Discord
        // can't be reached the announcement still says something true.
        String teamName = team.getName();
        long memberId = request.memberId();
        announceLazy(() -> {
            String displayName = discord.fetchMemberDisplayName(memberId);
            return displayName == null
                    ? "A new member has been added to team \"%s\".".formatted(teamName)
                    : "Member \"%s\" has been added to team \"%s\".".formatted(displayName, teamName);
        });
        return Map.of("message", "Member added to team successfully");
    }

    @Transactional
    public Map<String, String> removeMember(Long teamId, Long memberId) {
        access.requireGuildMember();
        Team team = teams.findById(teamId)
                .orElseThrow(() -> new ApiException(404, "Team not found"));
        if (!team.getMembers().remove(memberId)) {
            throw new ApiException(404, "Member is not part of this team");
        }
        if (!team.isAvatarCustom()) {
            refreshAutomaticAvatar(team);
        }

        String teamName = team.getName();
        announceLazy(() -> {
            String displayName = discord.fetchMemberDisplayName(memberId);
            return displayName == null
                    ? "A member has been removed from team \"%s\".".formatted(teamName)
                    : "Member \"%s\" has been removed from team \"%s\"."
                            .formatted(displayName, teamName);
        });
        return Map.of("message", "Member removed from team successfully");
    }

    @Transactional
    public TeamView update(Long id, CreateTeamRequest request) {
        access.requireGuildMember();
        Team team = teams.findById(id).orElseThrow(() -> new ApiException(404, "Team not found"));
        team.setName(request.name());
        team.setMembers(new ArrayList<>(request.membersOrEmpty()));
        if (!team.isAvatarCustom()) {
            refreshAutomaticAvatar(team);
        }
        return toView(team);
    }

    @Transactional
    public TeamView updateAvatar(Long id, UpdateTeamAvatarRequest request) {
        Team team = teams.findById(id).orElseThrow(() -> new ApiException(404, "Team not found"));
        access.requireCanManage(team);
        String avatarUrl = request.avatarUrl() == null ? "" : request.avatarUrl().strip();
        if (avatarUrl.isEmpty()) {
            team.setAvatarCustom(false);
            refreshAutomaticAvatar(team);
        } else {
            if (avatarUrl.length() > 2048
                    || !(avatarUrl.startsWith("https://") || avatarUrl.startsWith("http://"))) {
                throw new ApiException(400, "Team icon must be a valid HTTP(S) image URL");
            }
            team.setAvatarUrl(avatarUrl);
            team.setAvatarCustom(true);
        }
        return toView(team);
    }

    @Transactional
    public Map<String, String> delete(Long id) {
        access.requireGuildMember();
        Team team = teams.findById(id).orElseThrow(() -> new ApiException(404, "Team not found"));
        tournamentService.dropDeletedTeam(team.getName());
        teams.delete(team);
        announce("Team \"%s\" has been deleted.".formatted(team.getName()));
        return Map.of("message", "Team successfully deleted");
    }

    private TeamView toView(Team team) {
        return new TeamView(team.getId(), team.getName(),
                team.getMembers().stream().map(String::valueOf).toList(), team.getAvatarUrl());
    }

    private void refreshAutomaticAvatar(Team team) {
        if (team.getMembers().isEmpty()) {
            team.setAvatarUrl(null);
            return;
        }
        Long latestMemberId = team.getMembers().get(team.getMembers().size() - 1);
        MemberView latestMember = discord.fetchMember(latestMemberId);
        team.setAvatarUrl(latestMember == null ? null : latestMember.avatar());
    }
}
