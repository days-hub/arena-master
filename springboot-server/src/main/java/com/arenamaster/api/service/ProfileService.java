package com.arenamaster.api.service;

import com.arenamaster.api.domain.Match;
import com.arenamaster.api.domain.Team;
import com.arenamaster.api.domain.Tournament;
import com.arenamaster.api.domain.User;
import com.arenamaster.api.dto.CareerProfileView;
import com.arenamaster.api.repository.MatchRepository;
import com.arenamaster.api.repository.TeamRepository;
import com.arenamaster.api.repository.TournamentRepository;
import com.arenamaster.api.security.AccessControl;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ProfileService {

    private final TeamRepository teams;
    private final TournamentRepository tournaments;
    private final MatchRepository matches;
    private final AccessControl access;

    public ProfileService(TeamRepository teams, TournamentRepository tournaments,
                          MatchRepository matches, AccessControl access) {
        this.teams = teams;
        this.tournaments = tournaments;
        this.matches = matches;
        this.access = access;
    }

    @Transactional(readOnly = true)
    public CareerProfileView career() {
        User user = access.requireUser();
        List<Team> playerTeams = teams.findAll(Sort.by("id")).stream()
                .filter(team -> team.getMembers().stream()
                        .map(String::valueOf)
                        .anyMatch(user.getDiscordId()::equals))
                .toList();
        Set<String> teamNames = playerTeams.stream().map(Team::getName)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        List<Tournament> allTournaments = tournaments.findAll(Sort.by("id"));
        List<Match> allMatches = matches.findAll(Sort.by("id"));
        Map<Long, List<Match>> matchesByTournament = allMatches.stream()
                .collect(Collectors.groupingBy(match -> match.getTournament().getId()));
        Map<Long, String> champions = new LinkedHashMap<>();
        allTournaments.stream()
                .filter(tournament -> "Completed".equals(tournament.getStatus()))
                .forEach(tournament -> {
                    String champion = champion(matchesByTournament.getOrDefault(tournament.getId(), List.of()));
                    if (champion != null) champions.put(tournament.getId(), champion);
                });

        List<Tournament> appearances = allTournaments.stream()
                .filter(tournament -> tournament.teamNames().stream().anyMatch(teamNames::contains)
                        || matchesByTournament.getOrDefault(tournament.getId(), List.of()).stream()
                        .anyMatch(match -> teamNames.contains(match.getTeamA()) || teamNames.contains(match.getTeamB())))
                .toList();
        int titleCount = (int) appearances.stream()
                .filter(tournament -> teamNames.contains(champions.get(tournament.getId())))
                .count();

        List<Match> playedMatches = allMatches.stream()
                .filter(ProfileService::decided)
                .filter(match -> teamNames.contains(match.getTeamA()) || teamNames.contains(match.getTeamB()))
                .toList();

        int matchWins = 0;
        int gameWins = 0;
        int gameLosses = 0;
        int currentWinStreak = 0;
        int longestWinStreak = 0;
        for (Match match : playedMatches) {
            String playedAs = teamNames.contains(match.getTeamA()) ? match.getTeamA() : match.getTeamB();
            boolean won = playedAs.equals(match.getWinner());
            if (won) {
                matchWins++;
                currentWinStreak++;
                longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
            } else {
                currentWinStreak = 0;
            }
            if (playedAs.equals(match.getTeamA())) {
                gameWins += match.getTeamAScore();
                gameLosses += match.getTeamBScore();
            } else {
                gameWins += match.getTeamBScore();
                gameLosses += match.getTeamAScore();
            }
        }

        Set<String> gamesPlayed = appearances.stream()
                .map(Tournament::getGame)
                .filter(game -> game != null && !game.isBlank())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        List<CareerProfileView.TeamCareerView> teamViews = playerTeams.stream()
                .map(team -> new CareerProfileView.TeamCareerView(
                        team.getId(), team.getName(), team.getAvatarUrl(),
                        countAppearances(team.getName(), allTournaments, matchesByTournament),
                        countTitles(team.getName(), appearances, champions)))
                .toList();
        List<CareerProfileView.CareerMatchView> recent = playedMatches.stream()
                .sorted(Comparator.comparing(Match::getId).reversed())
                .limit(6)
                .map(match -> toCareerMatch(match, teamNames))
                .toList();

        int decidedMatches = playedMatches.size();
        List<CareerProfileView.AchievementView> achievements = List.of(
                achievement("arena_debut", "Arena debut", "Appear in your first tournament.", appearances.size(), 1),
                achievement("squad_up", "Squad up", "Join an Arena Master team.", playerTeams.size(), 1),
                achievement("match_ready", "Match ready", "Complete five tournament matches.", decidedMatches, 5),
                achievement("on_a_roll", "On a roll", "Win three matches in a row.", longestWinStreak, 3),
                achievement("champion", "Champion", "Claim a tournament title.", titleCount, 1),
                achievement("versatile", "Versatile", "Compete across two different games.", gamesPlayed.size(), 2));

        String guildRole = user.isAdmin() ? "Administrator"
                : user.isGuildMember() ? "Guild member" : "Discord member";
        return new CareerProfileView(
                user.getDiscordId(), user.getUsername(), user.getAvatarUrl(), guildRole,
                user.getCreatedAt() == null ? null : user.getCreatedAt().toString(),
                teamViews, appearances.size(), titleCount, matchWins, decidedMatches - matchWins,
                gameWins, gameLosses, List.copyOf(gamesPlayed), recent, achievements);
    }

    private static int countAppearances(String teamName, List<Tournament> tournaments,
                                        Map<Long, List<Match>> matchesByTournament) {
        return (int) tournaments.stream().filter(tournament -> tournament.hasTeam(teamName)
                || matchesByTournament.getOrDefault(tournament.getId(), List.of()).stream()
                .anyMatch(match -> teamName.equals(match.getTeamA()) || teamName.equals(match.getTeamB()))).count();
    }

    private static int countTitles(String teamName, List<Tournament> appearances, Map<Long, String> champions) {
        return (int) appearances.stream().filter(tournament -> teamName.equals(champions.get(tournament.getId()))).count();
    }

    private static CareerProfileView.CareerMatchView toCareerMatch(Match match, Set<String> teamNames) {
        boolean playedTeamA = teamNames.contains(match.getTeamA());
        String team = playedTeamA ? match.getTeamA() : match.getTeamB();
        String opponent = playedTeamA ? match.getTeamB() : match.getTeamA();
        int teamScore = playedTeamA ? match.getTeamAScore() : match.getTeamBScore();
        int opponentScore = playedTeamA ? match.getTeamBScore() : match.getTeamAScore();
        String playedAt = match.getEndTime() == null || match.getEndTime().isBlank()
                ? match.getStartTime() : match.getEndTime();
        return new CareerProfileView.CareerMatchView(
                match.getId(), match.getTournament().getId(), match.getTournament().getName(),
                match.getTournament().getGame(), match.getRoundNumber(), team, opponent,
                teamScore, opponentScore, team.equals(match.getWinner()) ? "W" : "L", playedAt);
    }

    private static CareerProfileView.AchievementView achievement(
            String id, String name, String description, int progress, int goal) {
        return new CareerProfileView.AchievementView(id, name, description,
                progress >= goal, Math.min(progress, goal), goal);
    }

    private static boolean decided(Match match) {
        return match.getWinner() != null && !match.getWinner().isBlank();
    }

    private static String champion(List<Match> matches) {
        int finalRound = matches.stream().mapToInt(Match::getRoundNumber).max().orElse(0);
        return matches.stream()
                .filter(match -> match.getRoundNumber() == finalRound && decided(match))
                .map(Match::getWinner)
                .findFirst()
                .orElse(null);
    }
}
