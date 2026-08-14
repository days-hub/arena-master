import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SingleEliminationBracket, Match, SVGViewer, createTheme as createBracketTheme,
} from '@g-loot/react-tournament-brackets';
import {
  Box, Select, MenuItem, FormControl, InputLabel, Button, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, Typography, Alert,
} from '@mui/material';
import { useParams } from 'react-router-dom';
// Discord announcements are sent by the backend, so results recorded here,
// via the bot, or through the API all announce identically.
import {
  fetchTournaments, generateAndListMatches, fetchTournamentByName, recordMatchResult,
} from '../api/apiClient';
import { transformApiMatches } from '../tournamentUtils';
import { BRAND } from '../theme';

// Light bracket theme derived from the app palette (the library uses its own
// styled-components theme, so we mirror BRAND values into it here).
const bracketTheme = createBracketTheme({
  fontFamily: '"Roboto", "Arial", "Helvetica", sans-serif',
  roundHeaders: { background: BRAND.teal },
  matchBackground: { wonColor: '#E3F2F1', lostColor: BRAND.paper },
  border: { color: '#D7DEDD', highlightedColor: BRAND.teal },
  textColor: { main: BRAND.ink, highlighted: '#10302F', dark: '#7B8794', disabled: '#A8B0B9' },
  score: {
    text: { highlightedWonColor: BRAND.teal, highlightedLostColor: '#B45309' },
    background: { wonColor: '#F0F7F6', lostColor: '#F3F4F6' },
  },
  connectorColor: '#C9D4D2',
  connectorColorHighlight: BRAND.teal,
  canvasBackground: BRAND.canvas,
});

// Geometry: the library defaults to 110px-tall match boxes, but MUI's
// CssBaseline raises the global line-height and the bottom label clips at
// 110. We pass a taller boxHeight via `options` and keep our viewer-height
// math in sync with it. (Library defaults: 300 wide + 50 column gap,
// 50 row gap, 25 canvas padding, ~65px round header.)
const BOX_HEIGHT = 140;
const COLUMN_SPAN = 350;
const ROW_SPAN = BOX_HEIGHT + 50;

const TournamentBracketComponent = () => {
  const { tournamentName: routeTournamentName } = useParams();
  const [tournament, setTournament] = useState('');
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [bracketMatches, setBracketMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogMatch, setDialogMatch] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [resultMessage, setResultMessage] = useState(null);

  // Responsive viewer: track the container's width so the bracket gets the
  // whole page instead of a fixed 500px keyhole.
  const containerRef = useRef(null);
  const [viewerWidth, setViewerWidth] = useState(900);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const measure = () => setViewerWidth(Math.max(600, el.clientWidth - 8));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Height scales with bracket size: enough rows for round 1, enough width
  // for every round (the SVG pans/zooms inside the viewer either way).
  const roundOneCount = bracketMatches.filter((m) => String(m.id).startsWith('r1-')).length;
  const roundCount = roundOneCount > 0 ? Math.ceil(Math.log2(roundOneCount)) + 1 : 1;
  const viewerHeight = Math.max(450, roundOneCount * ROW_SPAN + 120);
  const contentWidth = Math.max(viewerWidth, roundCount * COLUMN_SPAN + 50);

  // Load a tournament's existing bracket. View-only: safe on mount, refresh,
  // and after generating or recording.
  const loadBracket = useCallback(async (name) => {
    if (!name) return;
    setIsLoading(true);
    try {
      const response = await fetchTournamentByName(name);
      setBracketMatches(transformApiMatches(response.data.matches));
    } catch (error) {
      console.error('Error loading bracket:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Deep link support: /bracket/:tournamentName (e.g. links from the
  // dashboard or the Discord bot) selects and loads on mount.
  useEffect(() => {
    if (!routeTournamentName) return;
    const decoded = decodeURIComponent(routeTournamentName);
    setTournament(decoded);
    setSelectedTournament(decoded);
    loadBracket(decoded);
  }, [routeTournamentName, loadBracket]);

  useEffect(() => {
    const fetchData = async () => {
      const tournamentsData = await fetchTournaments();
      if (Array.isArray(tournamentsData.data)) {
        setTournaments(tournamentsData.data);
      } else {
        console.error('API did not return an array of tournaments');
      }
    };
    fetchData();
  }, []);

  // Generate first-round matches, then load the bracket. If one already
  // exists this is a destructive regenerate: confirm, then force=true so the
  // backend wipes instead of stacking a duplicate round 1.
  const handleGenerateBracket = async (tournamentName) => {
    if (!tournamentName) return;
    const hasBracket = bracketMatches.length > 0;
    if (hasBracket) {
      const ok = window.confirm(
        'This tournament already has a bracket. Regenerating will delete all existing matches and reshuffle. Continue?'
      );
      if (!ok) return;
    }
    try {
      await generateAndListMatches(tournamentName, hasBracket);
    } catch (error) {
      console.error('Error generating matches:', error);
    }
    await loadBracket(tournamentName);
  };

  const handleRefresh = () => loadBracket(selectedTournament);

  // A node is recordable if it maps to a real db match, isn't decided, and
  // both slots are filled (not TBD placeholders).
  const isRecordable = (m) =>
    m && m.dbMatchId && m.state !== 'DONE' &&
    m.participants.every((p) => p.name && p.name !== 'TBD');

  const handleMatchClick = ({ match }) => {
    setResultMessage(null);
    if (isRecordable(match)) setDialogMatch(match);
  };

  const handleRecordGame = async (teamName) => {
    if (!dialogMatch || !selectedTournament) return;
    setIsRecording(true);
    try {
      const response = await recordMatchResult(selectedTournament, {
        match_number: dialogMatch.dbMatchId,
        winner_team_name: teamName,
      });
      const message = response.data?.message || 'Result recorded.';
      setResultMessage({ severity: 'success', text: message });
      setDialogMatch(null);
      await loadBracket(selectedTournament);
    } catch (error) {
      const detail = error.response?.data?.detail || 'Failed to record result. Please try again.';
      setResultMessage({ severity: 'error', text: detail });
    } finally {
      setIsRecording(false);
    }
  };

  return (
    <Box>
      <FormControl fullWidth>
        <InputLabel>Tournament</InputLabel>
        <Select
          label="Tournament"
          value={tournament}
          onChange={(e) => {
            setTournament(e.target.value);
            setSelectedTournament(e.target.value);
          }}
        >
          {tournaments.map((t) =>
            t ? (
              <MenuItem key={t.id} value={t.name}>
                {t.name}
              </MenuItem>
            ) : null
          )}
        </Select>
      </FormControl>

      <Stack direction="row" spacing={1} sx={{ my: 1.5 }}>
        <Button
          onClick={() => handleGenerateBracket(selectedTournament)}
          disabled={!selectedTournament}
        >
          {bracketMatches.length > 0 ? 'Regenerate Bracket' : 'Generate Bracket'}
        </Button>
        <Button onClick={handleRefresh} disabled={!selectedTournament}>Refresh</Button>
      </Stack>

      {resultMessage && (
        <Alert
          severity={resultMessage.severity}
          sx={{ mb: 2, whiteSpace: 'pre-line' }}
          onClose={() => setResultMessage(null)}
        >
          {resultMessage.text}
        </Alert>
      )}

      <Box ref={containerRef} sx={{ width: '100%' }}>
        {isLoading && <Typography color="text.secondary">Loading bracket…</Typography>}
        {!isLoading && selectedTournament && bracketMatches.length === 0 && (
          <Typography color="text.secondary">
            No matches found for this tournament — generate a bracket to get started.
          </Typography>
        )}
        {!isLoading && bracketMatches.length > 0 && (
          <Box sx={{ border: '1px solid #E1E7E6', borderRadius: 2, overflow: 'hidden' }}>
            <SingleEliminationBracket
              matches={bracketMatches}
              matchComponent={Match}
              theme={bracketTheme}
              options={{ style: { boxHeight: BOX_HEIGHT } }}
              onMatchClick={handleMatchClick}
              svgWrapper={({ children, ...props }) => (
                <SVGViewer
                  width={viewerWidth}
                  height={viewerHeight}
                  background={BRAND.canvas}
                  SVGBackground={BRAND.canvas}
                  {...props}
                >
                  {children}
                </SVGViewer>
              )}
            />
            <Typography variant="caption" sx={{ display: 'block', px: 1.5, py: 0.75, color: 'text.secondary' }}>
              Click a match to record a game result · drag to pan, scroll to zoom
              {contentWidth > viewerWidth ? ' (bracket is wider than the view)' : ''}
            </Typography>
          </Box>
        )}
      </Box>

      <Dialog open={!!dialogMatch} onClose={() => !isRecording && setDialogMatch(null)}>
        <DialogTitle>Record game — {dialogMatch?.name}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>
            {dialogMatch?.participants?.[0]?.name} vs {dialogMatch?.participants?.[1]?.name}
            {' '}({dialogMatch?.participants?.[0]?.resultText ?? 0}–{dialogMatch?.participants?.[1]?.resultText ?? 0})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Who won this game? One click records a single game in the series.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDialogMatch(null)} disabled={isRecording}>Cancel</Button>
          {dialogMatch?.participants?.map((p) => (
            <Button
              key={p.name}
              variant="contained"
              disabled={isRecording}
              onClick={() => handleRecordGame(p.name)}
            >
              {p.name}
            </Button>
          ))}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TournamentBracketComponent;
