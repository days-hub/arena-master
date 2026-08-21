import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Avatar, Box, Card, Chip, Stack, Tab, Tabs, Typography, useMediaQuery,
} from '@mui/material';
import {
  BoltRounded, EmojiEventsRounded, HourglassTopRounded,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { buildChampionPath, roundOf } from '../tournamentUtils';
import { CelebrationBurst, LiveDot } from './Motion';

const CARD_WIDTH = 264;
const CARD_HEIGHT = 148;
const ROUND_GAP = 92;
const SLOT_HEIGHT = 184;
const STAGE_PADDING = 28;
const REPLAY_STEP_MS = 380;

const hasRealTeam = (participant) => participant?.name && participant.name !== 'TBD';
const winnerOf = (match) => match.participants?.find((participant) => participant.isWinner)?.name || '';

const roundLabel = (round, matchCount, totalRounds) => {
  if (round === totalRounds || matchCount === 1) return 'Final';
  if (matchCount === 2) return 'Semifinals';
  if (matchCount === 4) return 'Quarterfinals';
  return `Round ${round}`;
};

const snapshotMatches = (matches) => new Map(matches.map((match) => [match.id, {
  winner: winnerOf(match),
  state: match.state,
  participants: (match.participants || []).map((participant) => ({
    name: participant.name,
    score: participant.resultText,
  })),
}]));

const MatchCard = ({ match, teamIcons, effects, onMatchClick, mobile = false, replay = null }) => {
  const winner = winnerOf(match);
  const isDone = Boolean(winner);
  const isForfeit = match.state === 'FORFEIT';
  const isRecordable = Boolean(match.dbMatchId && !isDone && match.participants?.every(hasRealTeam));
  const isWaiting = !isDone && !isRecordable;
  const resolving = effects.winners.has(match.id);
  const activated = effects.activeMatches.has(match.id);

  const stateLabel = isForfeit ? 'Forfeit' : isDone ? 'Final' : isRecordable ? 'Live' : 'Waiting';
  const replayState = replay?.state || '';

  return (
    <motion.article
      layout
      className={`arena-match-shell${resolving ? ' arena-match-shell--resolving' : ''}${activated ? ' arena-match-shell--activated' : ''}${replayState ? ` arena-match-shell--replay-${replayState}` : ''}`}
      initial={mobile ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Card
        component="button"
        type="button"
        className={`arena-match-card${isRecordable ? ' arena-match-card--live' : ''}${isDone ? ' arena-match-card--done' : ''}`}
        onClick={() => isRecordable && onMatchClick(match)}
        aria-disabled={!isRecordable}
        aria-label={`${match.name}. ${stateLabel}`}
        sx={{ width: '100%', height: CARD_HEIGHT }}
      >
        <Stack className="arena-match-card__header" direction="row" alignItems="center" justifyContent="space-between">
          <Typography component="span" variant="caption" className="arena-match-card__label">
            {match.name}
          </Typography>
          <Box className={`arena-match-state arena-match-state--${stateLabel.toLowerCase()}`}>
            {isRecordable ? <LiveDot /> : isDone ? <Box component="span" className="arena-state-check">✓</Box> : <HourglassTopRounded />}
            <Box component="span">{stateLabel}</Box>
          </Box>
        </Stack>

        <Box className="arena-match-card__teams">
          {(match.participants || []).map((participant, index) => {
            const isWinner = participant.name === winner;
            const arrivalKey = `${match.id}:${participant.name}`;
            const arrived = effects.arrivals.has(arrivalKey);
            const scoreChanged = effects.scores.has(`${match.id}:${index}`);
            const initials = hasRealTeam(participant)
              ? participant.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
              : '?';
            // Hovering the champion's row in the decided Final replays their route.
            // The handlers sit on the existing row, so no nested button is introduced.
            const isReplayTrigger = Boolean(replay?.triggerTeam) && isWinner && participant.name === replay.triggerTeam;
            return (
              <motion.div
                key={`${index}:${participant.name}`}
                className={`arena-team-row${isWinner ? ' arena-team-row--winner' : ''}${isDone && !isWinner ? ' arena-team-row--loser' : ''}${arrived ? ' arena-team-row--arrival' : ''}${isReplayTrigger ? ' arena-team-row--replay-trigger' : ''}`}
                onMouseEnter={isReplayTrigger ? replay.onEnter : undefined}
                onMouseLeave={isReplayTrigger ? replay.onLeave : undefined}
                initial={arrived ? { opacity: 0, x: -32 } : false}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.52, delay: arrived ? 0.35 : 0, ease: [0.18, 0.86, 0.24, 1] }}
              >
                <Avatar src={teamIcons[participant.name] || undefined} className="arena-team-row__avatar">
                  {initials}
                </Avatar>
                <Typography component="span" className="arena-team-row__name" noWrap>
                  {participant.name || 'TBD'}
                </Typography>
                {isWinner && <EmojiEventsRounded className="arena-team-row__winner-icon" />}
                <Box component="span" className={`arena-team-row__score${scoreChanged ? ' arena-team-row__score--changed' : ''}`}>
                  {participant.resultText ?? '—'}
                </Box>
              </motion.div>
            );
          })}
        </Box>

        {isForfeit && <Box className="arena-match-card__forfeit">Opponent advanced automatically</Box>}
        {isWaiting && match.participants?.some(hasRealTeam) && <Box className="arena-match-card__waiting">Awaiting the opposing team</Box>}
      </Card>
    </motion.article>
  );
};

const ResponsiveBracket = ({ matches, teamIcons = {}, onMatchClick, finalComplete = false, championName = '' }) => {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const previousMatches = useRef(null);
  const effectTimer = useRef(null);
  const [effects, setEffects] = useState({
    winners: new Set(), arrivals: new Set(), scores: new Set(), activeMatches: new Set(),
  });

  const rounds = useMemo(() => {
    const grouped = new Map();
    matches.forEach((match) => {
      const round = roundOf(match);
      if (!grouped.has(round)) grouped.set(round, []);
      grouped.get(round).push(match);
    });
    return [...grouped.entries()]
      .sort(([left], [right]) => left - right)
      .map(([round, roundMatches]) => ({
        round,
        matches: [...roundMatches].sort((left, right) => String(left.id).localeCompare(String(right.id), undefined, { numeric: true })),
      }));
  }, [matches]);

  const initialRound = Math.max(0, rounds.findIndex(({ matches: roundMatches }) => roundMatches.some((match) => match.dbMatchId && !winnerOf(match))));
  const [mobileRound, setMobileRound] = useState(initialRound);

  useLayoutEffect(() => {
    const current = snapshotMatches(matches);
    const previous = previousMatches.current;
    if (previous) {
      const winners = new Set();
      const arrivals = new Set();
      const scores = new Set();
      const activeMatches = new Set();
      let newestRound = null;

      matches.forEach((match) => {
        const before = previous.get(match.id);
        const currentWinner = winnerOf(match);
        if (currentWinner && !before?.winner) winners.add(match.id);

        (match.participants || []).forEach((participant, index) => {
          const oldParticipant = before?.participants?.[index];
          if (hasRealTeam(participant) && oldParticipant?.name !== participant.name) {
            arrivals.add(`${match.id}:${participant.name}`);
            activeMatches.add(match.id);
            newestRound = Math.max(newestRound || 0, roundOf(match));
          }
          if (before && oldParticipant?.score !== participant.resultText) scores.add(`${match.id}:${index}`);
        });
      });

      setEffects({ winners, arrivals, scores, activeMatches });
      if (newestRound) {
        const roundIndex = rounds.findIndex(({ round }) => round === newestRound);
        if (roundIndex >= 0) setMobileRound(roundIndex);
      }
      window.clearTimeout(effectTimer.current);
      effectTimer.current = window.setTimeout(() => setEffects({
        winners: new Set(), arrivals: new Set(), scores: new Set(), activeMatches: new Set(),
      }), 1500);
    }
    previousMatches.current = current;
    return () => window.clearTimeout(effectTimer.current);
  }, [matches, rounds]);

  useEffect(() => {
    if (mobileRound >= rounds.length) setMobileRound(Math.max(0, rounds.length - 1));
  }, [mobileRound, rounds.length]);

  // Champion path replay (desktop only, once a champion exists).
  const championPath = useMemo(
    () => buildChampionPath(matches, finalComplete ? championName : ''),
    [matches, championName, finalComplete],
  );
  const replayAvailable = desktop && championPath.steps.length > 0;
  // -1 means "not replaying"; otherwise it is the index of the last revealed step.
  const [replayStep, setReplayStep] = useState(-1);

  // A fresh path (new tournament, new result, or replay no longer available) always
  // returns the bracket to its normal state rather than resuming a half-played replay.
  useEffect(() => { setReplayStep(-1); }, [championPath, replayAvailable]);

  // One timer per step, owned by the effect: React clears it whenever the step changes,
  // the replay ends, the data changes, or the bracket unmounts, so a stale tick can
  // never advance a replay that has already been cancelled.
  useEffect(() => {
    if (replayStep < 0 || replayStep >= championPath.steps.length - 1) return undefined;
    const timer = window.setTimeout(() => setReplayStep((step) => (step < 0 ? step : step + 1)), REPLAY_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [replayStep, championPath.steps.length]);

  const startReplay = () => {
    if (!replayAvailable) return;
    // Reduced motion skips the sequence and reveals the whole route at once.
    setReplayStep(reducedMotion ? championPath.steps.length - 1 : 0);
  };
  const stopReplay = () => setReplayStep(-1);

  const replaying = replayAvailable && replayStep >= 0;
  const replayStateFor = (type, id) => {
    if (!replaying) return '';
    const stepIndex = championPath.steps.findIndex((step) => step.type === type && step.id === id);
    if (stepIndex < 0) return 'dim';
    if (stepIndex > replayStep) return '';
    return stepIndex === replayStep ? 'current' : 'lit';
  };
  const replayTriggerId = championPath.matchIds[championPath.matchIds.length - 1];

  const nodeById = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches]);
  const firstRoundCount = Math.max(1, rounds[0]?.matches.length || 1);
  const canvasWidth = STAGE_PADDING * 2 + rounds.length * CARD_WIDTH + Math.max(0, rounds.length - 1) * ROUND_GAP;
  const stageHeight = Math.max(380, firstRoundCount * SLOT_HEIGHT + 52);
  const positionFor = (match) => {
    const roundIndex = Math.max(0, rounds.findIndex(({ round }) => round === roundOf(match)));
    const position = rounds[roundIndex]?.matches.findIndex((candidate) => candidate.id === match.id) || 0;
    const span = SLOT_HEIGHT * (2 ** roundIndex);
    return {
      x: STAGE_PADDING + roundIndex * (CARD_WIDTH + ROUND_GAP),
      y: 26 + ((position + 0.5) * span) - (CARD_HEIGHT / 2),
    };
  };

  const connectors = matches.filter((match) => match.nextMatchId && nodeById.has(match.nextMatchId)).map((match) => {
    const source = positionFor(match);
    const destination = positionFor(nodeById.get(match.nextMatchId));
    const startX = source.x + CARD_WIDTH;
    const startY = source.y + CARD_HEIGHT / 2;
    const endX = destination.x;
    const endY = destination.y + CARD_HEIGHT / 2;
    const elbowX = startX + ROUND_GAP / 2;
    const advanced = Boolean(winnerOf(match));
    return {
      id: match.id,
      path: `M ${startX} ${startY} H ${elbowX} V ${endY} H ${endX}`,
      advanced,
      animating: effects.winners.has(match.id),
      replayState: replayStateFor('connector', match.id),
    };
  });

  const totalMatches = matches.length;
  const completedMatches = matches.filter((match) => winnerOf(match)).length;

  return (
    <Card className={`arena-custom-bracket${finalComplete ? ' arena-victory-glow' : ''}`}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={1.25} className="arena-bracket-summary">
        <Box>
          <Typography variant="h3">Championship path</Typography>
          <Typography variant="body2" color="text.secondary">Every win leaves a trail toward the trophy.</Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip size="small" icon={<BoltRounded />} label={`${completedMatches}/${totalMatches} decided`} color={finalComplete ? 'warning' : 'primary'} variant="outlined" />
          {finalComplete && <Chip size="small" icon={<EmojiEventsRounded />} label="Champion crowned" color="warning" />}
        </Stack>
      </Stack>

      {desktop ? (
        <Box className="arena-bracket-scroll">
          <Box className="arena-bracket-canvas" sx={{ width: canvasWidth }}>
            <Box className="arena-bracket-rounds" sx={{ gridTemplateColumns: `repeat(${rounds.length}, ${CARD_WIDTH}px)`, columnGap: `${ROUND_GAP}px` }}>
              {rounds.map(({ round, matches: roundMatches }) => (
                <Box key={round} className="arena-round-heading">
                  <Box>
                    <Typography className="arena-round-heading__eyebrow">Round {round}</Typography>
                    <Typography className="arena-round-heading__title">{roundLabel(round, roundMatches.length, rounds.length)}</Typography>
                  </Box>
                  <Typography className="arena-round-heading__count">
                    {roundMatches.filter((match) => winnerOf(match)).length}/{roundMatches.length}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Box className="arena-bracket-stage" sx={{ height: stageHeight }}>
              <Box component="svg" className="arena-bracket-connectors" viewBox={`0 0 ${canvasWidth} ${stageHeight}`} preserveAspectRatio="none" aria-hidden="true">
                {connectors.map((connector) => (
                  <path
                    key={connector.id}
                    pathLength="1"
                    d={connector.path}
                    className={`arena-bracket-connector${connector.advanced ? ' arena-bracket-connector--advanced' : ''}${connector.animating ? ' arena-bracket-connector--drawing' : ''}${connector.replayState ? ` arena-bracket-connector--replay-${connector.replayState}` : ''}`}
                  />
                ))}
              </Box>
              {matches.map((match) => {
                const position = positionFor(match);
                return (
                  <Box key={match.id} className="arena-bracket-node" sx={{ width: CARD_WIDTH, left: position.x, top: position.y }}>
                    <MatchCard
                      match={match}
                      teamIcons={teamIcons}
                      effects={effects}
                      onMatchClick={onMatchClick}
                      replay={replayAvailable ? {
                        state: replayStateFor('match', match.id),
                        triggerTeam: match.id === replayTriggerId ? championName : '',
                        onEnter: startReplay,
                        onLeave: stopReplay,
                      } : null}
                    />
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      ) : (
        <Box className="arena-mobile-bracket">
          <Tabs value={mobileRound} onChange={(_, value) => setMobileRound(value)} variant="scrollable" scrollButtons="auto" aria-label="Tournament rounds">
            {rounds.map(({ round, matches: roundMatches }) => (
              <Tab key={round} label={roundLabel(round, roundMatches.length, rounds.length)} />
            ))}
          </Tabs>
          <Stack spacing={2} className="arena-mobile-round">
            {(rounds[mobileRound]?.matches || []).map((match) => (
              <MatchCard key={match.id} match={match} teamIcons={teamIcons} effects={effects} onMatchClick={onMatchClick} mobile />
            ))}
          </Stack>
        </Box>
      )}

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={0.5} className="arena-bracket-footer">
        <Typography variant="caption" color="text.secondary">Select any live matchup to record the next game.</Typography>
        <Typography variant="caption" color="text.secondary">{desktop ? 'Scroll horizontally for larger brackets' : 'Swipe the tabs to change rounds'}</Typography>
      </Stack>
      {finalComplete && <CelebrationBurst />}
    </Card>
  );
};

export default ResponsiveBracket;
