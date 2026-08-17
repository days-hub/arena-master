import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import {
  fetchCareerProfile, fetchCurrentUser, fetchDiscordMembers, fetchGames, fetchRiotStatus, fetchStandings, fetchStandingsOptions, fetchTeams, fetchTournamentById,
  fetchTournaments, fetchTournamentsOverview,
} from './api/apiClient';

jest.mock('./api/apiClient', () => ({
  fetchCareerProfile: jest.fn(),
  fetchCurrentUser: jest.fn(),
  fetchDiscordMembers: jest.fn(),
  fetchGames: jest.fn(),
  fetchRiotStatus: jest.fn(),
  fetchStandings: jest.fn(),
  fetchStandingsOptions: jest.fn(),
  fetchTeams: jest.fn(),
  fetchTournamentById: jest.fn(),
  fetchTournaments: jest.fn(),
  fetchTournamentsOverview: jest.fn(),
}));

beforeEach(() => {
  window.history.pushState({}, '', '/');
  jest.clearAllMocks();
  fetchTeams.mockResolvedValue({ data: [] });
});

test('renders the tournament dashboard shell', async () => {
  fetchCurrentUser.mockRejectedValue({ response: { status: 401 } });
  fetchTournamentsOverview.mockResolvedValue({ data: [] });
  render(<App />);
  expect(await screen.findByText(/create your first tournament/i)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /arena master dashboard/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /new tournament/i })).toBeInTheDocument();
});

test('selects tournament summaries and opens the registration lens', async () => {
  fetchCurrentUser.mockRejectedValue({ response: { status: 401 } });
  fetchTournamentsOverview.mockResolvedValue({ data: [
    { id: 1, name: 'Live Cup', game: 'Valorant', format: 'bo3', status: 'Ongoing', team_count: 2, matches_total: 1, matches_decided: 0, current_round: 1, total_rounds: 1, champion: null },
    { id: 2, name: 'Open Qualifier', game: 'Overwatch', format: 'bo3', status: 'Created', team_count: 3, matches_total: 0, matches_decided: 0, current_round: 0, total_rounds: 2, champion: null },
    { id: 3, name: 'Finals', game: 'Overwatch', format: 'bo5', status: 'Completed', team_count: 0, matches_total: 1, matches_decided: 1, current_round: 1, total_rounds: 1, champion: 'Alpha' },
  ] });
  fetchTeams.mockResolvedValue({ data: [
    { id: 1, name: 'Alpha', avatar_url: 'https://cdn.example.com/alpha.png' },
    { id: 2, name: 'Bravo', avatar_url: 'https://cdn.example.com/bravo.png' },
  ] });
  fetchTournamentById.mockImplementation((id) => Promise.resolve({ data: id === 1
    ? { id: 1, name: 'Live Cup', game: 'Valorant', status: 'Ongoing', teams: ['Alpha', 'Bravo'], matches: [{ id: 10, round_number: 1, winner: '', participants: [{ name: 'Alpha', resultText: 0 }, { name: 'Bravo', resultText: 0 }] }] }
    : id === 2
      ? { id: 2, name: 'Open Qualifier', game: 'Overwatch', status: 'Created', teams: ['Comets', 'Foxes', 'Owls'], matches: [] }
      : { id: 3, name: 'Finals', game: 'Overwatch', status: 'Completed', teams: ['Alpha', 'Bravo'], matches: [{ id: 11, round_number: 1, winner: 'Alpha', participants: [{ name: 'Alpha', resultText: 3, isWinner: true }, { name: 'Bravo', resultText: 1, isWinner: false }] }] } }));

  render(<App />);

  expect(await screen.findByRole('heading', { name: /live cup is live/i })).toBeInTheDocument();
  expect(await screen.findByText(/on deck.*match 1/i)).toBeInTheDocument();
  expect(await screen.findByRole('img', { name: 'Alpha' })).toHaveAttribute('src', 'https://cdn.example.com/alpha.png');

  fireEvent.click(screen.getByRole('button', { name: /show open qualifier summary/i }));
  expect(await screen.findByRole('heading', { name: /open qualifier is assembling/i })).toBeInTheDocument();
  expect(await screen.findByText('Comets')).toBeInTheDocument();
  expect(window.location.search).toContain('tournament=2');

  fireEvent.click(screen.getByRole('button', { name: /show finals summary/i }));
  expect(await screen.findByRole('heading', { name: /alpha conquered finals/i })).toBeInTheDocument();
  expect(await screen.findByText('1 match decided across 1 round.')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /^show .* summary$/i })[0]).toHaveAccessibleName('Show Finals summary');

  fireEvent.click(screen.getByRole('button', { name: /registered entries/i }));
  expect(await screen.findByRole('heading', { name: /5 registered entries/i })).toBeInTheDocument();
  expect(window.location.search).toContain('view=teams');
});

test('shows competitive standings personality and applies scope filters', async () => {
  window.history.pushState({}, '', '/standings');
  fetchCurrentUser.mockRejectedValue({ response: { status: 401 } });
  const standingRows = [
    { team: 'Alpha', titles: 2, match_wins: 4, match_losses: 1, game_wins: 9, game_losses: 3, streak: 'W3', recent_form: ['L', 'W', 'W', 'W'], biggest_upset: 'Beat #1 Bravo as the #4 seed', biggest_upset_seed_gap: 3 },
    { team: 'Bravo', titles: 0, match_wins: 2, match_losses: 2, game_wins: 5, game_losses: 5, streak: 'L1', recent_form: ['W', 'L'], biggest_upset: null, biggest_upset_seed_gap: 0 },
  ];
  fetchStandings.mockImplementation((scope) => Promise.resolve({ data: scope?.game
    ? standingRows.map((row) => row.team === 'Alpha' ? { ...row, team: 'Scoped Alpha' } : row)
    : standingRows }));
  fetchStandingsOptions.mockResolvedValue({ data: {
    games: ['Valorant'],
    tournaments: [{ id: 10, name: 'Summer Cup', game: 'Valorant', season: 2026 }],
    seasons: [2026],
  } });
  fetchTeams.mockResolvedValue({ data: [
    { id: 1, name: 'Alpha', avatar_url: 'https://cdn.example.com/alpha.png' },
  ] });

  render(<App />);

  expect(await screen.findByRole('heading', { name: /all-time standings/i })).toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: /arena podium/i })).toBeInTheDocument();
  expect((await screen.findAllByRole('img', { name: 'Alpha' })).every((image) => image.getAttribute('src') === 'https://cdn.example.com/alpha.png')).toBe(true);
  expect(screen.getAllByText('W3').length).toBeGreaterThan(0);
  expect(screen.getByText('Beat #1 Bravo as the #4 seed')).toBeInTheDocument();
  expect(screen.getByLabelText('Tournament')).toBeInTheDocument();
  expect(screen.getByLabelText('Season')).toBeInTheDocument();

  fireEvent.mouseDown(screen.getByLabelText('Game'));
  fireEvent.click(await screen.findByRole('option', { name: 'Valorant' }));
  await waitFor(() => expect(fetchStandings).toHaveBeenLastCalledWith(expect.objectContaining({ game: 'Valorant' })));
  expect((await screen.findAllByText('Scoped Alpha')).length).toBeGreaterThan(0);
});

test('renders the signed-in player career profile from real activity', async () => {
  window.history.pushState({}, '', '/profile');
  fetchCurrentUser.mockResolvedValue({ data: {
    username: 'DaeKreX', discord_id: '123', avatar_url: 'https://cdn.example.com/player.png', is_admin: true,
  } });
  fetchCareerProfile.mockResolvedValue({ data: {
    discord_id: '123', username: 'DaeKreX', avatar_url: 'https://cdn.example.com/player.png',
    guild_role: 'Administrator', member_since: '2025-03-01T12:00:00Z',
    teams: [{ id: 1, name: 'Northern Lights', avatar_url: 'https://cdn.example.com/nl.png', tournament_appearances: 3, titles: 1 }],
    tournament_appearances: 3, titles: 1, match_wins: 4, match_losses: 1,
    game_wins: 10, game_losses: 4, games_played: ['Valorant', 'Overwatch'],
    recent_matches: [{ id: 44, tournament_id: 8, tournament_name: 'VCT Summer', game: 'Valorant', round_number: 2, team: 'Northern Lights', opponent: 'Turbo Geese', team_score: 3, opponent_score: 1, result: 'W', played_at: null }],
    achievements: [
      { id: 'champion', name: 'Champion', description: 'Claim a tournament title.', earned: true, progress: 1, goal: 1 },
      { id: 'on_a_roll', name: 'On a roll', description: 'Win three matches in a row.', earned: false, progress: 2, goal: 3 },
    ],
  } });
  fetchRiotStatus.mockResolvedValue({ data: { enabled: false } });

  render(<App />);

  expect(await screen.findByRole('heading', { name: /player profile/i })).toBeInTheDocument();
  expect(await screen.findByRole('heading', { name: /your teams/i })).toBeInTheDocument();
  expect(await screen.findByText('Northern Lights')).toBeInTheDocument();
  expect(screen.getByText('VCT Summer · Valorant · Round 2')).toBeInTheDocument();
  expect(screen.getByText('Champion')).toBeInTheDocument();
  expect(screen.getByText('1/2 earned')).toBeInTheDocument();
  expect(screen.getByText('Connected game accounts')).toBeInTheDocument();
  expect(screen.getByText('Administrator · Since Mar 2025')).toBeInTheDocument();
});

test('filters, searches, expands, and opens actions in tournament management', async () => {
  window.history.pushState({}, '', '/create-tournament');
  fetchCurrentUser.mockResolvedValue({ data: { username: 'Admin', is_admin: true, discord_id: '1' } });
  fetchGames.mockResolvedValue({ data: ['Valorant', 'Overwatch'] });
  fetchTournaments.mockResolvedValue({ data: [
    { id: 1, name: 'Live Cup', game: 'Valorant', format: 'bo3', status: 'Ongoing', teams: ['Alpha', 'Bravo'] },
    { id: 2, name: 'Open Qualifier', game: 'Overwatch', format: 'bo3', status: 'Created', teams: ['Comets'] },
    { id: 3, name: 'Finals', game: 'Valorant', format: 'bo5', status: 'Completed', teams: ['Alpha', 'Bravo'] },
  ] });
  fetchTournamentsOverview.mockResolvedValue({ data: [
    { id: 1, status: 'Ongoing', team_count: 2, matches_total: 4, matches_decided: 2, current_round: 1, total_rounds: 2, champion: null },
    { id: 2, status: 'Created', team_count: 1, matches_total: 0, matches_decided: 0, current_round: 0, total_rounds: 1, champion: null },
    { id: 3, status: 'Completed', team_count: 2, matches_total: 1, matches_decided: 1, current_round: 1, total_rounds: 1, champion: 'Alpha' },
  ] });

  render(<App />);

  expect(await screen.findByRole('heading', { name: /build your next competition/i })).toBeInTheDocument();
  expect(await screen.findByText('Champion: Alpha')).toBeInTheDocument();
  expect(screen.getByText('50%')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Created' }));
  expect(screen.getByText('Open Qualifier')).toBeInTheDocument();
  expect(screen.queryByText('Live Cup')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'All' }));
  fireEvent.change(screen.getByLabelText('Search tournaments'), { target: { value: 'Alpha' } });
  expect(screen.getByText('Live Cup')).toBeInTheDocument();
  expect(screen.getByText('Finals')).toBeInTheDocument();
  expect(screen.queryByText('Open Qualifier')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'View teams registered in Live Cup' }));
  expect(screen.getByText('Registered field · 2')).toBeInTheDocument();
  expect(screen.getAllByText('Alpha').length).toBeGreaterThan(0);

  expect(screen.queryByRole('menuitem', { name: /delete tournament/i })).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: 'Actions for Live Cup' }));
  expect(screen.getByRole('menuitem', { name: /edit tournament/i })).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: /delete tournament/i })).toBeInTheDocument();
});

test('filters the team directory and opens focused roster management', async () => {
  window.history.pushState({}, '', '/register-team');
  fetchCurrentUser.mockResolvedValue({ data: { username: 'Admin', is_admin: true, discord_id: '1' } });
  fetchTeams.mockResolvedValue({ data: [
    { id: 1, name: 'Alpha', members: ['1', '2'], avatar_url: 'https://cdn.example.com/alpha.png' },
    { id: 2, name: 'Solo Crew', members: ['3'], avatar_url: null },
    { id: 3, name: 'Empty Club', members: [], avatar_url: null },
  ] });
  fetchTournaments.mockResolvedValue({ data: [
    { id: 10, name: 'Summer Cup', game: 'Valorant', teams: ['Alpha'] },
    { id: 11, name: 'Night Clash', game: 'Overwatch', teams: ['Alpha', 'Solo Crew'] },
  ] });
  fetchDiscordMembers.mockResolvedValue({ data: [
    { id: '1', name: 'Admin', avatar: null },
    { id: '2', name: 'Ace', avatar: null },
    { id: '3', name: 'Rook', avatar: null },
  ] });

  render(<App />);

  expect(await screen.findByRole('heading', { name: /teams and registration/i })).toBeInTheDocument();
  expect(await screen.findByText('Entered in 2 events')).toBeInTheDocument();
  expect(screen.getByText('1 roster member')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Unrostered teams' })).toBeInTheDocument();
  expect(screen.getByText(/empty roster · 0 events/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Ready' }));
  expect(screen.getByRole('button', { name: 'Open Alpha roster' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Open Solo Crew roster' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'My teams' }));
  expect(screen.getByRole('button', { name: 'Open Alpha roster' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Open Solo Crew roster' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'All' }));
  fireEvent.change(screen.getByLabelText('Search teams'), { target: { value: 'Rook' } });
  expect(screen.getByRole('button', { name: 'Open Solo Crew roster' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Open Alpha roster' })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Search teams'), { target: { value: 'Alpha' } });
  fireEvent.click(screen.getByRole('button', { name: 'Open Alpha roster' }));
  expect(await screen.findByRole('heading', { name: 'Tournament entries' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Roster' })).toBeInTheDocument();
  expect(screen.getByText('Summer Cup')).toBeInTheDocument();
  expect(screen.getByText('Night Clash')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /edit icon/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /delete team/i })).toBeInTheDocument();
});
