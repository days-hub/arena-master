import { render, screen } from '@testing-library/react';
import App from './App';
import { fetchCurrentUser, fetchTournamentsOverview } from './api/apiClient';

jest.mock('./api/apiClient', () => ({
  fetchCurrentUser: jest.fn(),
  fetchTournamentsOverview: jest.fn(),
}));

test('renders the tournament dashboard shell', async () => {
  fetchCurrentUser.mockRejectedValue({ response: { status: 401 } });
  fetchTournamentsOverview.mockResolvedValue({ data: [] });
  render(<App />);
  expect(await screen.findByText(/create your first tournament/i)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /arena master dashboard/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /new tournament/i })).toBeInTheDocument();
});
