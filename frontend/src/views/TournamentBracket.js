import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Card, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select,
  Skeleton, Stack, Typography,
} from '@mui/material';
import {
  AccountTreeRounded, AutorenewRounded, FullscreenRounded, LockOutlined,
  RefreshRounded,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchTeams, fetchTournaments, generateAndListMatches, fetchTournamentByName,
  fetchTeamRoster, getApiErrorMessage, recordMatchResult,
} from '../api/apiClient';
import { useAuth } from '../auth/AuthContext';
import { transformApiMatches } from '../tournamentUtils';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import GameUpdatePanel from '../components/GameUpdatePanel';
import VictoryCelebration from '../components/VictoryCelebration';
import GameIcon from '../components/GameIcon';
import ResponsiveBracket from '../components/ResponsiveBracket';

const TournamentBracket = () => {
  const { tournamentName: routeTournamentName } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, signIn } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [selectedGame, setSelectedGame] = useState('');
  const [bracketMatches, setBracketMatches] = useState([]);
  const [teamIcons, setTeamIcons] = useState({});
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [dialogMatch, setDialogMatch] = useState(null);
  const [resultMessage, setResultMessage] = useState(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [victory, setVictory] = useState({ open: false, teamName: '', members: [], loading: false });
  const shownVictories = useRef(new Set());
  const containerRef = useRef(null);
  const realMatches = bracketMatches.filter((match) => match.dbMatchId);
  const decidedMatches = bracketMatches.filter((match) => match.participants.some((participant) => participant.isWinner)).length;
  const bracketProgress = bracketMatches.length ? Math.round((decidedMatches / bracketMatches.length) * 100) : 0;
  const finalMatch = bracketMatches.find((match) => match.nextMatchId == null && match.dbMatchId);
  const championName = finalMatch?.participants.find((participant) => participant.isWinner)?.name || '';
  const finalComplete = Boolean(championName);

  const bracketUpdate = !selectedTournament
    ? { tone: 'setup', title: 'Pick an arena', message: 'Choose a tournament and I’ll load its path to the trophy.' }
    : loading
      ? { tone: 'live', title: 'Refreshing the bracket…', message: 'I’m checking the latest scores and round progression.' }
      : finalComplete
        ? { tone: 'celebrate', title: 'We have a champion!', message: `Every match in ${selectedTournament} is decided. That deserves a victory lap.`, progress: 100 }
        : realMatches.length
          ? { tone: 'live', title: `${bracketMatches.length - decidedMatches} matches still in play`, message: `${decidedMatches} of ${bracketMatches.length} matches are decided. Click any active matchup to report the next game.`, progress: bracketProgress }
          : { tone: 'setup', title: 'Ready for the opening draw', message: 'Once at least two teams are registered, generate the bracket and I’ll take it from there.' };

  const loadBracket = useCallback(async (name, { silent = false } = {}) => {
    if (!name) return;
    if (!silent) setLoading(true);
    setResultMessage(null);
    try {
      const response = await fetchTournamentByName(name);
      setSelectedGame(response.data.game || '');
      setBracketMatches(transformApiMatches(response.data.matches));
    } catch (error) {
      setBracketMatches([]);
      setResultMessage({ severity: 'error', text: getApiErrorMessage(error, 'The bracket could not be loaded.') });
    } finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => {
    const loadTournaments = async () => {
      try {
        const [tournamentResponse, teamResponse] = await Promise.all([fetchTournaments(), fetchTeams()]);
        setTournaments(Array.isArray(tournamentResponse.data) ? tournamentResponse.data : []);
        const teams = Array.isArray(teamResponse.data) ? teamResponse.data : [];
        setTeamIcons(Object.fromEntries(teams.map((team) => [team.name, team.avatar_url || ''])));
      } catch (error) {
        setResultMessage({ severity: 'error', text: getApiErrorMessage(error, 'Tournaments could not be loaded.') });
      }
    };
    loadTournaments();
  }, []);

  useEffect(() => {
    if (!routeTournamentName) return;
    const decoded = routeTournamentName;
    setSelectedTournament(decoded);
    loadBracket(decoded);
  }, [routeTournamentName, loadBracket]);

  useEffect(() => {
    if (!selectedTournament || !championName) return undefined;
    const victoryKey = `${selectedTournament}:${championName}`;
    if (shownVictories.current.has(victoryKey)) return undefined;
    shownVictories.current.add(victoryKey);

    let active = true;
    setVictory({ open: false, teamName: championName, members: [], loading: true });
    const revealTimer = window.setTimeout(() => {
      if (active) setVictory((current) => ({ ...current, open: true }));
    }, 1050);

    const loadWinningRoster = async () => {
      try {
        const response = await fetchTeamRoster(championName);
        if (!active) return;
        const roster = Array.isArray(response.data) ? response.data : [];
        setVictory((current) => ({ ...current, teamName: championName, members: roster, loading: false }));
      } catch (error) {
        if (!active) return;
        console.error('Could not load the winning roster:', error);
        setVictory((current) => ({ ...current, teamName: championName, members: [], loading: false }));
      }
    };
    loadWinningRoster();
    return () => { active = false; window.clearTimeout(revealTimer); };
  }, [selectedTournament, championName]);

  const selectTournament = (name) => {
    setSelectedTournament(name);
    setSelectedGame(tournaments.find((tournament) => tournament.name === name)?.game || '');
    setBracketMatches([]);
    setVictory((current) => ({ ...current, open: false }));
    if (name) navigate(`/bracket/${encodeURIComponent(name)}`);
  };

  const replayVictory = () => {
    setVictory((current) => ({ ...current, open: false }));
    window.setTimeout(() => setVictory((current) => ({ ...current, open: true })), 140);
  };

  const generateBracket = async (force = false) => {
    if (!selectedTournament) return;
    setLoading(true);
    setConfirmRegenerate(false);
    try {
      await generateAndListMatches(selectedTournament, force);
      await loadBracket(selectedTournament);
      setResultMessage({ severity: 'success', text: force ? 'Bracket regenerated with a new shuffle.' : 'Bracket generated successfully.' });
    } catch (error) {
      setResultMessage({ severity: 'error', text: getApiErrorMessage(error, 'The bracket could not be generated.') });
    } finally { setLoading(false); }
  };

  const requestGeneration = () => {
    if (bracketMatches.length) setConfirmRegenerate(true);
    else generateBracket(false);
  };

  const isRecordable = (match) => match && match.dbMatchId
    && !match.participants.some((participant) => participant.isWinner)
    && match.participants.every((participant) => participant.name && participant.name !== 'TBD');

  const handleMatchClick = (match) => {
    setResultMessage(null);
    if (!isRecordable(match)) return;
    if (!isAuthenticated) {
      setResultMessage({ severity: 'info', text: 'Sign in to record a game result.' });
      return;
    }
    setDialogMatch(match);
  };

  const recordGame = async (teamName) => {
    if (!dialogMatch || !selectedTournament) return;
    setRecording(true);
    try {
      const response = await recordMatchResult(selectedTournament, {
        match_number: dialogMatch.dbMatchId,
        winner_team_name: teamName,
      });
      setDialogMatch(null);
      await loadBracket(selectedTournament, { silent: true });
      setResultMessage({ severity: 'success', text: response.data?.message || 'Game result recorded.' });
    } catch (error) {
      setResultMessage({ severity: 'error', text: getApiErrorMessage(error, 'The result could not be recorded.') });
    } finally { setRecording(false); }
  };

  const enterFullscreen = async () => {
    try { await containerRef.current?.requestFullscreen?.(); } catch (error) { console.error('Fullscreen unavailable:', error); }
  };

  return (
    <Box>
      <PageHeader eyebrow="Live competition" title="Tournament bracket"
        description="Follow the full tournament path and record each game directly from its matchup."
        actions={selectedTournament && <Button variant="outlined" startIcon={<FullscreenRounded />} onClick={enterFullscreen}>Full screen</Button>} />

      <Card sx={{ mb: 3, p: { xs: 2, sm: 2.5 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
          <FormControl sx={{ flex: 1, minWidth: { md: 300 } }}>
            <InputLabel>Tournament</InputLabel>
            <Select label="Tournament" value={selectedTournament} onChange={(event) => selectTournament(event.target.value)}>
              {tournaments.map((tournament) => (
                <MenuItem key={tournament.id} value={tournament.name}>
                  <GameIcon game={tournament.game} size={26} sx={{ mr: 1.25, borderRadius: 1.25 }} />
                  {tournament.name} · {tournament.format?.toUpperCase()}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={bracketMatches.length ? <AutorenewRounded /> : <AccountTreeRounded />}
            disabled={!selectedTournament || !isAuthenticated || loading} onClick={requestGeneration}>
            {bracketMatches.length ? 'Regenerate' : 'Generate bracket'}
          </Button>
          <Button variant="outlined" startIcon={<RefreshRounded />} disabled={!selectedTournament || loading} onClick={() => loadBracket(selectedTournament, { silent: true })}>Refresh</Button>
        </Stack>
        {!isAuthenticated && selectedTournament && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1.5, color: 'text.secondary' }}>
            <LockOutlined sx={{ fontSize: 17 }} />
            <Typography variant="caption">Spectator mode. <Button size="small" onClick={signIn} sx={{ minHeight: 0, p: 0.25 }}>Sign in</Button> to manage this bracket.</Typography>
          </Stack>
        )}
      </Card>

      <Box sx={{ mb: 3 }}>
        <GameUpdatePanel
          compact
          game={selectedGame}
          {...bracketUpdate}
          action={finalComplete && championName
            ? { label: 'Replay champion moment', onClick: () => setVictory((current) => ({ ...current, open: true })) }
            : !isAuthenticated && selectedTournament
              ? { label: 'Sign in to score', onClick: signIn }
              : undefined}
        />
      </Box>

      {resultMessage && <Alert severity={resultMessage.severity} onClose={() => setResultMessage(null)} sx={{ mb: 2, whiteSpace: 'pre-line' }}>{resultMessage.text}</Alert>}

      <Box ref={containerRef} sx={{ width: '100%', bgcolor: 'background.default', '&:fullscreen': { p: 2, overflow: 'auto' } }}>
        {loading ? <Skeleton variant="rounded" height={520} /> : !selectedTournament ? (
          <EmptyState icon={<AccountTreeRounded />} title="Choose a tournament" description="Select a competition above to load its bracket." />
        ) : bracketMatches.length === 0 ? (
          <EmptyState icon={<AccountTreeRounded />} title="No bracket generated" description="Register at least two teams, then generate the opening round."
            action={isAuthenticated ? <Button variant="contained" startIcon={<AccountTreeRounded />} onClick={() => generateBracket(false)}>Generate bracket</Button> : null} />
        ) : (
          <ResponsiveBracket
            key={selectedTournament}
            matches={bracketMatches}
            teamIcons={teamIcons}
            onMatchClick={handleMatchClick}
            finalComplete={finalComplete}
          />
        )}
      </Box>

      <Dialog open={!!dialogMatch} onClose={() => !recording && setDialogMatch(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Record game result</DialogTitle>
        <DialogContent>
          <Typography variant="h3">{dialogMatch?.participants?.[0]?.name} <Typography component="span" color="text.secondary">vs</Typography> {dialogMatch?.participants?.[1]?.name}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>Current series score: {dialogMatch?.participants?.[0]?.resultText ?? 0}–{dialogMatch?.participants?.[1]?.resultText ?? 0}. Choose the winner of this game.</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
            {dialogMatch?.participants?.map((participant) => (
              <Button key={participant.name} fullWidth variant="outlined" size="large" disabled={recording} onClick={() => recordGame(participant.name)}>{participant.name} won</Button>
            ))}
          </Stack>
          {recording && <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}><CircularProgress size={18} /><Typography variant="body2" color="text.secondary">Recording result…</Typography></Stack>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}><Button onClick={() => setDialogMatch(null)} disabled={recording}>Cancel</Button></DialogActions>
      </Dialog>

      <Dialog open={confirmRegenerate} onClose={() => setConfirmRegenerate(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Regenerate bracket?</DialogTitle>
        <DialogContent><Typography color="text.secondary">This deletes every existing match and recorded score in <strong>{selectedTournament}</strong>, then creates a new random bracket.</Typography></DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}><Button onClick={() => setConfirmRegenerate(false)}>Cancel</Button><Button variant="contained" color="error" onClick={() => generateBracket(true)}>Regenerate</Button></DialogActions>
      </Dialog>

      <VictoryCelebration
        open={victory.open}
        onClose={() => setVictory((current) => ({ ...current, open: false }))}
        onReplay={replayVictory}
        teamName={victory.teamName}
        tournamentName={selectedTournament}
        members={victory.members}
        loading={victory.loading}
      />
    </Box>
  );
};

export default TournamentBracket;
