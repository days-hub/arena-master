import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Checkbox,
  Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControl, Grid, IconButton, InputLabel, MenuItem, Select,
  Snackbar, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  AddRounded, DeleteOutlineRounded, GroupAddRounded, Groups2Rounded,
  EditRounded, HowToRegRounded, LockOutlined, PersonAddAltRounded, PersonRemoveRounded,
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

const TeamRegistration = () => {
  const { user, isAuthenticated, signIn } = useAuth();
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

  useEffect(() => { load(); }, [load]);

  const memberMap = useMemo(() => new Map(members.map((member) => [String(member.id), member])), [members]);
  const selectedTournament = tournaments.find((tournament) => tournament.name === registrationTournament);

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
        <Box><Typography variant="h2">Team directory</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>Reusable rosters available to every tournament.</Typography></Box>
        <Chip label={`${teams.length} team${teams.length === 1 ? '' : 's'}`} variant="outlined" />
      </Stack>

      {loading ? <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress size={30} /></Box> : teams.length ? (
        <Grid container spacing={2}>
          {teams.map((team, index) => {
            const teamMembers = (team.members || []).map((id, memberIndex) => memberMap.get(String(id)) || {
              id, name: `Member ${memberIndex + 1}`, avatar: null,
            });
            const availableMembers = members.filter((member) => !(team.members || []).some((id) => String(id) === String(member.id)));
            const canEditAvatar = Boolean(user?.is_admin || (team.members || []).some((id) => String(id) === String(user?.discord_id)));
            return (
              <Grid item xs={12} sm={6} lg={4} key={team.id}>
                <Card className="arena-lift arena-stagger-in" sx={{ '--stagger-index': index, height: '100%' }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                        <Box sx={{ position: 'relative', flexShrink: 0 }}>
                          <Avatar src={team.avatar_url || undefined} sx={{ width: 44, height: 44, bgcolor: 'secondary.main', fontWeight: 800 }}>
                            {team.name?.slice(0, 2).toUpperCase()}
                          </Avatar>
                          {canEditAvatar && (
                            <Tooltip title="Edit team icon">
                              <IconButton
                                aria-label={`Edit ${team.name} icon`}
                                size="small"
                                onClick={() => openAvatarEditor(team)}
                                sx={{
                                  position: 'absolute', right: -7, bottom: -7, width: 24, height: 24,
                                  bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
                                  boxShadow: 1, '&:hover': { bgcolor: 'background.paper', color: 'primary.main' },
                                }}
                              >
                                <EditRounded sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                        <Box sx={{ minWidth: 0 }}><Typography variant="h3" noWrap>{team.name}</Typography><Typography variant="body2" color="text.secondary">{(team.members || []).length} roster members</Typography></Box>
                      </Stack>
                      <Tooltip title="Delete team"><span><IconButton size="small" color="error" disabled={!isAuthenticated} onClick={() => setPendingDelete(team)}><DeleteOutlineRounded fontSize="small" /></IconButton></span></Tooltip>
                    </Stack>
                    <Divider sx={{ my: 2 }} />
                    {teamMembers.length ? (
                      <Stack direction="row" flexWrap="wrap" gap={0.75}>
                        {teamMembers.map((member) => (
                          <Chip
                            key={member.id}
                            size="small"
                            avatar={<Avatar src={member.avatar || undefined}>{member.name?.[0]}</Avatar>}
                            label={member.name}
                            disabled={memberAction === `${team.id}:${member.id}`}
                            onDelete={isAuthenticated ? () => removeRosterMember(team, member) : undefined}
                            deleteIcon={<PersonRemoveRounded />}
                            sx={{ maxWidth: '100%' }}
                          />
                        ))}
                      </Stack>
                    ) : <Typography variant="body2" color="text.secondary">No linked Discord members yet.</Typography>}
                    <FormControl fullWidth size="small" sx={{ mt: 2 }} disabled={!isAuthenticated || !availableMembers.length}>
                      <InputLabel>Add member</InputLabel>
                      <Select label="Add member" value="" onChange={(event) => addMember(team, event.target.value)} startAdornment={<PersonAddAltRounded sx={{ mr: 1, color: 'text.secondary', fontSize: 19 }} />}>
                        {availableMembers.map((member) => <MenuItem key={member.id} value={member.id}>{member.name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      ) : <EmptyState icon={<Groups2Rounded />} title="No teams yet" description="Create the first roster above, then register it for a tournament." />}

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
