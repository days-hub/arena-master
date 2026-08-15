import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Grid,
  Skeleton, Stack, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import {
  AccountTreeRounded, AddRounded, EmojiEventsRounded, Groups2Rounded,
  PlayCircleOutlineRounded, SportsEsportsRounded,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { fetchTournamentsOverview } from '../api/apiClient';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import GameUpdatePanel from '../components/GameUpdatePanel';
import GameIcon from '../components/GameIcon';
import { AnimatedProgress, CelebrationBurst, CountUp, LiveDot } from '../components/Motion';

const STATUS_COLOR = { Created: 'default', Ongoing: 'primary', Completed: 'success' };
const STATUS_ORDER = { Ongoing: 0, Created: 1, Completed: 2 };

const StatCard = ({ icon, label, value, detail }) => (
  <Card className="arena-lift" sx={{ height: '100%' }}>
    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <Stack direction="row" alignItems="center" spacing={1.75}>
        <Box sx={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 2.5,
          bgcolor: 'rgba(11,143,140,.09)', color: 'primary.main' }}>{icon}</Box>
        <Box>
          <Typography variant="h2" sx={{ lineHeight: 1 }}><CountUp value={value} /></Typography>
          <Typography variant="body2" sx={{ mt: 0.45, fontWeight: 700 }}>{label}</Typography>
          <Typography variant="caption" color="text.secondary">{detail}</Typography>
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

const TournamentCard = ({ tournament, index }) => {
  const progress = tournament.matches_total > 0
    ? Math.round((tournament.matches_decided / tournament.matches_total) * 100)
    : 0;
  return (
    <Card className="arena-lift arena-stagger-in" sx={{ '--stagger-index': index, position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      transition: 'transform .18s ease, box-shadow .18s ease',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 } }}>
      <Box sx={{ height: 4, bgcolor: tournament.status === 'Completed' ? 'success.main' : tournament.status === 'Ongoing' ? 'primary.main' : 'divider' }} />
      <CardContent sx={{ p: 2.5, flexGrow: 1 }}>
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
      </CardContent>
      <Box sx={{ px: 2.5, pb: 2.25 }}>
        <Button fullWidth variant="outlined" startIcon={<AccountTreeRounded />} component={Link} to={`/bracket/${encodeURIComponent(tournament.name)}`}>Open bracket</Button>
      </Box>
      {tournament.status === 'Completed' && index < 3 && <CelebrationBurst />}
    </Card>
  );
};

const Home = () => {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('All');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchTournamentsOverview();
      setTournaments(Array.isArray(response.data) ? response.data : []);
    } catch (requestError) {
      console.error('Failed to fetch tournament overview:', requestError);
      setError('The dashboard could not be loaded. Check the API connection and try again.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    active: tournaments.filter((t) => t.status === 'Ongoing').length,
    teams: tournaments.reduce((sum, t) => sum + (t.team_count || 0), 0),
    completed: tournaments.filter((t) => t.status === 'Completed').length,
  }), [tournaments]);

  const visible = useMemo(() => tournaments
    .filter((t) => filter === 'All' || t.status === filter)
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)), [tournaments, filter]);

  const focusTournament = tournaments.find((tournament) => tournament.status === 'Ongoing');
  const decidedMatches = tournaments.reduce((sum, tournament) => sum + (tournament.matches_decided || 0), 0);
  const arenaUpdate = loading
    ? { tone: 'live', title: 'Scanning the arena…', message: 'I’m checking every bracket and scoreboard for fresh updates.' }
    : focusTournament
      ? {
          tone: 'live',
          title: `${focusTournament.name} is live`,
          message: `${focusTournament.matches_decided} of ${focusTournament.matches_total} matches are decided. Round ${focusTournament.current_round} is currently on deck.`,
          progress: focusTournament.matches_total ? Math.round((focusTournament.matches_decided / focusTournament.matches_total) * 100) : 0,
          action: { label: 'Open live bracket', component: Link, to: `/bracket/${encodeURIComponent(focusTournament.name)}` },
        }
      : tournaments.length === 0
        ? { tone: 'setup', title: 'The arena is quiet—for now', message: 'Create a tournament and I’ll keep an eye on every team, round, and result.' }
        : counts.completed > 0
          ? { tone: 'celebrate', title: `${counts.completed} champion${counts.completed === 1 ? '' : 's'} crowned`, message: `${decidedMatches} matches are in the books. The trophy shelf is starting to look good.` }
          : { tone: 'setup', title: 'Teams are assembling', message: 'Your tournaments are ready for registration and bracket generation.' };

  return (
    <Box>
      <PageHeader
        eyebrow="Tournament control center"
        title={user ? `Welcome back, ${user.username}` : 'Arena Master dashboard'}
        description="Track active competitions, open a live bracket, or start planning your next event."
        actions={<Button variant="contained" startIcon={<AddRounded />} component={Link} to="/create-tournament">New tournament</Button>}
      />

      <Box sx={{ mb: 3 }}>
        <GameUpdatePanel game={focusTournament?.game} {...arenaUpdate} />
      </Box>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}><StatCard icon={<PlayCircleOutlineRounded />} label="Active tournaments" value={counts.active} detail="Currently in progress" /></Grid>
        <Grid item xs={12} sm={4}><StatCard icon={<Groups2Rounded />} label="Registered entries" value={counts.teams} detail="Across all tournaments" /></Grid>
        <Grid item xs={12} sm={4}><StatCard icon={<EmojiEventsRounded />} label="Completed events" value={counts.completed} detail="Champions crowned" /></Grid>
      </Grid>

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ mb: 2 }}>
        <Box><Typography variant="h2">Your tournaments</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>Recent competitions and their current state.</Typography></Box>
        <ToggleButtonGroup exclusive size="small" value={filter} onChange={(_, value) => value && setFilter(value)} sx={{ maxWidth: '100%', overflowX: 'auto' }}>
          {['All', 'Ongoing', 'Created', 'Completed'].map((item) => <ToggleButton key={item} value={item}>{item}</ToggleButton>)}
        </ToggleButtonGroup>
      </Stack>

      {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>} sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Grid container spacing={2}>{[1, 2, 3].map((item) => <Grid item xs={12} sm={6} lg={4} key={item}><Skeleton variant="rounded" height={310} /></Grid>)}</Grid>
      ) : visible.length > 0 ? (
        <Grid container spacing={2.25}>{visible.map((t, index) => <Grid item xs={12} sm={6} lg={4} key={t.id}><TournamentCard tournament={t} index={index} /></Grid>)}</Grid>
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
