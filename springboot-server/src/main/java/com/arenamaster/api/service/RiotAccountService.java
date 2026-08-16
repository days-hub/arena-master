package com.arenamaster.api.service;

import com.arenamaster.api.config.RiotProperties;
import com.arenamaster.api.domain.RiotAccount;
import com.arenamaster.api.domain.User;
import com.arenamaster.api.dto.LinkRiotAccountRequest;
import com.arenamaster.api.dto.RiotAccountView;
import com.arenamaster.api.error.ApiException;
import com.arenamaster.api.repository.RiotAccountRepository;
import com.arenamaster.api.riot.RiotClient;
import com.arenamaster.api.security.AccessControl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Linking and refreshing League accounts.
 *
 * Riot data is cached in the database and refreshed on a cooldown. A personal
 * API key allows only 100 requests per 2 minutes, so calling Riot while
 * rendering a roster would exhaust the budget on a single page view; a rank
 * that is a few minutes stale is invisible to players.
 */
@Service
@Slf4j
public class RiotAccountService {

    private static final String ICON_CDN = "https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/%d.png";
    private static final Set<String> APEX_TIERS = Set.of("MASTER", "GRANDMASTER", "CHALLENGER");

    private final RiotAccountRepository accounts;
    private final RiotClient riot;
    private final RiotProperties props;
    private final AccessControl access;

    public RiotAccountService(RiotAccountRepository accounts, RiotClient riot,
                              RiotProperties props, AccessControl access) {
        this.accounts = accounts;
        this.riot = riot;
        this.props = props;
        this.access = access;
    }

    public boolean isEnabled() {
        return props.isConfigured();
    }

    @Transactional(readOnly = true)
    public Optional<RiotAccountView> forCurrentUser() {
        User user = access.requireUser();
        return accounts.findByUserId(user.getId()).map(RiotAccountService::toView);
    }

    /**
     * Links a Riot ID to the signed-in user. Only ever the caller's own
     * account — there's no endpoint to link someone else's, because a Riot ID
     * is a claim about yourself.
     */
    @Transactional
    public RiotAccountView link(LinkRiotAccountRequest request) {
        User user = access.requireUser();

        String gameName = request.gameName();
        String tagLine = request.tagLine();
        if (request.riotId() != null && !request.riotId().isBlank()) {
            String[] parts = request.riotId().split("#", 2);
            if (parts.length != 2 || parts[0].isBlank() || parts[1].isBlank()) {
                throw new ApiException(400, "Riot ID must look like \"GameName#TAG\"");
            }
            gameName = parts[0].strip();
            tagLine = parts[1].strip();
        }
        if (gameName == null || gameName.isBlank() || tagLine == null || tagLine.isBlank()) {
            throw new ApiException(400, "Riot ID must look like \"GameName#TAG\"");
        }

        String platform = (request.platform() == null || request.platform().isBlank()
                ? props.defaultPlatform()
                : request.platform()).toLowerCase(Locale.ROOT);
        if (!RiotClient.supportedPlatforms().contains(platform)) {
            throw new ApiException(400, "Unsupported platform '%s'".formatted(platform));
        }

        RiotClient.RiotAccountSummary summary = riot.resolveRiotId(gameName, tagLine, platform);

        // One Riot account per person: claiming an account someone else has
        // already linked would let two users present the same identity.
        accounts.findByPuuid(summary.puuid()).ifPresent(existing -> {
            if (!existing.getUser().getId().equals(user.getId())) {
                throw new ApiException(409, "That Riot account is already linked to another player");
            }
        });

        RiotAccount account = accounts.findByUserId(user.getId()).orElseGet(RiotAccount::new);
        account.setUser(user);
        account.setPuuid(summary.puuid());
        // Riot's canonical spelling, not whatever casing was typed.
        account.setGameName(summary.gameName());
        account.setTagLine(summary.tagLine());
        account.setPlatform(platform);
        account = accounts.save(account);

        refreshFromRiot(account);
        return toView(account);
    }

    @Transactional
    public void unlink() {
        User user = access.requireUser();
        accounts.findByUserId(user.getId()).ifPresent(accounts::delete);
    }

    /** Manual refresh, subject to the same cooldown as everything else. */
    @Transactional
    public RiotAccountView refresh() {
        User user = access.requireUser();
        RiotAccount account = accounts.findByUserId(user.getId())
                .orElseThrow(() -> new ApiException(404, "No Riot account is linked"));
        if (!isStale(account)) {
            throw new ApiException(429, "This profile was refreshed recently. Please try again shortly.");
        }
        refreshFromRiot(account);
        return toView(account);
    }

    /**
     * Linked accounts for a set of Discord ids, for roster display. Served
     * entirely from cache: a roster of eight would otherwise cost sixteen
     * Riot calls every time somebody opened the page.
     */
    @Transactional(readOnly = true)
    public Map<String, RiotAccountView> viewsByDiscordId(List<String> discordIds) {
        if (discordIds.isEmpty()) {
            return Map.of();
        }
        return accounts.findByUserDiscordIdIn(discordIds).stream()
                .collect(Collectors.toMap(a -> a.getUser().getDiscordId(),
                        RiotAccountService::toView,
                        (first, second) -> first));
    }

    private boolean isStale(RiotAccount account) {
        return account.getLastSyncedAt() == null
                || account.getLastSyncedAt().isBefore(Instant.now().minus(props.profileTtl()));
    }

    /**
     * Pulls level and rank from Riot. Failures are logged and swallowed: a
     * linked account with a stale rank is more useful than a link attempt
     * that fails because Riot is briefly unavailable.
     */
    private void refreshFromRiot(RiotAccount account) {
        try {
            RiotClient.RiotSummoner summoner = riot.fetchSummoner(account.getPuuid(), account.getPlatform());
            if (summoner != null) {
                account.setSummonerLevel(summoner.summonerLevel());
                account.setProfileIconId(summoner.profileIconId());
            }
            RiotClient.RiotRank rank = riot.fetchSoloQueueRank(account.getPuuid(), account.getPlatform());
            account.setTier(rank == null ? null : rank.tier());
            account.setDivision(rank == null ? null : rank.division());
            account.setLeaguePoints(rank == null ? null : rank.leaguePoints());
            account.setWins(rank == null ? null : rank.wins());
            account.setLosses(rank == null ? null : rank.losses());
            account.setLastSyncedAt(Instant.now());
        } catch (ApiException e) {
            log.warn("Could not refresh Riot profile for {}: {}", account.riotId(), e.getMessage());
        }
    }

    private static RiotAccountView toView(RiotAccount account) {
        return new RiotAccountView(
                account.riotId(),
                account.getPlatform(),
                account.getSummonerLevel(),
                account.getProfileIconId() == null ? null : ICON_CDN.formatted(account.getProfileIconId()),
                account.getTier(),
                account.getDivision(),
                account.getLeaguePoints(),
                account.getWins(),
                account.getLosses(),
                rankLabel(account),
                account.getLastSyncedAt() == null ? null : account.getLastSyncedAt().toString());
    }

    private static String rankLabel(RiotAccount account) {
        if (account.getTier() == null) {
            return "Unranked";
        }
        String tier = account.getTier().charAt(0) + account.getTier().substring(1).toLowerCase(Locale.ROOT);
        // Master, Grandmaster and Challenger have no divisions, so "Master I"
        // would be wrong rather than merely redundant.
        boolean apex = APEX_TIERS.contains(account.getTier());
        String base = apex || account.getDivision() == null ? tier : tier + " " + account.getDivision();
        return account.getLeaguePoints() == null ? base : base + " · " + account.getLeaguePoints() + " LP";
    }
}
