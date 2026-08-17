import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardActionArea, CardContent, Chip, CircularProgress,
  Grid, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import {
  AccountTreeRounded, AddRounded, ArrowForwardRounded, EmojiEventsRounded,
  Groups2Rounded, PlayCircleOutlineRounded, SportsEsportsRounded,
} from '@mui/icons-material';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchTeams, fetchTournamentById, fetchTournamentsOverview } from '../api/apiClient';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import GameUpdatePanel from '../components/GameUpdatePanel';
import GameIcon from '../components/GameIcon';
import { AnimatedProgress, CelebrationBurst, CountUp, LiveDot } from '../components/Motion';

const STATUS_COLOR = { Created: 'default', Ongoing: 'primary', Completed: 'success' };
const STATUS_ORDER = { Ongoing: 0, Created: 1, Completed: 2 };

const teamInitials = (name = '') => name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';

const TeamPill = ({ name, score, winner = false, icon }) => (
  <Stack direction="row" alignItems="center" spacing={0.8} sx={{ minWidth: 0, opacity: winner ? 1 : 0.82 }}>
    <Avatar src={icon || undefined} alt={name || 'Team'} sx={{ width: 25, height: 25, bgcolor: winner ? 'secondary.main' : 'rgba(255,255,255,.13)', color: 'white', fontSize: 9, fontWeight: 900 }}>
      {teamInitials(name)}
    </Avatar>
    <Typography variant="caption" noWrap sx={{ color: 'white', fontWeight: winner ? 850 : 650 }}>{name || 'TBD'}</Typography>
    {score != null && <Typography variant="caption" sx={{ ml: 'auto !important', color: winner ? '#FFD86B' : 'rgba(255,255,255,.65)', fontWeight: 900 }}>{score}</Typography>}
  </Stack>
);

const MatchupPreview = ({ match, label, teamIcons = {} }) => {
  const participants = match?.participants || [];
  return (
    <Box sx={{ width: { xs: '100%', sm: 240 }, flex: { xs: '1 1 100%', sm: '1 1 240px' }, maxWidth: { sm: 310 }, p: 1, borderRadius: 2, bgcolor: 'rgba(2,14,20,.34)', border: '1px solid rgba(255,255,255,.10)' }}>
      <Typography variant="overline" sx={{ display: 'block', mb: 0.55, color: 'rgba(255,255,255,.48)', fontSize: 8, lineHeight: 1, letterSpacing: '.12em' }}>{label}</Typography>
      <Stack spacing={0.55}>
        <TeamPill name={participants[0]?.name} score={participants[0]?.resultText} winner={participants[0]?.isWinner} icon={teamIcons[participants[0]?.name]} />
        <TeamPill name={participants[1]?.name} score={participants[1]?.resultText} winner={participants[1]?.isWinner} icon={teamIcons[participants[1]?.name]} />
      </Stack>
    </Box>
  );
};

const StatCard = ({ icon, label, value, detail, selected, onClick }) => (
  <Card className="arena-lift" sx={{ height: '100%', boxShadow: selected ? '0 0 0 2px rgba(11,143,140,.50), 0 12px 28px rgba(14,52,59,.10)' : undefined }}>
    <CardActionArea onClick={onClick} aria-pressed={selected} sx={{ height: '100%', textAlign: 'left' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Stack direction="row" alignItems="center" spacing={1.75}>
          <Box sx={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 2.5,
            bgcolor: selected ? 'primary.main' : 'rgba(11,143,140,.09)', color: selected ? 'white' : 'primary.main', transition: 'all .2s ease' }}>{icon}</Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h2" sx={{ lineHeight: 1 }}><CountUp value={value} /></Typography>
            <Typography variant="body2" sx={{ mt: 0.45, fontWeight: 700 }}>{label}</Typography>
            <Typography variant="caption" color="text.secondary">{detail}</Typography>
          </Box>
          <ArrowForwardRounded sx={{ fontSize: 18, color: selected ? 'primary.main' : 'text.disabled' }} />
        </Stack>
      </CardContent>
    </CardActionArea>
  </Card>
);

const TournamentCard = ({ tournament, index, selected, onSelect }) => {
  const progress = tournament.matches_total > 0
    ? Math.round((tournament.matches_decided / tournament.matches_total) * 100)
    : 0;
  return (
    <Card className="arena-lift arena-stagger-in" sx={{
      '--stagger-index': index, position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      boxShadow: selected ? '0 0 0 2px rgba(11,143,140,.58), 0 16px 34px rgba(14,52,59,.14)' : undefined,
      transform: selected ? 'translateY(-3px)' : undefined,
      transition: 'transform .18s ease, box-shadow .18s ease',
      '&:hover': { transform: 'translateY(-3px)', boxShadow: selected ? '0 0 0 2px rgba(11,143,140,.68), 0 18px 38px rgba(14,52,59,.17)' : 3 },
    }}>
      <Box sx={{ height: 4, bgcolor: tournament.status === 'Completed' ? 'success.main' : tournament.status === 'Ongoing' ? 'primary.main' : 'divider' }} />
      <CardActionArea onClick={onSelect} aria-pressed={selected} aria-label={`Show ${tournament.name} summary`} sx={{ flexGrow: 1, display: 'flex', alignItems: 'stretch', textAlign: 'left' }}>
        <CardContent sx={{ p: 2.5, flexGrow: 1, width: '100%' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
              <GameIcon game={tournament.game} size={44} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h3" noWrap title={tournament.name}>{tournament.name}</Typography>
                <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.45 }}>{tournament.game || 'Game not selected'}</Typography>
              </Box>
            </Stack>
            <Chip size="small" label={tournament.status === 'Ongoing' ? <LiveDot label="LIVE" color="#4BC3BE" /> : tournament.status} color={STATUS_COLOR[tournament.status] || 'default'} />
          </Stack>

          <Stack direction="row" spacing={2.25} sx={{ mt: 2.5 }}>
            <Box><Typography variant="caption" color="text.secondary">Format</Typography><Typography variant="body2" sx={{ fontWeight: 750 }}>{tournament.format?.toUpperCase() || '—'}</Typography></Box>
            <Box><Typography variant="caption" color="text.secondary">Teams</Typography><Typography variant="body2" sx={{ fontWeight: 750 }}>{tournament.team_count}</Typography></Box>
            {tournament.total_rounds > 0 && <Box><Typography variant="caption" color="text.secondary">Rounds</Typography><Typography variant="body2" sx={{ fontWeight: 750 }}>{tournament.total_rounds}</Typography></Box>}
          </Stack>

          {tournament.status === 'Completed' && tournament.champion && (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ position: 'relative', zIndex: 1, mt: 2.5, p: 1.25, borderRadius: 2, bgcolor: 'rgba(244,166,33,.10)', color: '#8A5A00' }}>
              <EmojiEventsRounded sx={{ fontSize: 19 }} />
              <Typography variant="body2">Champion <strong>{tournament.champion}</strong></Typography>
            </Stack>
          )}
          {tournament.status === 'Ongoing' && (
            <Box sx={{ mt: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                <Typography variant="caption" color="text.secondary">Round {tournament.current_round} of {tournament.total_rounds}</Typography>
                <Typography variant="caption" sx={{ fontWeight: 750 }}>{progress}%</Typography>
              </Stack>
              <AnimatedProgress value={progress} sx={{ height: 6 }} />
            </Box>
          )}
          {tournament.status === 'Created' && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5 }}>
              {tournament.team_count > 0 ? 'Ready for more teams or bracket generation.' : 'Add teams to prepare this tournament.'}
            </Typography>
          )}
          <Typography variant="caption" sx={{ display: 'block', mt: 2, color: selected ? 'primary.main' : 'text.secondary', fontWeight: 750 }}>
            {selected ? 'Showing in control center' : 'Click for tournament summary'}
          </Typography>
        </CardContent>
      </CardActionArea>
      <Box sx={{ px: 2.5, pb: 2.25 }}>
        <Button fullWidth variant="outlined" startIcon={<AccountTreeRounded />} component={Link} to={`/bracket/${encodeURIComponent(tournament.name)}`}>Open bracket</Button>
      </Box>
      {tournament.status === 'Completed' && index < 3 && <CelebrationBurst />}
    </Card>
  );
};

const Home = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const spotlightRef = useRef(null);
  const [tournaments, setTournaments] = useState([]);
  const [teamIcons, setTeamIcons] = useState({});
  const [detailsById, setDetailsById] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [detailLoadingId, setDetailLoadingId] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');
  const [lens, setLens] = useState(searchParams.get('view') === 'teams' ? 'teams' : 'tournament');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [response, teamResponse] = await Promise.all([
        fetchTournamentsOverview(),
        fetchTeams().catch((requestError) => {
          console.warn('Team icons could not be loaded:', requestError);
          return { data: [] };
        }),
      ]);
      setTournaments(Array.isArray(response.data) ? response.data : []);
      const teams = Array.isArray(teamResponse.data) ? teamResponse.data : [];
      setTeamIcons(Object.fromEntries(teams.map((team) => [team.name, team.avatar_url || ''])));
    } catch (requestError) {
      console.error('Failed to fetch tournament overview:', requestError);
      setError('The dashboard could not be loaded. Check the API connection and try again.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const requestedLens = searchParams.get('view') === 'teams' ? 'teams' : 'tournament';
    setLens((current) => (current === requestedLens ? current : requestedLens));
  }, [searchParams]);

  useEffect(() => {
    if (loading || tournaments.length === 0) return;
    const requestedId = Number(searchParams.get('tournament'));
    const requested = tournaments.find((tournament) => tournament.id === requestedId);
    const fallback = tournaments.find((tournament) => tournament.status === 'Ongoing') || tournaments[0];
    const next = requested || fallback;
    setSelectedId((current) => (current === next.id ? current : next.id));
    if (!requested) {
      const params = new URLSearchParams(searchParams);
      params.set('tournament', String(next.id));
      setSearchParams(params, { replace: true });
    }
  }, [loading, searchParams, setSearchParams, tournaments]);

  useEffect(() => {
    if (!selectedId || detailsById[selectedId]) return undefined;
    let active = true;
    setDetailLoadingId(selectedId);
    setDetailError('');
    fetchTournamentById(selectedId)
      .then((response) => {
        if (active) setDetailsById((current) => ({ ...current, [selectedId]: response.data }));
      })
      .catch((requestError) => {
        console.error('Failed to fetch tournament detail:', requestError);
        if (active) setDetailError('Detailed match information is temporarily unavailable.');
      })
      .finally(() => { if (active) setDetailLoadingId(null); });
    return () => { active = false; };
  }, [detailsById, selectedId]);

  const counts = useMemo(() => ({
    active: tournaments.filter((t) => t.status === 'Ongoing').length,
    teams: tournaments.reduce((sum, t) => sum + (t.team_count || 0), 0),
    completed: tournaments.filter((t) => t.status === 'Completed').length,
  }), [tournaments]);

  const visible = useMemo(() => [...tournaments]
    .filter((t) => filter === 'All' || t.status === filter)
    .sort((a, b) => {
      if (filter === 'All' && lens === 'tournament') {
        if (a.id === selectedId) return -1;
        if (b.id === selectedId) return 1;
      }
      return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || b.id - a.id;
    }), [filter, lens, selectedId, tournaments]);

  const selectedTournament = tournaments.find((tournament) => tournament.id === selectedId);
  const selectedDetail = selectedId ? detailsById[selectedId] : null;
  const selectedProgress = selectedTournament?.matches_total
    ? Math.round((selectedTournament.matches_decided / selectedTournament.matches_total) * 100)
    : 0;

  const selectTournament = useCallback((tournament, { reveal = false, replace = false } = {}) => {
    if (!tournament) return;
    setSelectedId(tournament.id);
    setLens('tournament');
    setDetailError('');
    const params = new URLSearchParams(searchParams);
    params.set('tournament', String(tournament.id));
    params.delete('view');
    setSearchParams(params, { replace });
    if (reveal) {
      window.requestAnimationFrame(() => spotlightRef.current?.scrollIntoView?.({
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      }));
    }
  }, [searchParams, setSearchParams]);

  const focusStatus = (status) => {
    setFilter(status);
    const candidates = tournaments.filter((tournament) => tournament.status === status);
    selectTournament(candidates[candidates.length - 1]);
  };

  const showRegistrationLens = () => {
    setFilter('All');
    setLens('teams');
    const params = new URLSearchParams(searchParams);
    params.set('view', 'teams');
    setSearchParams(params);
  };

  const handleFilter = (value) => {
    if (!value) return;
    setFilter(value);
    setLens('tournament');
    if (value !== 'All') {
      const candidate = tournaments.find((tournament) => tournament.status === value);
      if (candidate) selectTournament(candidate);
    }
  };

  let spotlight = { tone: 'setup', title: 'The arena is quiet—for now', message: 'Create a tournament and the control center will track every team, round, and result.' };
  let spotlightDetails = null;

  if (loading) {
    spotlight = { tone: 'live', title: 'Scanning the arena…', message: 'Checking every bracket and scoreboard for fresh updates.' };
  } else if (lens === 'teams') {
    const registeredTournaments = [...tournaments].filter((tournament) => tournament.team_count > 0).sort((a, b) => b.team_count - a.team_count);
    spotlight = {
      tone: 'setup',
      title: `${counts.teams} registered ${counts.teams === 1 ? 'entry' : 'entries'}`,
      message: `Teams are currently spread across ${registeredTournaments.length} tournament${registeredTournaments.length === 1 ? '' : 's'}. Select an event below to inspect its full lineup.`,
      action: { label: 'Manage teams', component: Link, to: '/register-team' },
    };
    spotlightDetails = (
      <Stack direction="row" flexWrap="wrap" gap={0.75}>
        {registeredTournaments.slice(0, 6).map((tournament) => (
          <Chip key={tournament.id} size="small" label={`${tournament.name} · ${tournament.team_count}`} onClick={() => selectTournament(tournament)}
            sx={{ color: 'white', bgcolor: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.10)', '&:hover': { bgcolor: 'rgba(255,255,255,.14)' } }} />
        ))}
      </Stack>
    );
  } else if (selectedTournament) {
    const isDetailLoading = detailLoadingId === selectedTournament.id;
    const matches = selectedDetail?.matches || [];
    const currentRound = selectedTournament.current_round || Math.max(0, ...matches.map((match) => match.round_number || 0));
    const onDeck = matches.filter((match) => match.round_number === currentRound && !match.winner);
    const finalRound = Math.max(0, ...matches.map((match) => match.round_number || 0));
    const finalMatch = matches.find((match) => match.round_number === finalRound);

    if (isDetailLoading && !selectedDetail) {
      spotlight = { game: selectedTournament.game, tone: 'live', title: `Loading ${selectedTournament.name}…`, message: 'Pulling the latest teams, scores, and round state.' };
      spotlightDetails = <CircularProgress size={18} sx={{ color: 'secondary.main' }} />;
    } else if (selectedTournament.status === 'Ongoing') {
      spotlight = {
        game: selectedTournament.game,
        tone: 'live',
        title: `${selectedTournament.name} is live`,
        message: `${selectedTournament.matches_decided} of ${selectedTournament.matches_total} matches are decided. Round ${currentRound} is currently on deck.`,
        progress: selectedProgress,
        action: { label: 'Open live bracket', component: Link, to: `/bracket/${encodeURIComponent(selectedTournament.name)}` },
      };
      spotlightDetails = onDeck.length ? (
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {onDeck.slice(0, 2).map((match, index) => <MatchupPreview key={match.id} match={match} teamIcons={teamIcons} label={`ON DECK · MATCH ${index + 1}`} />)}
          {onDeck.length > 2 && <Chip size="small" label={`+${onDeck.length - 2} more this round`} sx={{ alignSelf: 'center', color: 'white', bgcolor: 'rgba(255,255,255,.09)' }} />}
        </Stack>
      ) : <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.58)' }}>The next matchup will appear as soon as the round advances.</Typography>;
    } else if (selectedTournament.status === 'Completed') {
      spotlight = {
        game: selectedTournament.game,
        tone: 'celebrate',
        title: `${selectedTournament.champion || 'A champion'} conquered ${selectedTournament.name}`,
        message: `${selectedTournament.matches_decided} match${selectedTournament.matches_decided === 1 ? '' : 'es'} decided across ${selectedTournament.total_rounds} round${selectedTournament.total_rounds === 1 ? '' : 's'}.`,
        progress: 100,
        action: { label: 'View final bracket', component: Link, to: `/bracket/${encodeURIComponent(selectedTournament.name)}` },
      };
      spotlightDetails = finalMatch
        ? <MatchupPreview match={finalMatch} teamIcons={teamIcons} label="CHAMPIONSHIP RESULT" />
        : <TeamPill name={selectedTournament.champion} icon={teamIcons[selectedTournament.champion]} winner />;
    } else {
      const teams = selectedDetail?.teams || [];
      spotlight = {
        game: selectedTournament.game,
        tone: 'setup',
        title: `${selectedTournament.name} is assembling`,
        message: `${teams.length} team${teams.length === 1 ? '' : 's'} registered. ${teams.length < 2 ? 'At least two are needed to open the bracket.' : 'The field is ready for seeding.'}`,
        action: { label: 'Manage registration', component: Link, to: '/register-team' },
      };
      spotlightDetails = teams.length ? (
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          {teams.map((team) => <Chip key={team} avatar={<Avatar src={teamIcons[team] || undefined} alt={team}>{teamInitials(team)}</Avatar>} label={team} size="small" sx={{ color: 'white', bgcolor: 'rgba(255,255,255,.08)' }} />)}
        </Stack>
      ) : <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.58)' }}>No teams have entered this tournament yet.</Typography>;
    }
  }

  return (
    <Box>
      <PageHeader
        eyebrow="Tournament control center"
        title={user ? `Welcome back, ${user.username}` : 'Arena Master dashboard'}
        description="Select a tournament to inspect its teams, current matchups, and path through the arena."
        actions={<Button variant="contained" startIcon={<AddRounded />} component={Link} to="/create-tournament">New tournament</Button>}
      />

      <Box ref={spotlightRef} sx={{ mb: 3, scrollMarginTop: 84 }}>
        <GameUpdatePanel game={spotlight.game} title={spotlight.title} message={spotlight.message} action={spotlight.action} progress={spotlight.progress} tone={spotlight.tone}>
          {spotlightDetails}
        </GameUpdatePanel>
        {detailError && lens === 'tournament' && <Alert severity="warning" sx={{ mt: 1 }}>{detailError}</Alert>}
      </Box>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}><StatCard icon={<PlayCircleOutlineRounded />} label="Active tournaments" value={counts.active} detail="Focus live competitions" selected={lens === 'tournament' && filter === 'Ongoing'} onClick={() => focusStatus('Ongoing')} /></Grid>
        <Grid item xs={12} sm={4}><StatCard icon={<Groups2Rounded />} label="Registered entries" value={counts.teams} detail="Inspect the tournament fields" selected={lens === 'teams'} onClick={showRegistrationLens} /></Grid>
        <Grid item xs={12} sm={4}><StatCard icon={<EmojiEventsRounded />} label="Completed events" value={counts.completed} detail="Revisit champions and finals" selected={lens === 'tournament' && filter === 'Completed'} onClick={() => focusStatus('Completed')} /></Grid>
      </Grid>

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 2 }}>
        <Box><Typography variant="h2">Your tournaments</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>Select a card to load its live control-center summary.</Typography></Box>
        <ToggleButtonGroup exclusive size="small" value={filter} onChange={(_, value) => handleFilter(value)} sx={{ maxWidth: '100%', overflowX: 'auto' }}>
          {['All', 'Ongoing', 'Created', 'Completed'].map((item) => <ToggleButton key={item} value={item}>{item}</ToggleButton>)}
        </ToggleButtonGroup>
      </Stack>

      {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>} sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Grid container spacing={2}>{[1, 2, 3].map((item) => <Grid item xs={12} sm={6} lg={4} key={item}><Skeleton variant="rounded" height={330} /></Grid>)}</Grid>
      ) : visible.length > 0 ? (
        <Grid container spacing={2.25}>{visible.map((t, index) => (
          <Grid item xs={12} sm={6} lg={4} key={t.id}>
            <TournamentCard tournament={t} index={index} selected={lens === 'tournament' && selectedId === t.id} onSelect={() => selectTournament(t, { reveal: true })} />
          </Grid>
        ))}</Grid>
      ) : (
        <EmptyState
          icon={<SportsEsportsRounded />}
          title={tournaments.length ? `No ${filter.toLowerCase()} tournaments` : 'Create your first tournament'}
          description={tournaments.length ? 'Choose another filter to see your competitions.' : 'Set the game and series format, then invite teams and generate a bracket.'}
          action={!tournaments.length ? <Button variant="contained" startIcon={<AddRounded />} component={Link} to="/create-tournament">Create tournament</Button> : null}
        />
      )}
    </Box>
  );
};

export default Home;
