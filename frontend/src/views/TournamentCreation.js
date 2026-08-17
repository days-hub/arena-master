import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Collapse, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, FormControl, Grid, InputAdornment,
  IconButton, InputLabel, List, ListItem, ListItemAvatar, ListItemIcon, ListItemText,
  Menu, MenuItem, Select, Snackbar, Stack, TextField, ToggleButton,
  ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import {
  AddRounded, DeleteOutlineRounded, EditRounded, EmojiEventsRounded, ExpandMoreRounded,
  Groups2Rounded, LockOutlined, MoreVertRounded, SearchRounded, SportsEsportsRounded,
} from '@mui/icons-material';
import {
  createTournament, deleteTournament, fetchGames, fetchTournaments, fetchTournamentsOverview,
  getApiErrorMessage, unregisterTeam, updateTournament,
} from '../api/apiClient';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import GameIcon from '../components/GameIcon';
import { AnimatedProgress } from '../components/Motion';

const STATUS_COLOR = { Ongoing: 'primary', Completed: 'success', Created: 'default' };
const STATUS_ACCENT = { Ongoing: 'primary.main', Completed: 'success.main', Created: 'divider' };
const STATUS_ORDER = { Ongoing: 0, Created: 1, Completed: 2 };

const getProgress = (tournament) => {
  if (tournament.status === 'Completed') return 100;
  if (!tournament.matches_total) return 0;
  return Math.round(((tournament.matches_decided || 0) / tournament.matches_total) * 100);
};

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
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [rowMenu, setRowMenu] = useState(null);
  const setupProgress = Math.round(([name.trim(), game].filter(Boolean).length / 2) * 100);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [gamesResponse, tournamentsResponse, overviewResponse] = await Promise.all([
        fetchGames(), fetchTournaments(), fetchTournamentsOverview(),
      ]);
      setGames(Array.isArray(gamesResponse.data) ? gamesResponse.data : []);
      const tournamentDetails = Array.isArray(tournamentsResponse.data) ? tournamentsResponse.data : [];
      const overviewById = new Map((Array.isArray(overviewResponse.data) ? overviewResponse.data : [])
        .map((tournament) => [tournament.id, tournament]));
      setTournaments(tournamentDetails.map((tournament) => ({
        ...tournament,
        ...(overviewById.get(tournament.id) || {}),
        teams: tournament.teams || [],
      })));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Tournament data could not be loaded.'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visibleTournaments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...tournaments]
      .filter((tournament) => statusFilter === 'All' || tournament.status === statusFilter)
      .filter((tournament) => !normalizedQuery
        || tournament.name?.toLowerCase().includes(normalizedQuery)
        || tournament.game?.toLowerCase().includes(normalizedQuery)
        || (tournament.teams || []).some((team) => team.toLowerCase().includes(normalizedQuery)))
      .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || b.id - a.id);
  }, [query, statusFilter, tournaments]);

  const toggleExpanded = (id) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const closeRowMenu = () => setRowMenu(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!name.trim() || !game) {
      setNotice({ severity: 'warning', text: 'Add a tournament name and choose a game.' });
      return;
    }
    setSaving(true);
    try {
      const response = await createTournament({ name: name.trim(), game, format });
      setTournaments((current) => [...current, {
        ...response.data,
        teams: response.data.teams || [],
        team_count: response.data.teams?.length || 0,
        matches_total: 0,
        matches_decided: 0,
        current_round: 0,
        total_rounds: 0,
        champion: null,
      }]);
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
      setTournaments((current) => current.map((item) => item.id === editingTournament.id
        ? { ...item, ...response.data, teams: response.data.teams || item.teams || [] }
        : item));
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
        ? {
          ...item,
          ...response.data.tournament,
          teams: response.data.tournament.teams || [],
          team_count: response.data.tournament.teams?.length || 0,
        }
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
        <Grid item xs={12} lg={5} sx={{ alignSelf: 'flex-start', position: { lg: 'sticky' }, top: { lg: 24 } }}>
          <Card component="form" className="arena-lift" onSubmit={handleSubmit}>
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
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="h2">All tournaments</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>{tournaments.length} total competitions</Typography>
                </Box>
                <Chip label={`${visibleTournaments.length} shown`} variant="outlined" />
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 2.5, mb: 2 }}>
                <TextField
                  size="small"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search tournaments, games, or teams"
                  inputProps={{ 'aria-label': 'Search tournaments' }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }}
                  sx={{ flex: 1 }}
                />
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={statusFilter}
                  onChange={(_, value) => value && setStatusFilter(value)}
                  aria-label="Tournament status"
                  sx={{ maxWidth: '100%', overflowX: 'auto', flexShrink: 0 }}
                >
                  <ToggleButton value="All">All</ToggleButton>
                  <ToggleButton value="Ongoing">Live</ToggleButton>
                  <ToggleButton value="Created">Created</ToggleButton>
                  <ToggleButton value="Completed">Completed</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
              <Divider />
              {loading ? (
                <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress size={28} /></Box>
              ) : visibleTournaments.length ? (
                <List disablePadding aria-label="Tournament directory">
                  {visibleTournaments.map((tournament, index) => {
                    const teams = tournament.teams || [];
                    const teamCount = tournament.team_count ?? teams.length;
                    const progress = getProgress(tournament);
                    const expanded = expandedIds.has(tournament.id);
                    return (
                      <React.Fragment key={tournament.id}>
                        <ListItem
                          className="arena-list-row"
                          alignItems="flex-start"
                          sx={{ pl: 1.5, pr: 7, py: 2.25, borderRadius: 2, borderLeft: '3px solid', borderLeftColor: STATUS_ACCENT[tournament.status] || 'divider' }}
                          secondaryAction={(
                            <Tooltip title="Tournament actions">
                              <span>
                                <IconButton
                                  edge="end"
                                  disabled={!isAuthenticated}
                                  aria-label={`Actions for ${tournament.name}`}
                                  onClick={(event) => setRowMenu({ anchor: event.currentTarget, tournament })}
                                >
                                  <MoreVertRounded />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                        >
                          <ListItemAvatar sx={{ mt: 0.25 }}>
                            <GameIcon game={tournament.game} />
                          </ListItemAvatar>
                          <ListItemText
                            primary={(
                              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                                <Typography sx={{ fontWeight: 800 }}>{tournament.name}</Typography>
                                <Chip size="small" label={tournament.status === 'Ongoing' ? 'Live' : tournament.status}
                                  color={STATUS_COLOR[tournament.status] || 'default'} variant={tournament.status === 'Created' ? 'outlined' : 'filled'} />
                              </Stack>
                            )}
                            secondary={(
                              <Box sx={{ mt: 0.45 }}>
                                <Typography variant="body2" color="text.secondary">
                                  {tournament.game || 'No game'} · {tournament.format?.toUpperCase() || 'No format'}
                                </Typography>

                                <Stack direction="row" alignItems="center" flexWrap="wrap" gap={{ xs: 1.25, sm: 2 }} sx={{ mt: 1.35 }}>
                                  <Stack direction="row" alignItems="center" spacing={0.65} sx={{ color: 'text.secondary' }}>
                                    <Groups2Rounded sx={{ fontSize: 18 }} />
                                    <Typography variant="caption" sx={{ fontWeight: 750 }}>{teamCount} team{teamCount === 1 ? '' : 's'}</Typography>
                                  </Stack>

                                  <Box sx={{ width: { xs: '100%', sm: 190 } }}>
                                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                                      <Typography variant="caption" color="text.secondary">
                                        {tournament.status === 'Created'
                                          ? 'Not started'
                                          : tournament.total_rounds
                                            ? `Round ${tournament.current_round || tournament.total_rounds} of ${tournament.total_rounds}`
                                            : 'Progress'}
                                      </Typography>
                                      <Typography variant="caption" sx={{ fontWeight: 800 }}>{progress}%</Typography>
                                    </Stack>
                                    <AnimatedProgress value={progress} sx={{ height: 5 }} />
                                  </Box>

                                  <Stack direction="row" alignItems="center" spacing={0.65} sx={{ minWidth: 0, color: tournament.champion ? 'warning.dark' : 'text.secondary' }}>
                                    <EmojiEventsRounded sx={{ fontSize: 17 }} />
                                    <Typography variant="caption" noWrap sx={{ maxWidth: 170, fontWeight: tournament.champion ? 800 : 650 }}>
                                      Champion: {tournament.champion || 'TBD'}
                                    </Typography>
                                  </Stack>
                                </Stack>

                                <Button
                                  size="small"
                                  disabled={!teams.length}
                                  onClick={() => toggleExpanded(tournament.id)}
                                  aria-expanded={expanded}
                                  aria-controls={`tournament-${tournament.id}-teams`}
                                  aria-label={`${expanded ? 'Hide' : 'View'} teams registered in ${tournament.name}`}
                                  endIcon={<ExpandMoreRounded sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease' }} />}
                                  sx={{ mt: 1.1, ml: -1 }}
                                >
                                  {teams.length ? `${expanded ? 'Hide' : 'View'} registered teams` : 'No teams registered'}
                                </Button>
                              </Box>
                            )}
                            disableTypography
                          />
                        </ListItem>

                        <Collapse in={expanded} timeout="auto" unmountOnExit>
                          <Box id={`tournament-${tournament.id}-teams`} sx={{ ml: { xs: 1.5, sm: 8.5 }, mr: 1, mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(11,143,140,.045)', border: '1px solid rgba(11,143,140,.10)' }}>
                            <Typography variant="overline" sx={{ display: 'block', mb: 0.75, color: 'primary.main', fontSize: 9, fontWeight: 850, letterSpacing: '.12em' }}>
                              Registered field · {teams.length}
                            </Typography>
                            <Stack direction="row" flexWrap="wrap" gap={0.75}>
                              {teams.map((team) => (
                                <Chip key={team} size="small" label={team}
                                  onDelete={isAuthenticated ? () => setPendingDrop({ tournament, team }) : undefined} />
                              ))}
                            </Stack>
                          </Box>
                        </Collapse>
                        {index < visibleTournaments.length - 1 && <Divider component="li" />}
                      </React.Fragment>
                    );
                  })}
                </List>
              ) : (
                <Box sx={{ pt: 3 }}>
                  <EmptyState compact icon={<SportsEsportsRounded />}
                    title={tournaments.length ? 'No matching tournaments' : 'No tournaments yet'}
                    description={tournaments.length ? 'Try another name, game, team, or status.' : 'Your first tournament will appear here after creation.'}
                    action={tournaments.length ? <Button onClick={() => { setQuery(''); setStatusFilter('All'); }}>Clear filters</Button> : null} />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Menu
        anchorEl={rowMenu?.anchor || null}
        open={Boolean(rowMenu)}
        onClose={closeRowMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => {
          setEditingTournament({ ...rowMenu.tournament });
          closeRowMenu();
        }}>
          <ListItemIcon><EditRounded fontSize="small" /></ListItemIcon>
          Edit tournament
        </MenuItem>
        <Divider />
        <MenuItem sx={{ color: 'error.main' }} onClick={() => {
          setPendingDelete(rowMenu.tournament);
          closeRowMenu();
        }}>
          <ListItemIcon><DeleteOutlineRounded fontSize="small" color="error" /></ListItemIcon>
          Delete tournament
        </MenuItem>
      </Menu>

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
