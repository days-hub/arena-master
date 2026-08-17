import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardActionArea, CardContent, Checkbox,
  Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, Drawer, FormControl, Grid, IconButton, InputAdornment, InputLabel,
  MenuItem, Paper, Select, Snackbar, Stack, TextField, ToggleButton,
  ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import {
  AddRounded, ArrowForwardRounded, CloseRounded, DeleteOutlineRounded, EditRounded,
  EmojiEventsRounded, GroupAddRounded, Groups2Rounded, HowToRegRounded,
  LockOutlined, PersonAddAltRounded, PersonRemoveRounded, SearchRounded,
} from '@mui/icons-material';
import {
  addMemberToTeam, createTeam, deleteTeam, fetchDiscordMembers, fetchTeams,
  fetchTournaments, getApiErrorMessage, registerTeam, removeMemberFromTeam,
  updateTeamAvatar,
} from '../api/apiClient';
import { useAuth } from '../auth/AuthContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import GameIcon from '../components/GameIcon';

const teamInitials = (name = '') => name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';

const TeamSummaryCard = ({ team, memberCount, registrationCount, isMine, index, onOpen }) => (
  <Card className="arena-lift arena-stagger-in" sx={{ '--stagger-index': index, height: '100%' }}>
    <CardActionArea onClick={onOpen} aria-label={`Open ${team.name} roster`} sx={{ height: '100%', textAlign: 'left' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Stack direction="row" alignItems="flex-start" spacing={1.5}>
          <Avatar src={team.avatar_url || undefined} alt={team.name} sx={{ width: 48, height: 48, bgcolor: 'secondary.main', fontWeight: 850 }}>
            {teamInitials(team.name)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h3" noWrap>{team.name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>
              {memberCount} roster {memberCount === 1 ? 'member' : 'members'}
            </Typography>
          </Box>
          <ArrowForwardRounded sx={{ mt: 0.5, color: 'text.disabled', fontSize: 19 }} />
        </Stack>
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75} sx={{ mt: 2 }}>
          <Chip size="small" color={memberCount >= 2 ? 'success' : 'default'} label={memberCount >= 2 ? 'Ready' : 'Needs players'} />
          {isMine && <Chip size="small" color="primary" variant="outlined" label="Your team" />}
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 1.5, color: registrationCount ? 'primary.main' : 'text.secondary' }}>
          <EmojiEventsRounded sx={{ fontSize: 17 }} />
          <Typography variant="caption" sx={{ fontWeight: 750 }}>Entered in {registrationCount} event{registrationCount === 1 ? '' : 's'}</Typography>
        </Stack>
      </CardContent>
    </CardActionArea>
  </Card>
);

const EmptyTeamTile = ({ team, registrationCount, index, onOpen }) => (
  <Card className="arena-stagger-in" variant="outlined" sx={{ '--stagger-index': index, height: '100%', boxShadow: 'none' }}>
    <CardActionArea onClick={onOpen} aria-label={`Open ${team.name} roster`} sx={{ height: '100%', p: 1.5, textAlign: 'left' }}>
      <Stack direction="row" alignItems="center" spacing={1.25}>
        <Avatar src={team.avatar_url || undefined} alt={team.name} sx={{ width: 36, height: 36, bgcolor: 'secondary.main', fontSize: 12, fontWeight: 850 }}>
          {teamInitials(team.name)}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 800 }}>{team.name}</Typography>
          <Typography variant="caption" color="text.secondary">Empty roster · {registrationCount} event{registrationCount === 1 ? '' : 's'}</Typography>
        </Box>
        <ArrowForwardRounded sx={{ color: 'text.disabled', fontSize: 17 }} />
      </Stack>
    </CardActionArea>
  </Card>
);

const TeamRegistration = () => {
  const { user, isAuthenticated, isLoading: authLoading, signIn } = useAuth();
  const [teams, setTeams] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [members, setMembers] = useState([]);
  const [teamName, setTeamName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [registrationTeam, setRegistrationTeam] = useState('');
  const [registrationTournament, setRegistrationTournament] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [memberAction, setMemberAction] = useState('');
  const [editingAvatarTeam, setEditingAvatarTeam] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState('All');
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [teamResponse, tournamentResponse] = await Promise.all([fetchTeams(), fetchTournaments()]);
      setTeams(Array.isArray(teamResponse.data) ? teamResponse.data : []);
      setTournaments(Array.isArray(tournamentResponse.data) ? tournamentResponse.data : []);
      if (isAuthenticated) {
        try {
          const memberResponse = await fetchDiscordMembers();
          setMembers(Array.isArray(memberResponse.data) ? memberResponse.data : []);
        } catch (memberError) {
          console.error('Could not load Discord members:', memberError);
          setMembers([]);
        }
      } else setMembers([]);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Team data could not be loaded.'));
    } finally { setLoading(false); }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  const memberMap = useMemo(() => new Map(members.map((member) => [String(member.id), member])), [members]);
  const selectedTournament = tournaments.find((tournament) => tournament.name === registrationTournament);
  const tournamentRegistrations = useMemo(() => {
    const registrations = new Map();
    tournaments.forEach((tournament) => (tournament.teams || []).forEach((teamNameValue) => {
      if (!registrations.has(teamNameValue)) registrations.set(teamNameValue, []);
      registrations.get(teamNameValue).push(tournament);
    }));
    return registrations;
  }, [tournaments]);

  const directoryTeams = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...teams]
      .map((team) => {
        const memberIds = team.members || [];
        const memberNames = memberIds.map((id) => memberMap.get(String(id))?.name || '');
        const isMine = Boolean(user?.discord_id && memberIds.some((id) => String(id) === String(user.discord_id)));
        return {
          team,
          memberCount: memberIds.length,
          registrationCount: tournamentRegistrations.get(team.name)?.length || 0,
          isMine,
          memberNames,
        };
      })
      .filter(({ team, memberNames }) => !normalizedQuery
        || team.name.toLowerCase().includes(normalizedQuery)
        || memberNames.some((memberName) => memberName.toLowerCase().includes(normalizedQuery)))
      .filter(({ memberCount, isMine }) => {
        if (teamFilter === 'NeedsPlayers') return memberCount < 2;
        if (teamFilter === 'Ready') return memberCount >= 2;
        if (teamFilter === 'Mine') return isMine;
        return true;
      })
      .sort((a, b) => b.memberCount - a.memberCount || a.team.name.localeCompare(b.team.name));
  }, [memberMap, query, teamFilter, teams, tournamentRegistrations, user?.discord_id]);

  const rosteredTeams = directoryTeams.filter(({ memberCount }) => memberCount > 0);
  const emptyTeams = directoryTeams.filter(({ memberCount }) => memberCount === 0);
  const activeTeam = teams.find((team) => team.id === selectedTeamId) || null;
  const activeTeamMembers = activeTeam
    ? (activeTeam.members || []).map((id, memberIndex) => memberMap.get(String(id)) || { id, name: `Member ${memberIndex + 1}`, avatar: null })
    : [];
  const activeAvailableMembers = activeTeam
    ? members.filter((member) => !(activeTeam.members || []).some((id) => String(id) === String(member.id)))
    : [];
  const activeRegistrations = activeTeam ? tournamentRegistrations.get(activeTeam.name) || [] : [];
  const canEditActiveAvatar = Boolean(activeTeam && (user?.is_admin
    || (activeTeam.members || []).some((id) => String(id) === String(user?.discord_id))));

  const reloadTeams = async () => {
    const response = await fetchTeams();
    setTeams(Array.isArray(response.data) ? response.data : []);
  };

  const createNewTeam = async (event) => {
    event.preventDefault();
    if (!teamName.trim()) {
      setNotice({ severity: 'warning', text: 'Enter a name for the team.' });
      return;
    }
    setWorking(true);
    try {
      const response = await createTeam({ name: teamName.trim(), members: selectedMembers });
      setTeams((current) => [...current, response.data]);
      setTeamName('');
      setSelectedMembers([]);
      setNotice({ severity: 'success', text: 'Team created successfully.' });
    } catch (requestError) {
      setNotice({ severity: 'error', text: getApiErrorMessage(requestError, 'The team could not be created.') });
    } finally { setWorking(false); }
  };

  const registerSelectedTeam = async (event) => {
    event.preventDefault();
    if (!registrationTeam || !registrationTournament) {
      setNotice({ severity: 'warning', text: 'Choose both a team and a tournament.' });
      return;
    }
    setWorking(true);
    try {
      await registerTeam(registrationTournament, { team_name: registrationTeam });
      setTournaments((current) => current.map((tournament) => tournament.name === registrationTournament
        ? { ...tournament, teams: [...(tournament.teams || []), registrationTeam] }
        : tournament));
      setNotice({ severity: 'success', text: `${registrationTeam} is registered for ${registrationTournament}.` });
      setRegistrationTeam('');
    } catch (requestError) {
      setNotice({ severity: 'error', text: getApiErrorMessage(requestError, 'The team could not be registered.') });
    } finally { setWorking(false); }
  };

  const addMember = async (team, memberId) => {
    if (!memberId) return;
    try {
      await addMemberToTeam(team.id, memberId);
      await reloadTeams();
      setNotice({ severity: 'success', text: `${memberMap.get(String(memberId))?.name || 'Member'} added to ${team.name}.` });
    } catch (requestError) {
      setNotice({ severity: 'error', text: getApiErrorMessage(requestError, 'The member could not be added.') });
    }
  };

  const removeRosterMember = async (team, member) => {
    const actionKey = `${team.id}:${member.id}`;
    setMemberAction(actionKey);
    try {
      await removeMemberFromTeam(team.id, member.id);
      await reloadTeams();
      setNotice({ severity: 'success', text: `${member.name} removed from ${team.name}.` });
    } catch (requestError) {
      setNotice({ severity: 'error', text: getApiErrorMessage(requestError, 'The member could not be removed.') });
    } finally { setMemberAction(''); }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteTeam(target.id);
      setTeams((current) => current.filter((team) => team.id !== target.id));
      if (selectedTeamId === target.id) setSelectedTeamId(null);
      setNotice({ severity: 'success', text: `${target.name} was deleted.` });
    } catch (requestError) {
      setNotice({ severity: 'error', text: getApiErrorMessage(requestError, 'The team could not be deleted.') });
    }
  };

  const openAvatarEditor = (team) => {
    setEditingAvatarTeam(team);
    setAvatarUrl(team.avatar_url || '');
  };

  const saveAvatar = async (nextUrl = avatarUrl) => {
    if (!editingAvatarTeam) return;
    setAvatarSaving(true);
    try {
      const response = await updateTeamAvatar(editingAvatarTeam.id, nextUrl.trim());
      setTeams((current) => current.map((team) => team.id === editingAvatarTeam.id ? response.data : team));
      setEditingAvatarTeam(null);
      setAvatarUrl('');
      setNotice({
        severity: 'success',
        text: nextUrl.trim() ? `${editingAvatarTeam.name}'s icon was updated.` : `${editingAvatarTeam.name} now uses its latest member's avatar.`,
      });
    } catch (requestError) {
      setNotice({ severity: 'error', text: getApiErrorMessage(requestError, 'The team icon could not be updated.') });
    } finally { setAvatarSaving(false); }
  };

  return (
    <Box>
      <PageHeader eyebrow="Roster management" title="Teams and registration"
        description="Build team rosters from your Discord community, then enter them into an upcoming tournament." />

      {!isAuthenticated && (
        <Alert severity="info" icon={<LockOutlined />} sx={{ mb: 3 }} action={<Button color="inherit" size="small" onClick={signIn}>Sign in</Button>}>
          Sign in to create rosters, access Discord members, and register teams.
        </Alert>
      )}
      {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>} sx={{ mb: 3 }}>{error}</Alert>}

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card component="form" className="arena-lift" onSubmit={createNewTeam} sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
                <Box sx={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 2.5, bgcolor: 'rgba(11,143,140,.09)', color: 'primary.main' }}><GroupAddRounded /></Box>
                <Box><Typography variant="h2">Create a team</Typography><Typography variant="body2" color="text.secondary">Name the roster and choose its players.</Typography></Box>
              </Stack>
              <Stack spacing={2.25}>
                <TextField label="Team name" value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="e.g. Northern Lights" fullWidth required />
                <FormControl fullWidth disabled={!members.length}>
                  <InputLabel>Discord members</InputLabel>
                  <Select multiple label="Discord members" value={selectedMembers} onChange={(event) => setSelectedMembers(event.target.value)}
                    renderValue={(selected) => `${selected.length} member${selected.length === 1 ? '' : 's'} selected`}>
                    {members.map((member) => (
                      <MenuItem key={member.id} value={member.id}>
                        <Checkbox checked={selectedMembers.includes(member.id)} />
                        <Avatar src={member.avatar || undefined} sx={{ width: 28, height: 28, mr: 1 }}>{member.name?.[0]}</Avatar>
                        {member.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {isAuthenticated && !members.length && <Typography variant="caption" color="text.secondary">Discord members are unavailable. You can still create an empty team.</Typography>}
                <Button type="submit" variant="contained" startIcon={working ? <CircularProgress color="inherit" size={18} /> : <AddRounded />}
                  disabled={!isAuthenticated || working}>Create team</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card component="form" className="arena-lift" onSubmit={registerSelectedTeam} sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
                <Box sx={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 2.5, bgcolor: 'rgba(11,143,140,.09)', color: 'primary.main' }}><HowToRegRounded /></Box>
                <Box><Typography variant="h2">Enter a tournament</Typography><Typography variant="body2" color="text.secondary">Pair an existing team with a competition.</Typography></Box>
              </Stack>
              <Stack spacing={2.25}>
                <FormControl fullWidth><InputLabel>Team</InputLabel><Select label="Team" value={registrationTeam} onChange={(event) => setRegistrationTeam(event.target.value)}>
                  {teams.map((team) => <MenuItem key={team.id} value={team.name}>{team.name}</MenuItem>)}
                </Select></FormControl>
                <FormControl fullWidth><InputLabel>Tournament</InputLabel><Select label="Tournament" value={registrationTournament} onChange={(event) => setRegistrationTournament(event.target.value)}>
                  {tournaments.map((tournament) => (
                    <MenuItem key={tournament.id} value={tournament.name}>
                      <GameIcon game={tournament.game} size={26} sx={{ mr: 1.25, borderRadius: 1.25 }} />
                      {tournament.name} · {(tournament.teams || []).length} registered
                    </MenuItem>
                  ))}
                </Select></FormControl>
                {selectedTournament && (
                  <Box sx={{ p: 1.5, borderRadius: 2.5, bgcolor: 'rgba(11,143,140,.055)', border: '1px solid rgba(11,143,140,.1)' }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 800 }}>Already registered</Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.75}>
                      {(selectedTournament.teams || []).length
                        ? selectedTournament.teams.map((team) => <Chip key={team} size="small" label={team} />)
                        : <Typography variant="caption" color="text.secondary">No teams yet—this can be the first.</Typography>}
                    </Stack>
                  </Box>
                )}
                <Button type="submit" variant="contained" startIcon={<HowToRegRounded />} disabled={!isAuthenticated || working || !teams.length || !tournaments.length}>Register team</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2 }}>
        <Box><Typography variant="h2">Team directory</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>Browse teams here; open one roster when it needs attention. Ready teams have at least two members.</Typography></Box>
        <Chip label={`${directoryTeams.length} of ${teams.length} shown`} variant="outlined" />
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} sx={{ mb: 2.5 }}>
        <TextField
          size="small"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search teams or roster members"
          inputProps={{ 'aria-label': 'Search teams' }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }}
          sx={{ flex: 1 }}
        />
        <ToggleButtonGroup
          exclusive
          size="small"
          value={teamFilter}
          onChange={(_, value) => value && setTeamFilter(value)}
          aria-label="Team readiness"
          sx={{ maxWidth: '100%', overflowX: 'auto', flexShrink: 0 }}
        >
          <ToggleButton value="All">All</ToggleButton>
          <ToggleButton value="NeedsPlayers">Needs players</ToggleButton>
          <ToggleButton value="Ready">Ready</ToggleButton>
          <ToggleButton value="Mine" disabled={!user}>My teams</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {loading ? <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress size={30} /></Box> : directoryTeams.length ? (
        <Stack spacing={3}>
          {rosteredTeams.length > 0 && (
            <Grid container spacing={2}>
              {rosteredTeams.map(({ team, memberCount, registrationCount, isMine }, index) => (
                <Grid item xs={12} sm={6} lg={4} key={team.id}>
                  <TeamSummaryCard team={team} memberCount={memberCount} registrationCount={registrationCount}
                    isMine={isMine} index={index} onOpen={() => setSelectedTeamId(team.id)} />
                </Grid>
              ))}
            </Grid>
          )}

          {emptyTeams.length > 0 && (
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
                <Box>
                  <Typography variant="h3">Unrostered teams</Typography>
                  <Typography variant="caption" color="text.secondary">Compact entries waiting for their first player.</Typography>
                </Box>
                <Chip size="small" label={emptyTeams.length} />
              </Stack>
              <Paper variant="outlined" sx={{ p: 1.25, bgcolor: 'rgba(255,255,255,.52)' }}>
                <Grid container spacing={1}>
                  {emptyTeams.map(({ team, registrationCount }, index) => (
                    <Grid item xs={12} sm={6} lg={4} key={team.id}>
                      <EmptyTeamTile team={team} registrationCount={registrationCount} index={index}
                        onOpen={() => setSelectedTeamId(team.id)} />
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Box>
          )}
        </Stack>
      ) : teams.length ? (
        <EmptyState icon={<SearchRounded />} title="No matching teams" description="Try another name, member, or readiness filter."
          action={<Button onClick={() => { setQuery(''); setTeamFilter('All'); }}>Clear filters</Button>} />
      ) : <EmptyState icon={<Groups2Rounded />} title="No teams yet" description="Create the first roster above, then register it for a tournament." />}

      <Drawer
        anchor="right"
        open={Boolean(activeTeam)}
        onClose={() => setSelectedTeamId(null)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, bgcolor: 'background.default' } }}
      >
        {activeTeam && (
          <Box sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: { xs: 2.5, sm: 3 }, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Stack direction="row" spacing={1.75} alignItems="center" sx={{ minWidth: 0 }}>
                  <Avatar src={activeTeam.avatar_url || undefined} alt={activeTeam.name} sx={{ width: 64, height: 64, bgcolor: 'secondary.main', fontSize: 20, fontWeight: 850 }}>
                    {teamInitials(activeTeam.name)}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h2" noWrap>{activeTeam.name}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                      {activeTeamMembers.length} roster {activeTeamMembers.length === 1 ? 'member' : 'members'}
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
                      <Chip size="small" color={activeTeamMembers.length >= 2 ? 'success' : 'default'} label={activeTeamMembers.length >= 2 ? 'Ready' : 'Needs players'} />
                      <Chip size="small" variant="outlined" label={`Entered in ${activeRegistrations.length} event${activeRegistrations.length === 1 ? '' : 's'}`} />
                    </Stack>
                  </Box>
                </Stack>
                <IconButton aria-label="Close roster" onClick={() => setSelectedTeamId(null)}><CloseRounded /></IconButton>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ mt: 2.5 }}>
                {canEditActiveAvatar && (
                  <Button size="small" variant="outlined" startIcon={<EditRounded />} onClick={() => openAvatarEditor(activeTeam)}>
                    Edit icon
                  </Button>
                )}
                <Box sx={{ flexGrow: 1 }} />
                <Button size="small" color="error" startIcon={<DeleteOutlineRounded />} disabled={!isAuthenticated} onClick={() => setPendingDelete(activeTeam)}>
                  Delete team
                </Button>
              </Stack>
            </Box>

            <Stack spacing={3} sx={{ p: { xs: 2.5, sm: 3 } }}>
              <Box>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
                  <EmojiEventsRounded sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Typography variant="h3">Tournament entries</Typography>
                </Stack>
                {activeRegistrations.length ? (
                  <Stack direction="row" flexWrap="wrap" gap={0.75}>
                    {activeRegistrations.map((tournament) => (
                      <Chip key={tournament.id} avatar={<Avatar><GameIcon game={tournament.game} size={24} /></Avatar>}
                        label={tournament.name} variant="outlined" />
                    ))}
                  </Stack>
                ) : <Typography variant="body2" color="text.secondary">This team has not entered a tournament yet.</Typography>}
              </Box>

              <Divider />

              <Box>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Groups2Rounded sx={{ color: 'primary.main', fontSize: 21 }} />
                    <Typography variant="h3">Roster</Typography>
                  </Stack>
                  <Chip size="small" label={activeTeamMembers.length} />
                </Stack>

                {activeTeamMembers.length ? (
                  <Stack spacing={1}>
                    {activeTeamMembers.map((member) => (
                      <Paper key={member.id} variant="outlined" sx={{ p: 1.25 }}>
                        <Stack direction="row" alignItems="center" spacing={1.25}>
                          <Avatar src={member.avatar || undefined} alt={member.name} sx={{ width: 38, height: 38 }}>{member.name?.[0]}</Avatar>
                          <Typography variant="body2" noWrap sx={{ flex: 1, fontWeight: 750 }}>{member.name}</Typography>
                          <Tooltip title={`Remove ${member.name}`}>
                            <span>
                              <IconButton size="small" color="error" disabled={!isAuthenticated || memberAction === `${activeTeam.id}:${member.id}`}
                                aria-label={`Remove ${member.name} from ${activeTeam.name}`} onClick={() => removeRosterMember(activeTeam, member)}>
                                {memberAction === `${activeTeam.id}:${member.id}` ? <CircularProgress size={17} /> : <PersonRemoveRounded fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: 'rgba(255,255,255,.55)' }}>
                    <PersonAddAltRounded sx={{ color: 'text.disabled', mb: 0.5 }} />
                    <Typography variant="body2" color="text.secondary">No linked Discord members yet.</Typography>
                  </Paper>
                )}

                <FormControl fullWidth size="small" sx={{ mt: 2 }} disabled={!isAuthenticated || !activeAvailableMembers.length}>
                  <InputLabel>Add member</InputLabel>
                  <Select label="Add member" value="" onChange={(event) => addMember(activeTeam, event.target.value)}
                    startAdornment={<PersonAddAltRounded sx={{ mr: 1, color: 'text.secondary', fontSize: 19 }} />}>
                    {activeAvailableMembers.map((member) => (
                      <MenuItem key={member.id} value={member.id}>
                        <Avatar src={member.avatar || undefined} sx={{ width: 26, height: 26, mr: 1 }}>{member.name?.[0]}</Avatar>
                        {member.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {isAuthenticated && !activeAvailableMembers.length && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                    Every available Discord member is already on this roster.
                  </Typography>
                )}
              </Box>
            </Stack>
          </Box>
        )}
      </Drawer>

      <Dialog open={!!pendingDelete} onClose={() => setPendingDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete team?</DialogTitle>
        <DialogContent><Typography color="text.secondary">This removes <strong>{pendingDelete?.name}</strong> from the reusable team directory and drops it from active tournaments. Any unresolved match is forfeited to its opponent.</Typography></DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1 }}><Button onClick={() => setPendingDelete(null)}>Cancel</Button><Button variant="contained" color="error" onClick={confirmDelete}>Delete team</Button></DialogActions>
      </Dialog>

      <Dialog open={!!editingAvatarTeam} onClose={() => !avatarSaving && setEditingAvatarTeam(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit {editingAvatarTeam?.name} icon</DialogTitle>
        <DialogContent>
          <Stack spacing={2.25} sx={{ pt: 0.75 }}>
            <Avatar src={avatarUrl || editingAvatarTeam?.avatar_url || undefined} sx={{ width: 76, height: 76, mx: 'auto', bgcolor: 'secondary.main', fontSize: 22, fontWeight: 800 }}>
              {editingAvatarTeam?.name?.slice(0, 2).toUpperCase()}
            </Avatar>
            <TextField
              autoFocus
              fullWidth
              label="Image URL"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://example.com/team-icon.png"
              helperText="Use an HTTPS image URL, or reset to automatically use the latest roster member's Discord avatar."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1, flexWrap: 'wrap' }}>
          <Button disabled={avatarSaving} onClick={() => saveAvatar('')}>Use latest member</Button>
          <Box sx={{ flexGrow: 1 }} />
          <Button disabled={avatarSaving} onClick={() => setEditingAvatarTeam(null)}>Cancel</Button>
          <Button variant="contained" disabled={avatarSaving || !avatarUrl.trim()} onClick={() => saveAvatar()}>
            {avatarSaving ? 'Saving…' : 'Save icon'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!notice} autoHideDuration={4500} onClose={() => setNotice(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {notice ? <Alert severity={notice.severity} variant="filled" onClose={() => setNotice(null)}>{notice.text}</Alert> : <span />}
      </Snackbar>
    </Box>
  );
};

export default TeamRegistration;
