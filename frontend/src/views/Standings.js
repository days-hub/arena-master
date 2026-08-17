import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, FormControl, Grid,
  InputAdornment, InputLabel, MenuItem, Paper, Select, Skeleton, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TableSortLabel, TextField, Typography,
} from '@mui/material';
import {
  EmojiEventsRounded, FilterAltOffRounded, Groups2Rounded, LocalFireDepartmentRounded,
  SearchRounded, SportsScoreRounded, TrendingUpRounded,
} from '@mui/icons-material';
import { fetchStandings, fetchStandingsOptions, fetchTeams, getApiErrorMessage } from '../api/apiClient';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { AnimatedProgress, CountUp } from '../components/Motion';

const COLUMNS = [
  { id: 'rank', label: '#', numeric: true, sortable: false },
  { id: 'team', label: 'Team', numeric: false, sortable: true },
  { id: 'titles', label: 'Titles', numeric: true, sortable: true },
  { id: 'streak', label: 'Streak', numeric: false, sortable: false },
  { id: 'recent_form', label: 'Recent form', numeric: false, sortable: false },
  { id: 'match_wins', label: 'Match W', numeric: true, sortable: true },
  { id: 'match_losses', label: 'Match L', numeric: true, sortable: true },
  { id: 'game_wins', label: 'Game W', numeric: true, sortable: true },
  { id: 'game_losses', label: 'Game L', numeric: true, sortable: true },
  { id: 'game_win_pct', label: 'Win rate', numeric: true, sortable: true },
];

const SummaryCard = ({ icon, value, label, tone = 'teal' }) => {
  const accent = tone === 'amber' ? '#A86700' : tone === 'fire' ? '#B94A21' : 'primary.main';
  const background = tone === 'amber' ? 'rgba(244,166,33,.11)' : tone === 'fire' ? 'rgba(224,91,47,.09)' : 'rgba(11,143,140,.09)';
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ width: 40, height: 40, display: 'grid', placeItems: 'center', borderRadius: 2, color: accent, bgcolor: background }}>{icon}</Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h3" noWrap>{typeof value === 'number' ? <CountUp value={value} /> : value}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap title={label}>{label}</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

const FormDots = ({ results = [] }) => (
  <Stack direction="row" spacing={0.45} aria-label={results.length ? `Recent form ${results.join(' ')}` : 'No recent form'}>
    {results.length ? results.map((result, index) => (
      <Box key={`${result}-${index}`} title={result === 'W' ? 'Win' : 'Loss'} sx={{
        display: 'grid', placeItems: 'center', width: 20, height: 20, borderRadius: '50%',
        bgcolor: result === 'W' ? 'rgba(46,125,50,.13)' : 'rgba(190,56,56,.10)',
        color: result === 'W' ? 'success.dark' : 'error.main', fontSize: 9, fontWeight: 900,
      }}>{result}</Box>
    )) : <Typography variant="caption" color="text.disabled">—</Typography>}
  </Stack>
);

const PodiumCard = ({ row, position, teamIcon }) => {
  const palettes = {
    1: { accent: '#B67508', soft: 'rgba(244,166,33,.15)', label: 'Champion' },
    2: { accent: '#667A84', soft: 'rgba(102,122,132,.11)', label: 'Second' },
    3: { accent: '#A55E36', soft: 'rgba(165,94,54,.11)', label: 'Third' },
  };
  const palette = palettes[position];
  const games = row.game_wins + row.game_losses;
  const winRate = games ? (row.game_wins / games) * 100 : 0;
  return (
    <Card className="arena-lift" sx={{
      height: '100%', borderTop: '4px solid', borderTopColor: palette.accent,
      transform: { md: position === 1 ? 'translateY(-8px)' : 'none' },
      boxShadow: position === 1 ? '0 14px 34px rgba(126,82,5,.13)' : undefined,
    }}>
      <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="overline" sx={{ color: palette.accent, fontSize: 9, fontWeight: 900, letterSpacing: '.14em' }}>
            #{position} · {palette.label}
          </Typography>
          <Chip size="small" icon={<EmojiEventsRounded />} label={row.titles} sx={{ color: palette.accent, bgcolor: palette.soft }} />
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mt: 1.25 }}>
          <Avatar src={teamIcon || undefined} alt={row.team} sx={{ width: 46, height: 46, bgcolor: palette.accent, fontWeight: 900 }}>
            {row.team.slice(0, 2).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h3" noWrap>{row.team}</Typography>
            <Typography variant="caption" color="text.secondary">{row.match_wins}–{row.match_losses} matches · {winRate.toFixed(1)}% game win rate</Typography>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.5 }}>
          <FormDots results={row.recent_form} />
          <Chip size="small" label={row.streak || 'No streak'} color={row.streak?.startsWith('W') ? 'success' : 'default'} variant="outlined" />
        </Stack>
      </CardContent>
    </Card>
  );
};

const Standings = () => {
  const [rows, setRows] = useState([]);
  const [teamIcons, setTeamIcons] = useState({});
  const [options, setOptions] = useState({ games: [], tournaments: [], seasons: [] });
  const [game, setGame] = useState('');
  const [tournamentId, setTournamentId] = useState('');
  const [season, setSeason] = useState('');
  const [orderBy, setOrderBy] = useState('titles');
  const [order, setOrder] = useState('desc');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchStandingsOptions().catch((requestError) => {
        console.warn('Standings filters could not be loaded:', requestError);
        return { data: { games: [], tournaments: [], seasons: [] } };
      }),
      fetchTeams().catch((requestError) => {
        console.warn('Standings team icons could not be loaded:', requestError);
        return { data: [] };
      }),
    ]).then(([optionResponse, teamResponse]) => {
      if (!active) return;
      setOptions(optionResponse.data || { games: [], tournaments: [], seasons: [] });
      const teams = Array.isArray(teamResponse.data) ? teamResponse.data : [];
      setTeamIcons(Object.fromEntries(teams.map((team) => [team.name, team.avatar_url || ''])));
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetchStandings({ game: game || undefined, tournamentId: tournamentId || undefined, season: season || undefined });
        if (!active) return;
        setRows((response.data || []).map((row) => {
          const games = row.game_wins + row.game_losses;
          return { ...row, recent_form: row.recent_form || [], streak: row.streak || '', game_win_pct: games > 0 ? (row.game_wins / games) * 100 : 0 };
        }));
      } catch (requestError) {
        if (active) setError(getApiErrorMessage(requestError, 'Standings could not be loaded.'));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [game, season, tournamentId]);

  const canonicalRows = useMemo(() => [...rows].sort((a, b) => b.titles - a.titles || b.match_wins - a.match_wins || b.game_wins - a.game_wins), [rows]);
  const rankByTeam = useMemo(() => new Map(canonicalRows.map((row, index) => [row.team, index + 1])), [canonicalRows]);
  const visibleRows = useMemo(() => [...rows]
    .filter((row) => row.team.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      const first = a[orderBy];
      const second = b[orderBy];
      const comparison = typeof first === 'string' ? first.localeCompare(second) : first - second;
      return order === 'asc' ? comparison : -comparison;
    }), [rows, query, order, orderBy]);

  const availableTournaments = useMemo(() => (options.tournaments || []).filter((tournament) =>
    (!game || tournament.game === game) && (!season || String(tournament.season) === String(season))), [game, options.tournaments, season]);
  const totalMatches = rows.reduce((sum, row) => sum + row.match_wins, 0);
  const hottest = [...rows].filter((row) => /^W\d+$/.test(row.streak))
    .sort((a, b) => Number(b.streak.slice(1)) - Number(a.streak.slice(1)))[0];
  const upsetLeader = [...rows].sort((a, b) => (b.biggest_upset_seed_gap || 0) - (a.biggest_upset_seed_gap || 0))[0];
  const selectedTournament = (options.tournaments || []).find((tournament) => String(tournament.id) === String(tournamentId));
  const scopeLabel = selectedTournament?.name || game || 'All games';

  const handleSort = (column) => {
    if (!column.sortable) return;
    if (orderBy === column.id) setOrder((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setOrderBy(column.id);
      setOrder(column.id === 'team' ? 'asc' : 'desc');
    }
  };

  const chooseGame = (value) => {
    setGame(value);
    const selected = (options.tournaments || []).find((tournament) => String(tournament.id) === String(tournamentId));
    if (selected && value && selected.game !== value) setTournamentId('');
  };

  const chooseSeason = (value) => {
    setSeason(value);
    const selected = (options.tournaments || []).find((tournament) => String(tournament.id) === String(tournamentId));
    if (selected && value && String(selected.season) !== String(value)) setTournamentId('');
  };

  const chooseTournament = (value) => {
    setTournamentId(value);
    const selected = (options.tournaments || []).find((tournament) => String(tournament.id) === String(value));
    if (selected) {
      setGame(selected.game || '');
      setSeason(String(selected.season));
    }
  };

  const resetFilters = () => {
    setGame('');
    setTournamentId('');
    setSeason('');
  };

  return (
    <Box>
      <PageHeader eyebrow="Competition history" title="All-time standings"
        description="Compare titles, match records, recent form, and game performance across every arena." />

      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: { xs: 2.25, sm: 2.75 }, '&:last-child': { pb: { xs: 2.25, sm: 2.75 } } }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} alignItems={{ lg: 'flex-end' }} spacing={1.5}>
            <Box sx={{ mr: { lg: 'auto' } }}>
              <Typography variant="h3">Competition scope</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>{scopeLabel}{season ? ` · ${season} season` : ' · every season'}</Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: { sm: 180 } }}><InputLabel id="standings-game-label">Game</InputLabel><Select labelId="standings-game-label" label="Game" value={game} onChange={(event) => chooseGame(event.target.value)}>
              <MenuItem value="">All games</MenuItem>{(options.games || []).map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
            </Select></FormControl>
            <FormControl size="small" sx={{ minWidth: { sm: 220 } }}><InputLabel id="standings-tournament-label">Tournament</InputLabel><Select labelId="standings-tournament-label" label="Tournament" value={tournamentId} onChange={(event) => chooseTournament(event.target.value)}>
              <MenuItem value="">All tournaments</MenuItem>{availableTournaments.map((option) => <MenuItem key={option.id} value={String(option.id)}>{option.name}</MenuItem>)}
            </Select></FormControl>
            <FormControl size="small" sx={{ minWidth: { sm: 145 } }}><InputLabel id="standings-season-label">Season</InputLabel><Select labelId="standings-season-label" label="Season" value={season} onChange={(event) => chooseSeason(event.target.value)}>
              <MenuItem value="">All seasons</MenuItem>{(options.seasons || []).map((option) => <MenuItem key={option} value={String(option)}>{option}</MenuItem>)}
            </Select></FormControl>
            <Button startIcon={<FilterAltOffRounded />} onClick={resetFilters} disabled={!game && !tournamentId && !season}>Reset</Button>
          </Stack>
        </CardContent>
      </Card>

      {canonicalRows.length > 0 && (
        <Box sx={{ mb: 3.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2 }}>
            <Box><Typography variant="h2">Arena podium</Typography><Typography variant="body2" color="text.secondary">The strongest records inside the current scope.</Typography></Box>
            <Chip size="small" icon={<EmojiEventsRounded />} label={scopeLabel} variant="outlined" />
          </Stack>
          <Grid container spacing={2} alignItems="stretch">
            {canonicalRows.slice(0, 3).map((row, index) => (
              <Grid item xs={12} md={4} key={row.team} sx={{ display: 'flex', order: { xs: index + 1, md: index === 0 ? 2 : index === 1 ? 1 : 3 } }}>
                <Box sx={{ width: '100%' }}><PodiumCard row={row} position={index + 1} teamIcon={teamIcons[row.team]} /></Box>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}><SummaryCard icon={<Groups2Rounded />} value={rows.length} label="Ranked teams" /></Grid>
        <Grid item xs={12} sm={6} lg={3}><SummaryCard icon={<SportsScoreRounded />} value={totalMatches} label="Decided matches" /></Grid>
        <Grid item xs={12} sm={6} lg={3}><SummaryCard icon={<LocalFireDepartmentRounded />} value={hottest && Number(hottest.streak.slice(1)) >= 2 ? hottest.streak : '—'}
          label={hottest && Number(hottest.streak.slice(1)) >= 2 ? `${hottest.team} is on a run` : 'More results needed for a streak'} tone="fire" /></Grid>
        <Grid item xs={12} sm={6} lg={3}><SummaryCard icon={<TrendingUpRounded />} value={upsetLeader?.biggest_upset_seed_gap ? `+${upsetLeader.biggest_upset_seed_gap}` : '—'}
          label={upsetLeader?.biggest_upset || 'No lower-seed upset recorded'} tone="amber" /></Grid>
      </Grid>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} sx={{ px: { xs: 2, sm: 2.5 }, py: 2 }}>
          <Box><Typography variant="h3">Leaderboard</Typography><Typography variant="body2" color="text.secondary">Serious comparison, scoped by the controls above.</Typography></Box>
          <TextField size="small" placeholder="Search teams" value={query} onChange={(event) => setQuery(event.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }} sx={{ width: { sm: 250 } }} />
        </Stack>

        {loading ? <Box sx={{ p: 2 }}><Skeleton height={48} /><Skeleton height={48} /><Skeleton height={48} /></Box> : visibleRows.length ? (
          <TableContainer><Table sx={{ minWidth: 1080 }}>
            <TableHead><TableRow>{COLUMNS.map((column) => (
              <TableCell key={column.id} align={column.numeric ? 'right' : 'left'} sortDirection={orderBy === column.id ? order : false} sx={column.id === 'team' ? { minWidth: 220 } : {}}>
                {column.sortable ? <TableSortLabel active={orderBy === column.id} direction={orderBy === column.id ? order : 'desc'} onClick={() => handleSort(column)}>{column.label}</TableSortLabel> : column.label}
              </TableCell>
            ))}</TableRow></TableHead>
            <TableBody>{visibleRows.map((row, index) => (
              <TableRow key={row.team} hover className="arena-stagger-in" sx={{ '--stagger-index': Math.min(index, 8), '&:last-child td': { border: 0 } }}>
                <TableCell align="right"><Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>{rankByTeam.get(row.team)}</Typography></TableCell>
                <TableCell><Stack direction="row" alignItems="center" spacing={1.25}>
                  <Avatar src={teamIcons[row.team] || undefined} alt={row.team} sx={{ width: 34, height: 34, bgcolor: (rankByTeam.get(row.team) || 4) <= 3 ? 'secondary.main' : '#DDE7E6', color: (rankByTeam.get(row.team) || 4) <= 3 ? 'white' : 'text.primary', fontSize: 12, fontWeight: 800 }}>{row.team.slice(0, 2).toUpperCase()}</Avatar>
                  <Typography sx={{ fontWeight: 700 }}>{row.team}</Typography>
                  {row.titles > 0 && <Chip className={rankByTeam.get(row.team) === 1 ? 'arena-trophy-chip' : ''} icon={<EmojiEventsRounded />} label={row.titles} size="small" color="warning" variant="outlined" />}
                </Stack></TableCell>
                <TableCell align="right">{row.titles}</TableCell>
                <TableCell><Chip size="small" label={row.streak || '—'} color={row.streak?.startsWith('W') ? 'success' : 'default'} variant="outlined" /></TableCell>
                <TableCell><FormDots results={row.recent_form} /></TableCell>
                <TableCell align="right" sx={{ color: 'success.dark', fontWeight: 700 }}>{row.match_wins}</TableCell>
                <TableCell align="right">{row.match_losses}</TableCell>
                <TableCell align="right">{row.game_wins}</TableCell>
                <TableCell align="right">{row.game_losses}</TableCell>
                <TableCell align="right">{row.game_wins + row.game_losses > 0 ? <Box sx={{ minWidth: 88 }}><Typography variant="body2" sx={{ fontWeight: 700 }}>{row.game_win_pct.toFixed(1)}%</Typography><AnimatedProgress value={row.game_win_pct} sx={{ mt: 0.5, height: 4 }} /></Box> : '—'}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table></TableContainer>
        ) : <Box sx={{ p: 2 }}><EmptyState compact icon={<SportsScoreRounded />} title={query ? 'No matching teams' : 'No results in this scope'} description={query ? 'Try a different team name.' : 'Choose another game, tournament, or season—or record more results.'} /></Box>}
      </Paper>
    </Box>
  );
};

export default Standings;
