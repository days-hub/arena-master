import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Card, CardContent, CardActions,
  Chip, Grid, LinearProgress, Stack,
} from '@mui/material';
import { EmojiEvents, AccountTree, Add } from '@mui/icons-material';
import { Link } from 'react-router-dom';
import { fetchTournamentsOverview } from '../api/apiClient';

const STATUS_COLOR = { Created: 'default', Ongoing: 'primary', Completed: 'success' };

// Dashboard home: every tournament at a glance — status, progress, champion —
// with one-click navigation into its bracket.
const Home = () => {
  const [tournaments, setTournaments] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetchTournamentsOverview();
        if (Array.isArray(response.data)) setTournaments(response.data);
      } catch (error) {
        console.error('Failed to fetch tournament overview:', error);
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, []);

  const progressPct = (t) =>
    t.matches_total > 0 ? Math.round((t.matches_decided / t.matches_total) * 100) : 0;

  return (
    <Box sx={{ maxWidth: '1000px', margin: '0 auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <img src="/images/ArenaMaster.png" alt="Arena Master" style={{ width: 56, height: 56 }} />
          <Box>
            <Typography variant="h5">Arena Master</Typography>
            <Typography variant="body2" color="text.secondary">
              Tournament dashboard
            </Typography>
          </Box>
        </Box>
        <Button variant="contained" startIcon={<Add />} component={Link} to="/create-tournament">
          New Tournament
        </Button>
      </Box>

      {loaded && tournaments.length === 0 && (
        <Typography color="text.secondary">
          No tournaments yet. Create one to get started.
        </Typography>
      )}

      <Grid container spacing={2}>
        {tournaments.map((t) => (
          <Grid item xs={12} sm={6} md={4} key={t.id}>
            <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="h6" noWrap title={t.name}>{t.name}</Typography>
                  <Chip size="small" label={t.status} color={STATUS_COLOR[t.status] || 'default'} />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {t.game || 'No game set'} · {t.format?.toUpperCase()} · {t.team_count} teams
                </Typography>

                {t.status === 'Completed' && t.champion && (
                  <Stack direction="row" alignItems="center" gap={1}>
                    <EmojiEvents color="warning" fontSize="small" />
                    <Typography variant="body2">
                      Champion: <strong>{t.champion}</strong>
                    </Typography>
                  </Stack>
                )}

                {t.status === 'Ongoing' && (
                  <Box>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                      Round {t.current_round} of {t.total_rounds} ·{' '}
                      {t.matches_decided}/{t.matches_total} matches decided
                    </Typography>
                    <LinearProgress variant="determinate" value={progressPct(t)} />
                  </Box>
                )}

                {t.status === 'Created' && (
                  <Typography variant="body2" color="text.secondary">
                    {t.team_count > 0
                      ? 'Teams registered — bracket not generated yet.'
                      : 'No teams registered yet.'}
                  </Typography>
                )}
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  startIcon={<AccountTree />}
                  component={Link}
                  to={`/bracket/${encodeURIComponent(t.name)}`}
                >
                  View bracket
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Home;
