import axios from 'axios';

export const API_ORIGIN = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export const getApiErrorMessage = (error, fallback = 'Something went wrong. Please try again.') =>
  error?.response?.data?.detail || error?.response?.data?.message || fallback;

export const getDiscordLoginUrl = () => `${API_ORIGIN}/oauth2/authorization/discord`;
export const fetchCurrentUser = () => api.get('/me');
export const logout = () => api.post('/logout');
export const createTournament = (data) => api.post('/tournaments', data);
export const updateTournament = (id, data) => api.put(`/tournaments/${id}`, data);
export const registerTeam = (name, data) => api.post(`/tournaments/${encodeURIComponent(name)}/register`, data);
export const unregisterTeam = (id, teamName) => api.delete(`/tournaments/${id}/teams/${encodeURIComponent(teamName)}`);
export const recordMatchResult = (name, data) => api.post(`/tournaments/${encodeURIComponent(name)}/record_match_result`, data);
export const recordSubmatchResult = (name, data) => api.post(`/tournaments/${encodeURIComponent(name)}/record_submatch_result`, data);
export const fetchTournaments = () => api.get('/tournaments');
export const fetchTournamentsOverview = () => api.get('/tournaments/overview');
export const fetchTournamentByName = (name) => api.get(`/tournaments/by_name/${encodeURIComponent(name)}`);
export const deleteTournament = (id) => api.delete(`/tournaments/${id}`);
export const generateAndListMatches = (name, force = false) =>
  api.post(`/tournaments/${encodeURIComponent(name)}/generate_and_list_matches`, null, {
    params: force ? { force: true } : {},
  });
export const fetchGames = () => api.get('/games');
export const createTeam = (data) => api.post('/teams', data);
export const fetchTeams = () => api.get('/teams');
export const fetchTeamById = (id) => api.get(`/teams/${id}`);
export const fetchTeamByName = (name) => api.get(`/teams/by_name/${encodeURIComponent(name)}`);
export const fetchTeamRoster = (name) => api.get(`/teams/by_name/${encodeURIComponent(name)}/members`);
export const updateTeam = (id, data) => api.put(`/teams/${id}`, data);
export const updateTeamAvatar = (id, avatarUrl) => api.put(`/teams/${id}/avatar`, { avatar_url: avatarUrl });
export const deleteTeam = (id) => api.delete(`/teams/${id}`);
export const addMemberToTeam = (teamId, memberId) => api.post('/teams/add_member', { team_id: teamId, member_id: memberId });
export const removeMemberFromTeam = (teamId, memberId) => api.delete(`/teams/${teamId}/members/${memberId}`);
export const fetchDiscordMembers = () => api.get('/discord/members');
export const fetchStandings = () => api.get('/standings');

export default api;
