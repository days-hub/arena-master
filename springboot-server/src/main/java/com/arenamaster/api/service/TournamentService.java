package com.arenamaster.api.service;

import com.arenamaster.api.domain.Match;
import com.arenamaster.api.domain.Tournament;
import com.arenamaster.api.domain.User;
import com.arenamaster.api.dto.GeneratedMatch;
import com.arenamaster.api.dto.MatchResultRequest;
import com.arenamaster.api.dto.MatchView;
import com.arenamaster.api.dto.ParticipantView;
import com.arenamaster.api.dto.RegisterTeamRequest;
import com.arenamaster.api.dto.TeamStanding;
import com.arenamaster.api.dto.TournamentCreateRequest;
import com.arenamaster.api.dto.TournamentOverview;
import com.arenamaster.api.dto.TournamentResponse;
import com.arenamaster.api.error.ApiException;
import com.arenamaster.api.notify.DiscordNotification;
import com.arenamaster.api.repository.MatchRepository;
import com.arenamaster.api.repository.TournamentRepository;
import com.arenamaster.api.security.AccessControl;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * The tournament logic from main.py: creation, registration, bracket
 * generation, result recording with round advancement, plus the dashboard
 * (overview) and standings aggregations.
 */
@Service
public class TournamentService {

    private static final DateTimeFormatter SQL_TIMESTAMP = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final List<String> ACTIVE_STATUSES = List.of("Created", "Ongoing");

    private final TournamentRepository tournaments;
    private final MatchRepository matches;
    private final ApplicationEventPublisher events;
    private final AccessControl access;

    public TournamentService(TournamentRepository tournaments, MatchRepository matches,
                             ApplicationEventPublisher events, AccessControl access) {
        this.tournaments = tournaments;
        this.matches = matches;
        this.events = events;
        this.access = access;
    }

    private void announce(String message) {
        events.publishEvent(new DiscordNotification(message));
    }

    // ---------- CRUD ----------

    public List<TournamentResponse> list() {
        return tournaments.findAll(Sort.by("id")).stream().map(this::summaryResponse).toList();
    }

    public TournamentResponse get(Long id) {
        Tournament t = tournaments.findById(id)
                .orElseThrow(() -> new ApiException(404, "Tournament not found"));
        return summaryResponse(t);
    }

    public TournamentResponse create(TournamentCreateRequest request) {
        User creator = access.requireGuildMember();
        String name = request.name() == null ? "" : request.name().strip();
        if (name.isEmpty()) {
            throw new ApiException(400, "Tournament name cannot be empty.");
        }
        if (tournaments.existsByNameAndStatusIn(name, ACTIVE_STATUSES)) {
            throw new ApiException(400, "A tournament with this name is already ongoing or has been created.");
        }
        Tournament t = new Tournament();
        t.setName(name);
        t.setGame(request.game());
        t.setFormat(request.formatOrDefault());
        t.setCreatedBy(creator);
        try {
            t = tournaments.save(t);
        } catch (DataIntegrityViolationException e) {
            // Race on the partial unique index — same 400 the old backend gave.
            throw new ApiException(400, "Tournament with name '%s' already exists.".formatted(name));
        }
        announce("A new tournament \"%s\" has been created for %s in %s format."
                .formatted(name, t.getGame(), t.getFormat()));
        return new TournamentResponse(t.getId(), name, t.getGame(), t.getFormat(), List.of(), List.of());
    }

    @Transactional
    public TournamentResponse update(Long id, TournamentCreateRequest request) {
        // Legacy: no 404 here — updating a missing id was a silent no-op that
        // still echoed the request back.
        tournaments.findById(id).ifPresent(t -> {
            access.requireCanManage(t);
            t.setName(request.name());
            t.setGame(request.game());
            t.setFormat(request.formatOrDefault());
        });
        return new TournamentResponse(id, request.name(), request.game(), request.formatOrDefault(),
                List.of(), List.of());
    }

    @Transactional
    public void delete(Long id) {
        // Legacy: deleting a missing id still returned 204. Matches go with
        // the tournament via the FK's ON DELETE CASCADE.
        tournaments.findById(id).ifPresent(t -> {
            access.requireCanManage(t);
            tournaments.delete(t);
        });
    }

    // ---------- Registration ----------

    @Transactional
    public Map<String, Object> register(String tournamentName, RegisterTeamRequest request) {
        // Any guild member may enter a team; managing the bracket is the
        // creator's job, but signing up shouldn't be.
        access.requireGuildMember();
        Tournament t = findByNameOr404(tournamentName,
                "Tournament '%s' not found".formatted(tournamentName));
        if (t.hasTeam(request.teamName())) {
            throw new ApiException(400, "Team '%s' is already registered for the tournament '%s'"
                    .formatted(request.teamName(), tournamentName));
        }
        t.registerTeam(request.teamName());
        announce("Team \"%s\" has been registered for tournament \"%s\"."
                .formatted(request.teamName(), tournamentName));
        return Map.of("message", "Team '%s' registered for tournament '%s' successfully"
                .formatted(request.teamName(), tournamentName));
    }

    // ---------- Bracket views ----------

    @Transactional(readOnly = true)
    public TournamentResponse byName(String tournamentName) {
        Tournament t = findByNameOr404(tournamentName, "Tournament not found");
        List<MatchView> views = matches.findByTournamentIdOrderById(t.getId()).stream()
                .map(this::toMatchView)
                .toList();
        return new TournamentResponse(t.getId(), t.getName(), t.getGame(), t.getFormat(),
                t.teamNames(), views);
    }

    @Transactional
    public Map<String, Object> generateBracket(String tournamentName, boolean force) {
        Tournament t = findByNameOr404(tournamentName, "Tournament not found");
        access.requireCanManage(t);
        List<String> teams = new ArrayList<>(t.teamNames());
        if (teams.isEmpty()) {
            return Map.of("message", "No teams registered for the tournament");
        }
        if (teams.size() < 2) {
            return Map.of("message", "Not enough teams to generate matches");
        }
        // Single elimination without byes needs a power-of-two team count.
        if (Integer.bitCount(teams.size()) != 1) {
            return Map.of("message", "Team count must be a power of two (2, 4, 8, ...) to generate a bracket");
        }

        List<Match> existing = matches.findByTournamentIdOrderById(t.getId());
        if (!existing.isEmpty() && !force) {
            // Idempotency guard: return the round-1 matches instead of
            // silently inserting a duplicate bracket.
            List<GeneratedMatch> round1 = existing.stream()
                    .filter(m -> m.getRoundNumber() == 1)
                    .map(this::toGeneratedMatch)
                    .toList();
            return Map.of("matches", round1, "message", "Bracket already generated");
        }
        if (!existing.isEmpty()) {
            matches.deleteAll(existing);
        }

        Collections.shuffle(teams); // seeding is random, round 1 only
        List<Match> created = createRound(t, 1, teams);
        t.setStatus("Ongoing");
        return Map.of("matches", created.stream().map(this::toGeneratedMatch).toList());
    }

    // ---------- Result recording + round advancement ----------

    @Transactional
    public Map<String, Object> recordResult(String tournamentName, MatchResultRequest request) {
        Tournament t = findByNameOr404(tournamentName, "Tournament not found");
        access.requireCanManage(t);
        Match match = matches.findByTournamentIdAndMatchNumber(t.getId(), request.matchNumber())
                .orElseThrow(() -> new ApiException(404, "Match not found"));

        int scoreA = match.getTeamAScore();
        int scoreB = match.getTeamBScore();
        if (request.winnerTeamName().equals(match.getTeamA())) {
            scoreA++;
        } else if (request.winnerTeamName().equals(match.getTeamB())) {
            scoreB++;
        } else {
            throw new ApiException(400, "Invalid winning team");
        }
        match.setTeamAScore(scoreA);
        match.setTeamBScore(scoreB);
        match.setEndTime(LocalDateTime.now().format(SQL_TIMESTAMP));

        int winningScore = switch (t.getFormat()) {
            case "bo3" -> 2;
            case "bo5" -> 3;
            case "bo7" -> 4;
            default -> 1; // bo1
        };
        String winner = null;
        if (scoreA == winningScore) {
            winner = match.getTeamA();
        } else if (scoreB == winningScore) {
            winner = match.getTeamB();
        }
        if (winner != null) {
            match.setWinner(winner);
        }

        String message = winner == null
                ? "%s takes Game %d! The score is now %d-%d."
                        .formatted(request.winnerTeamName(), scoreA + scoreB, scoreA, scoreB)
                : "%s takes Game %d, winning Match %d with a score of %d-%d!"
                        .formatted(winner, scoreA + scoreB, request.matchNumber(), scoreA, scoreB);

        List<Match> all = matches.findByTournamentIdOrderById(t.getId());
        List<Match> roundMatches = all.stream()
                .filter(m -> m.getRoundNumber() == match.getRoundNumber())
                .toList();
        boolean roundComplete = roundMatches.stream().allMatch(m -> hasWinner(m.getWinner()));

        Map<String, Object> response = new LinkedHashMap<>();
        if (!roundComplete) {
            announce(message);
            response.put("message", message);
            return response;
        }

        int nextRoundNumber = all.stream().mapToInt(Match::getRoundNumber).max().orElse(0) + 1;
        List<String> nextRoundTeams = roundMatches.stream().map(Match::getWinner).toList();
        if (nextRoundTeams.size() == 1) {
            t.setStatus("Completed");
            message += "\n\n🏆 The tournament is complete! Congratulations to the winner: %s. What an epic journey! 🎉"
                    .formatted(nextRoundTeams.get(0));
            announce(message);
            response.put("message", message);
            return response;
        }

        List<GeneratedMatch> nextRound = createRound(t, nextRoundNumber, nextRoundTeams).stream()
                .map(this::toGeneratedMatch)
                .toList();
        message += "\n\nNext round matches generated:\n" + nextRound.stream()
                .map(m -> "Match %d: %s vs %s".formatted(m.matchId(), m.teamA(), m.teamB()))
                .collect(Collectors.joining("\n"));
        announce(message);
        response.put("message", message);
        response.put("next_round_matches", nextRound);
        return response;
    }

    // ---------- Aggregations ----------

    @Transactional(readOnly = true)
    public List<TournamentOverview> overview() {
        List<Tournament> all = tournaments.findAll(Sort.by("id"));
        List<Match> allMatches = matches.findAll(Sort.by("id"));

        List<TournamentOverview> overview = new ArrayList<>();
        for (Tournament t : all) {
            List<Match> tMatches = allMatches.stream()
                    .filter(m -> m.getTournament().getId().equals(t.getId()))
                    .toList();
            int teamCount = t.getRegistrations().size();
            int decided = (int) tMatches.stream().filter(m -> hasWinner(m.getWinner())).count();
            int currentRound = tMatches.stream().mapToInt(Match::getRoundNumber).max().orElse(0);
            // Single elim: a bracket of N teams has log2(N) rounds.
            int totalRounds = teamCount > 1
                    ? Math.max(1, 32 - Integer.numberOfLeadingZeros(teamCount - 1))
                    : 0;
            String champion = "Completed".equals(t.getStatus()) ? champion(tMatches) : null;
            overview.add(new TournamentOverview(t.getId(), t.getName(), t.getGame(), t.getFormat(),
                    t.getStatus(), teamCount, tMatches.size(), decided, currentRound, totalRounds, champion));
        }
        return overview;
    }

    @Transactional(readOnly = true)
    public List<TeamStanding> standings() {
        List<Match> allMatches = matches.findAll(Sort.by("id"));
        List<Tournament> all = tournaments.findAll(Sort.by("id"));

        Map<String, TeamStanding> stats = new LinkedHashMap<>();
        for (Match m : allMatches) {
            String a = m.getTeamA();
            String b = m.getTeamB();
            if (a == null || a.isEmpty() || b == null || b.isEmpty()) {
                continue;
            }
            // Games count whenever any were recorded, even mid-series.
            TeamStanding sa = stats.computeIfAbsent(a, TeamStanding::new);
            TeamStanding sb = stats.computeIfAbsent(b, TeamStanding::new);
            sa.gameWins += m.getTeamAScore();
            sa.gameLosses += m.getTeamBScore();
            sb.gameWins += m.getTeamBScore();
            sb.gameLosses += m.getTeamAScore();
            // Matches only count once decided.
            if (hasWinner(m.getWinner())) {
                String loser = m.getWinner().equals(a) ? b : a;
                stats.computeIfAbsent(m.getWinner(), TeamStanding::new).matchWins++;
                stats.computeIfAbsent(loser, TeamStanding::new).matchLosses++;
            }
        }

        // Titles: champion = winner of the highest round in each Completed tournament.
        for (Tournament t : all) {
            if (!"Completed".equals(t.getStatus())) {
                continue;
            }
            List<Match> tMatches = allMatches.stream()
                    .filter(m -> m.getTournament().getId().equals(t.getId()))
                    .toList();
            String champion = champion(tMatches);
            if (champion != null) {
                stats.computeIfAbsent(champion, TeamStanding::new).titles++;
            }
        }

        List<TeamStanding> standings = new ArrayList<>(stats.values());
        standings.sort(Comparator.comparingInt((TeamStanding s) -> s.titles)
                .thenComparingInt(s -> s.matchWins)
                .thenComparingInt(s -> s.gameWins)
                .reversed());
        return standings;
    }

    // ---------- Helpers ----------

    private Tournament findByNameOr404(String name, String detail) {
        // findFirst mirrors the old fetch_one: completed tournaments may share
        // a name, and the earliest row wins.
        return tournaments.findFirstByNameOrderById(name)
                .orElseThrow(() -> new ApiException(404, detail));
    }

    private List<Match> createRound(Tournament t, int roundNumber, List<String> teams) {
        List<Match> created = new ArrayList<>();
        for (int i = 0; i + 1 < teams.size(); i += 2) {
            Match m = new Match();
            m.setTournament(t);
            m.setTeamA(teams.get(i));
            m.setTeamB(teams.get(i + 1));
            m.setRoundNumber(roundNumber);
            m = matches.save(m);
            // Legacy quirk: match_number mirrors the row id.
            m.setMatchNumber(m.getId().intValue());
            created.add(m);
        }
        return created;
    }

    private static boolean hasWinner(String winner) {
        return winner != null && !winner.isEmpty();
    }

    private static String champion(List<Match> tMatches) {
        if (tMatches.isEmpty()) {
            return null;
        }
        int finalRound = tMatches.stream().mapToInt(Match::getRoundNumber).max().orElse(0);
        return tMatches.stream()
                .filter(m -> m.getRoundNumber() == finalRound && hasWinner(m.getWinner()))
                .map(Match::getWinner)
                .findFirst()
                .orElse(null);
    }

    private TournamentResponse summaryResponse(Tournament t) {
        // teams/matches deliberately empty — see TournamentResponse javadoc.
        return new TournamentResponse(t.getId(), t.getName(), t.getGame(), t.getFormat(),
                List.of(), List.of());
    }

    private GeneratedMatch toGeneratedMatch(Match m) {
        return new GeneratedMatch(m.getId(), m.getTeamA(), m.getTeamB());
    }

    private MatchView toMatchView(Match m) {
        return new MatchView(m.getId(), m.getStartTime(), m.getState(), m.getRoundNumber(), m.getWinner(),
                List.of(participant(m.getTeamA(), m.getTeamAScore(), m.getWinner()),
                        participant(m.getTeamB(), m.getTeamBScore(), m.getWinner())));
    }

    private ParticipantView participant(String team, int score, String winner) {
        return new ParticipantView(team, score, team != null && team.equals(winner), "PLAYED", team);
    }
}
