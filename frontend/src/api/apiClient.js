import axios from 'axios';

const BASE_URL = 'http://localhost:8000/api'; // Adjust according to your setup

export const createTournament = async (tournamentData) => {
  return axios.post(`${BASE_URL}/tournaments`, tournamentData);
};

export const registerTeam = async (tournamentName, teamData) => {
  return axios.post(`${BASE_URL}/tournaments/${encodeURIComponent(tournamentName)}/register`, teamData);
};

export const recordMatchResult = async (tournamentName, matchData) => {
  return axios.post(`${BASE_URL}/tournaments/${encodeURIComponent(tournamentName)}/record_match_result`, matchData);
};

export const fetchTournaments = async () => {
  return axios.get(`${BASE_URL}/tournaments`);
};

export const fetchTournamentByName = async (tournamentName) => {
  return axios.get(`${BASE_URL}/tournaments/by_name/${encodeURIComponent(tournamentName)}`);
};

export const createTeam = async (teamData) => {
  return axios.post(`${BASE_URL}/teams`, teamData);
};

export const fetchTeams = async () => {
  return axios.get(`${BASE_URL}/teams`);
};

export const addMemberToTeam = async (teamId, memberId) => {
  return axios.post(`${BASE_URL}/teams/add_member`, { team_id: teamId, member_id: memberId });
};

export const deleteTeam = async (teamId) => {
  return axios.delete(`${BASE_URL}/teams/${teamId}`);
};
export const deleteTournament = async (tournamentId) => {
  return axios.delete(`${BASE_URL}/tournaments/${tournamentId}`);
};
export const updateTeam = async (teamId, teamData) => {
  return axios.put(`${BASE_URL}/teams/${teamId}`, teamData);
};

export const fetchTeamById = async (teamId) => {
  return axios.get(`${BASE_URL}/teams/${teamId}`);
};
  
export const fetchTeamByName = async (teamName) => {
    return axios.get(`${BASE_URL}/teams/by_name/${encodeURIComponent(teamName)}`);
};
  
export const generateAndListMatches = async (tournamentName, force = false) => {
    return axios.post(`${BASE_URL}/tournaments/${encodeURIComponent(tournamentName)}/generate_and_list_matches`, null, {
      params: force ? { force: true } : {},
    });
};
  
export const recordSubmatchResult = async (tournamentName, submatchData) => {
    return axios.post(`${BASE_URL}/tournaments/${encodeURIComponent(tournamentName)}/record_submatch_result`, submatchData);
};
export const fetchDiscordMembers = async () => {
  // Replace the URL with your actual endpoint for fetching Discord members
  return axios.get(`${BASE_URL}/discord/members`);
};
export const sendWebhookMessage = async (message) => {
  // Discord notifications are best-effort: a failed or unconfigured webhook should
  // never break the user action that triggered it.
  try {
    return await axios.post(`${BASE_URL}/notify-discord`, { message });
  } catch (error) {
    console.error('Failed to send Discord notification:', error);
    return null;
  }
};

// You might need to adjust these functions to fit the exact data structure you're using in your application.

export const fetchTournamentsOverview = async () => {
  return axios.get(`${BASE_URL}/tournaments/overview`);
};

export const fetchStandings = async () => {
  return axios.get(`${BASE_URL}/standings`);
};
