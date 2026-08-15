import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, FormControl, Grid,
  IconButton, InputLabel, List, ListItem, ListItemAvatar, ListItemText,
  MenuItem, Select, Snackbar, Stack, TextField, ToggleButton,
  ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import {
  AddRounded, DeleteOutlineRounded, EditRounded, Groups2Rounded, LockOutlined, SportsEsportsRounded,
} from '@mui/icons-material';
import {
  createTournament, deleteTournament, fetchGames, fetchTournaments, getApiErrorMessage,
  unregisterTeam, updateTournament,
} from '../api/apiClient';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import GameIcon from '../components/GameIcon';
import { AnimatedProgress } from '../components/Motion';

const TournamentCreation = () => {
  const { isAuthenticated, signIn } = useAuth();
  const [name, setName] = useState('');
  const [game, setGame] = useState('');
  const [format, setFormat] = useState('bo1');
  const [games, setGames] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pendingDrop, setPendingDrop] = useState(null);
  const [editingTournament, setEditingTournament] = useState(null);
  const setupProgress = Math.round(([name.trim(), game].filter(Boolean).length / 2) * 100);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [gamesResponse, tournamentsResponse] = await Promise.all([fetchGames(), fetchTournaments()]);
      setGames(Array.isArray(gamesResponse.data) ? gamesResponse.data : []);
      setTournaments(Array.isArray(tournamentsResponse.data) ? tournamentsResponse.data : []);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Tournament data could not be loaded.'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim() || !game) {
      setNotice({ severity: 'warning', text: 'Add a tournament name and choose a game.' });
      return;
    }
    setSaving(true);
    try {
      const response = await createTournament({ name: name.trim(), game, format });
      setTournaments((current) => [...current, response.data]);
      setName('');
      setNotice({ severity: 'success', text: 'Tournament created and ready for team registration.' });
    } catch (requestError) {
      setNotice({ severity: 'error', text: getApiErrorMessage(requestError, 'The tournament could not be created.') });
    } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteTournament(target.id);
      setTournaments((current) => current.filter((item) => item.id !== target.id));
      setNotice({ severity: 'success', text: `${target.name} was deleted.` });
    } catch (requestError) {
      setNotice({ severity: 'error', text: getApiErrorMessage(requestError, 'The tournament could not be deleted.') });
    }
  };

  const saveTournamentEdit = async () => {
    if (!editingTournament?.name?.trim() || !editingTournament.game) return;
    setSaving(true);
    try {
      const response = await updateTournament(editingTournament.id, {
        name: editingTournament.name.trim(),
        game: editingTournament.game,
        format: editingTournament.format,
      });
      setTournaments((current) => current.map((item) => item.id === editingTournament.id ? response.data : item));
      setEditingTournament(null);
      setNotice({ severity: 'success', text: 'Tournament details updated.' });
    } catch (requestError) {
      setNotice({ severity: 'error', text: getApiErrorMessage(requestError, 'The tournament could not be updated.') });
    } finally { setSaving(false); }
  };

  const confirmDropTeam = async () => {
    if (!pendingDrop) return;
    const target = pendingDrop;
    setPendingDrop(null);
    try {
      const response = await unregisterTeam(target.tournament.id, target.team);
      setTournaments((current) => current.map((item) => item.id === target.tournament.id
        ? response.data.tournament
        : item));
      setNotice({ severity: 'success', text: response.data.message || `${target.team} was removed.` });
    } catch (requestError) {
      setNotice({ severity: 'error', text: getApiErrorMessage(requestError, 'The team could not be removed from the tournament.') });
    }
  };

  return (
    <Box>
      <PageHeader eyebrow="Tournament management" title="Build your next competition"
        description="Choose the game and series format now. Teams and bracket seeding come next." />

      {!isAuthenticated && (
        <Alert severity="info" icon={<LockOutlined />} sx={{ mb: 3 }}
          action={<Button color="inherit" size="small" onClick={signIn}>Sign in</Button>}>
          Sign in with Discord to create and manage tournaments. Existing tournaments remain visible to spectators.
        </Alert>
      )}
      {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>} sx={{ mb: 3 }}>{error}</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} lg={5}>
          <Card component="form" className="arena-lift" onSubmit={handleSubmit} sx={{ position: { lg: 'sticky' }, top: { lg: 24 } }}>
            <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
              <Typography variant="h2">Create tournament</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 3 }}>
                Start with the essentials. You can add teams after creation.
              </Typography>
              <Box sx={{ mb: 3, p: 1.5, borderRadius: 2.5, bgcolor: 'rgba(11,143,140,.055)', border: '1px solid rgba(11,143,140,.09)' }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.8 }}>
                  <Typography variant="caption" sx={{ fontWeight: 750 }}>Setup progress</Typography>
                  <Typography variant="caption" color="text.secondary">{setupProgress === 100 ? 'Ready to launch' : `${setupProgress}%`}</Typography>
                </Stack>
                <AnimatedProgress value={setupProgress} sx={{ height: 5 }} />
              </Box>
              <Stack spacing={2.5}>
                <TextField label="Tournament name" value={name} onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Summer Rift Open" required fullWidth autoComplete="off" />
                <FormControl fullWidth required>
                  <InputLabel>Game</InputLabel>
                  <Select label="Game" value={game} onChange={(event) => setGame(event.target.value)}>
                    {games.map((option) => (
                      <MenuItem key={option} value={option}>
                        <GameIcon game={option} size={26} sx={{ mr: 1.25, borderRadius: 1.25 }} />
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Box>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 700 }}>Series format</Typography>
                  <ToggleButtonGroup exclusive fullWidth value={format} onChange={(_, value) => value && setFormat(value)}>
                    <ToggleButton value="bo1">Best of 1</ToggleButton>
                    <ToggleButton value="bo3">Best of 3</ToggleButton>
                    <ToggleButton value="bo5">Best of 5</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <Button type="submit" variant="contained" size="large" startIcon={saving ? <CircularProgress color="inherit" size={18} /> : <AddRounded />}
                  disabled={!isAuthenticated || saving || loading}>
                  {saving ? 'Creating…' : 'Create tournament'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={7}>
          <Card className="arena-lift">
            <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h2">All tournaments</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>{tournaments.length} total competitions</Typography>
                </Box>
                <Chip label={`${tournaments.length} total`} variant="outlined" />
              </Stack>
              <Divider />
              {loading ? (
                <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress size={28} /></Box>
              ) : tournaments.length ? (
                <List disablePadding>
                  {tournaments.map((tournament, index) => (
                    <React.Fragment key={tournament.id}>
                      <ListItem className="arena-list-row" alignItems="flex-start" sx={{ px: 0, py: 2, borderRadius: 2 }} secondaryAction={
                        <Stack direction="row" spacing={0.25}>
                          <Tooltip title="Edit tournament">
                            <span><IconButton disabled={!isAuthenticated} onClick={() => setEditingTournament({ ...tournament })}><EditRounded /></IconButton></span>
                          </Tooltip>
                          <Tooltip title="Delete tournament">
                            <span><IconButton edge="end" color="error" disabled={!isAuthenticated} onClick={() => setPendingDelete(tournament)}><DeleteOutlineRounded /></IconButton></span>
                          </Tooltip>
                        </Stack>
                      }>
                        <ListItemAvatar>
                          <GameIcon game={tournament.game} />
                        </ListItemAvatar>
                        <ListItemText
                          primary={<Typography sx={{ fontWeight: 750 }}>{tournament.name}</Typography>}
                          secondary={(
                            <Box sx={{ mt: 0.4 }}>
                              <Typography variant="body2" color="text.secondary">
                                {tournament.game || 'No game'} · {tournament.format?.toUpperCase() || 'No format'}
                              </Typography>
                              <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.7} sx={{ mt: 1 }}>
                                <Groups2Rounded sx={{ mr: 0.2, color: 'text.secondary', fontSize: 17 }} />
                                {(tournament.teams || []).length
                                  ? tournament.teams.map((team) => (
                                    <Chip key={team} size="small" label={team}
                                      onDelete={isAuthenticated ? () => setPendingDrop({ tournament, team }) : undefined} />
                                  ))
                                  : <Chip size="small" variant="outlined" label="No teams registered" />}
                              </Stack>
                            </Box>
                          )}
                          disableTypography
                          sx={{ pr: 5 }}
                        />
                      </ListItem>
                      {index < tournaments.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Box sx={{ pt: 3 }}><EmptyState compact icon={<SportsEsportsRounded />} title="No tournaments yet" description="Your first tournament will appear here after creation." /></Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={!!pendingDelete} onClose={() => setPendingDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete tournament?</DialogTitle>
        <DialogContent><Typography color="text.secondary">This permanently removes <strong>{pendingDelete?.name}</strong>, its bracket, and all recorded results.</Typography></DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDelete}>Delete tournament</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!pendingDrop} onClose={() => setPendingDrop(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove team from tournament?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            Remove <strong>{pendingDrop?.team}</strong> from <strong>{pendingDrop?.tournament?.name}</strong>?
            If its bracket is underway, its active match will be conceded and the opponent will advance automatically.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button onClick={() => setPendingDrop(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmDropTeam}>Remove team</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editingTournament} onClose={() => !saving && setEditingTournament(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit tournament</DialogTitle>
        <DialogContent>
          <Stack spacing={2.25} sx={{ pt: 1 }}>
            <TextField label="Tournament name" value={editingTournament?.name || ''}
              onChange={(event) => setEditingTournament((current) => ({ ...current, name: event.target.value }))} required />
            <FormControl fullWidth required>
              <InputLabel>Game</InputLabel>
              <Select label="Game" value={editingTournament?.game || ''}
                onChange={(event) => setEditingTournament((current) => ({ ...current, game: event.target.value }))}>
                {games.map((option) => (
                  <MenuItem key={option} value={option}>
                    <GameIcon game={option} size={26} sx={{ mr: 1.25, borderRadius: 1.25 }} />
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Series format</InputLabel>
              <Select label="Series format" value={editingTournament?.format || 'bo1'}
                disabled={editingTournament?.status && editingTournament.status !== 'Created'}
                onChange={(event) => setEditingTournament((current) => ({ ...current, format: event.target.value }))}>
                <MenuItem value="bo1">Best of 1</MenuItem>
                <MenuItem value="bo3">Best of 3</MenuItem>
                <MenuItem value="bo5">Best of 5</MenuItem>
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary">
              {editingTournament?.status && editingTournament.status !== 'Created'
                ? 'Series format is locked because this bracket has already started.'
                : 'Series format locks after bracket generation.'}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}>
          <Button onClick={() => setEditingTournament(null)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={saveTournamentEdit} disabled={saving || !editingTournament?.name?.trim() || !editingTournament?.game}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!notice} autoHideDuration={4500} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {notice ? <Alert severity={notice.severity} variant="filled" onClose={() => setNotice(null)}>{notice.text}</Alert> : <span />}
      </Snackbar>
    </Box>
  );
};

export default TournamentCreation;
