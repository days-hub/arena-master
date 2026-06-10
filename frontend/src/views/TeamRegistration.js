import React, { useState, useEffect } from 'react';
import { Box, TextField, Select, MenuItem, FormControl, InputLabel, Button, Avatar, List, ListItem, ListItemText, ListItemAvatar, Checkbox } from '@mui/material';
import { registerTeam, fetchTournaments, createTeam, fetchTeams, addMemberToTeam, fetchDiscordMembers, deleteTeam, fetchTeamById, sendWebhookMessage } from '../api/apiClient';


const TeamRegistration = () => {
  const [teamNameForCreation, setTeamNameForCreation] = useState(''); // Separate state for team creation
  const [selectedTeamForRegistration, setSelectedTeamForRegistration] = useState(''); // Separate state for team selection for registration
  const [tournament, setTournament] = useState('');
  const [tournaments, setTournaments] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [discordMembers, setDiscordMembers] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      const tournamentsData = await fetchTournaments();
      const teamsData = await fetchTeams();
      const membersData = await fetchDiscordMembers();
      setTournaments(tournamentsData.data);
      setTeams(teamsData.data);
      setMembers(membersData.data);
      setDiscordMembers(membersData.data);
    };
    loadData();
  }, []);

  const handleCreateTeam = async () => {
    if (!teamNameForCreation.trim()) {
      alert('Please enter a team name.');
      return;
    }
    const newTeam = { name: teamNameForCreation, members: selectedMembers };
    const response = await createTeam(newTeam);
    alert('Team created successfully!');
    setTeams([...teams, response.data]);
    setTeamNameForCreation('');
    setSelectedMembers([]);
    await sendWebhookMessage(`Team "${teamNameForCreation}" has been created.`);
  };

  const handleRegisterTeam = async (event) => {
    event.preventDefault();
    if (!selectedTeamForRegistration.trim() || !tournament.trim()) {
      alert('Please select both a team and a tournament.');
      return;
    }
    await registerTeam(tournament, { team_name: selectedTeamForRegistration });
    alert('Team registered successfully!');
    await sendWebhookMessage(`Team "${selectedTeamForRegistration}" has been registered for tournament "${tournament}".`);
  };

  const handleAddMember = async (teamId, memberId) => {
    await addMemberToTeam(teamId, memberId);
    const team = await fetchTeamById(teamId);
    const member = discordMembers.find((m) => m.id === memberId);
    await sendWebhookMessage(`Member "${member.name}" has been added to team "${team.data.name}".`);
    alert('Member added successfully to the team!');
  };
  const handleDeleteTeam = async (teamId) => {
    try {
      await deleteTeam(teamId);
      setTeams(teams.filter((team) => team.id !== teamId));
      alert('Team deleted successfully!');
      await sendWebhookMessage(`Team with ID ${teamId} has been deleted.`);
    } catch (error) {
      console.error('Error deleting team:', error);
      alert('Failed to delete team. Please try again.');
    }
    
  };
  const handleTeamSelect = async (teamId) => {
    try {
      const response = await fetchTeamById(teamId);
      setSelectedTeam(response.data);
      
    } catch (error) {
      console.error('Error fetching team details:', error);
      alert('Failed to fetch team details. Please try again.');
    }
  };
  

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '400px', margin: '0 auto' }}>
        <h3>Create Team</h3>
        <TextField label="Team Name" variant="outlined" fullWidth value={teamNameForCreation} onChange={(e) => setTeamNameForCreation(e.target.value)} />
        <FormControl fullWidth>
          <InputLabel>Select Members</InputLabel>
          <Select multiple value={selectedMembers} onChange={(e) => setSelectedMembers(e.target.value)} renderValue={(selected) => selected.join(', ')} >
            {members.map((member) => (
              <MenuItem key={member.id} value={member.id}>
                <Checkbox checked={selectedMembers.indexOf(member.id) > -1} />
                {member.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="contained" color="primary" onClick={handleCreateTeam}>
          Create Team
        </Button>
      </Box>
      <form onSubmit={handleRegisterTeam}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '400px', margin: '0 auto', marginTop: '20px' }}>
          <FormControl fullWidth>
            <InputLabel>Team for Registration</InputLabel>
            <Select label="Team for Registration" value={selectedTeamForRegistration} onChange={(e) => setSelectedTeamForRegistration(e.target.value)} >
              {teams.map((team) => (
                <MenuItem key={team.id} value={team.name}>{team.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Tournament</InputLabel>
            <Select label="Tournament" value={tournament} onChange={(e) => setTournament(e.target.value)} >
              {tournaments.map((tournament) => (
                <MenuItem key={tournament.id} value={tournament.name}>{tournament.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button type="submit" variant="contained" color="primary" size="large">
            Register Team
          </Button>
        </Box>
      </form>
      <Box sx={{ mt: 4 }}>
        <h3>Teams</h3>
        <List>
          {teams.map((team) => (
            <ListItem key={team.id}>
            <ListItemAvatar>
                <Avatar 
                    src={team.avatar ? team.avatar : `/Images/game-icons/default_${Math.floor(Math.random() * 6) + 1}.png`} 
                    alt={team.name}  />
              </ListItemAvatar>
              <ListItemText primary={team.name} />
              <FormControl sx={{ minWidth: 140 }}>
                <InputLabel>Add Members</InputLabel>
                <Select
                  value=""
                  onChange={(e) => {
                    addMemberToTeam(team.id, e.target.value);
                    setSelectedTeam({ ...selectedTeam });
                  }}
                  sx={{ backgroundColor: 'primary', color: 'white' }}
                >
                  {discordMembers.map((member) => (
                    <MenuItem key={member.id} value={member.id}>
                      {member.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={() => handleTeamSelect(team.id)}
                sx={{ ml: 1 }}
              >
                View Members
              </Button>
              <Button
                variant="contained"
                color="error"
                size="small"
                onClick={() => handleDeleteTeam(team.id)}
                sx={{ ml: 1 }}
              >
                Delete
              </Button>
            </ListItem>
          ))}
        </List>
      </Box>
      {selectedTeam && (
        <Box sx={{ mt: 4 }}>
          <h4>Members of {selectedTeam.name}</h4>
          <List>
            {selectedTeam.members &&
              selectedTeam.members.map((memberId) => {
                const member = discordMembers.find((m) => m.id === memberId);
                return member ? (
                  <ListItem key={memberId}>
                    <ListItemAvatar>
                      <Avatar src={member.avatar} alt={member.name} />
                    </ListItemAvatar>
                    <ListItemText primary={member.name} />
                  </ListItem>
                ) : null;
              })}
          </List>
        </Box>
      )}
    </Box>
  );
};

export default TeamRegistration;