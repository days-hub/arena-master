import { act, fireEvent, render, screen } from '@testing-library/react';
import ResponsiveBracket from './ResponsiveBracket';
import { transformApiMatches } from '../tournamentUtils';

const REPLAY_STEP_MS = 380;

const participant = (name, score, isWinner = false) => ({
  id: name, name, resultText: score, isWinner, status: 'PLAYED',
});

// Alpha beat Bravo, then beat Delta in the final. Delta's opening win over Echo is the
// route that must dim while the champion path replays.
const decidedBracket = () => transformApiMatches([
  { id: 1, round_number: 1, state: 'DONE', winner: 'Alpha', participants: [participant('Alpha', 2, true), participant('Bravo', 0)] },
  { id: 2, round_number: 1, state: 'DONE', winner: 'Delta', participants: [participant('Delta', 2, true), participant('Echo', 1)] },
  { id: 3, round_number: 2, state: 'DONE', winner: 'Alpha', participants: [participant('Alpha', 3, true), participant('Delta', 1)] },
]);

const livePartialBracket = () => transformApiMatches([
  { id: 1, round_number: 1, state: 'DONE', winner: 'Alpha', participants: [participant('Alpha', 2, true), participant('Bravo', 0)] },
  { id: 2, round_number: 1, state: null, winner: null, participants: [participant('Delta', 0), participant('Echo', 0)] },
]);

const mockMedia = ({ desktop = true, reducedMotion = false } = {}) => {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : query.includes('min-width') && desktop,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
};

const shellFor = (accessibleName) => screen
  .getByRole('button', { name: accessibleName })
  .closest('.arena-match-shell');

const replayTrigger = () => document.querySelector('.arena-team-row--replay-trigger');
const countOf = (selector) => document.querySelectorAll(selector).length;

const renderChampionBracket = (props = {}) => render(
  <ResponsiveBracket
    matches={decidedBracket()}
    onMatchClick={() => {}}
    finalComplete
    championName="Alpha"
    {...props}
  />,
);

const step = () => act(() => { jest.advanceTimersByTime(REPLAY_STEP_MS); });

beforeEach(() => {
  jest.useFakeTimers();
  mockMedia();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test('replays the champion route chronologically and dims the other routes', () => {
  renderChampionBracket();

  const opener = shellFor('Round 1 - Match 1. Final');
  const otherRoute = shellFor('Round 1 - Match 2. Final');
  const final = shellFor('Final. Final');

  expect(opener).not.toHaveClass('arena-match-shell--replay-current');
  expect(countOf('.arena-bracket-connector--replay-dim')).toBe(0);

  fireEvent.mouseEnter(replayTrigger());

  // Step 1: the champion's earliest win lights up, everything off-route dims.
  expect(opener).toHaveClass('arena-match-shell--replay-current');
  expect(otherRoute).toHaveClass('arena-match-shell--replay-dim');
  expect(final).not.toHaveClass('arena-match-shell--replay-dim');
  expect(countOf('.arena-bracket-connector--replay-dim')).toBe(1);
  expect(countOf('.arena-bracket-connector--replay-current')).toBe(0);

  // Step 2: the connector into the next round draws.
  step();
  expect(opener).toHaveClass('arena-match-shell--replay-lit');
  expect(countOf('.arena-bracket-connector--replay-current')).toBe(1);
  expect(final).not.toHaveClass('arena-match-shell--replay-current');

  // Step 3: the final lands, and the whole route stays illuminated afterwards.
  step();
  expect(final).toHaveClass('arena-match-shell--replay-current');
  expect(opener).toHaveClass('arena-match-shell--replay-lit');
  expect(countOf('.arena-bracket-connector--replay-lit')).toBe(1);

  step();
  step();
  expect(final).toHaveClass('arena-match-shell--replay-current');
  expect(opener).toHaveClass('arena-match-shell--replay-lit');
  expect(otherRoute).toHaveClass('arena-match-shell--replay-dim');
});

test('restores the normal bracket when the pointer leaves the champion row', () => {
  renderChampionBracket();

  fireEvent.mouseEnter(replayTrigger());
  step();
  fireEvent.mouseLeave(replayTrigger());

  expect(countOf('[class*="arena-match-shell--replay-"]')).toBe(0);
  expect(countOf('[class*="arena-bracket-connector--replay-"]')).toBe(0);
});

test('survives rapid hover in and out without a stale timer resuming the replay', () => {
  renderChampionBracket();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    fireEvent.mouseEnter(replayTrigger());
    act(() => { jest.advanceTimersByTime(120); });
    fireEvent.mouseLeave(replayTrigger());
  }

  act(() => { jest.advanceTimersByTime(REPLAY_STEP_MS * 6); });
  expect(countOf('[class*="arena-match-shell--replay-"]')).toBe(0);

  // A later hover still starts a clean replay from the first step.
  fireEvent.mouseEnter(replayTrigger());
  expect(shellFor('Round 1 - Match 1. Final')).toHaveClass('arena-match-shell--replay-current');
  expect(shellFor('Final. Final')).not.toHaveClass('arena-match-shell--replay-current');
});

test('reveals the whole champion route immediately when reduced motion is preferred', () => {
  mockMedia({ reducedMotion: true });
  renderChampionBracket();

  fireEvent.mouseEnter(replayTrigger());

  expect(shellFor('Final. Final')).toHaveClass('arena-match-shell--replay-current');
  expect(shellFor('Round 1 - Match 1. Final')).toHaveClass('arena-match-shell--replay-lit');
  expect(shellFor('Round 1 - Match 2. Final')).toHaveClass('arena-match-shell--replay-dim');
  expect(countOf('.arena-bracket-connector--replay-lit')).toBe(1);
});

test('resets the replay when the bracket data changes', () => {
  const { rerender } = renderChampionBracket();

  fireEvent.mouseEnter(replayTrigger());
  expect(countOf('.arena-match-shell--replay-current')).toBe(1);

  rerender(
    <ResponsiveBracket matches={decidedBracket()} onMatchClick={() => {}} finalComplete championName="Alpha" />,
  );

  expect(countOf('[class*="arena-match-shell--replay-"]')).toBe(0);
});

test('offers no replay before a champion exists', () => {
  render(<ResponsiveBracket matches={livePartialBracket()} onMatchClick={() => {}} />);

  expect(replayTrigger()).toBeNull();
  expect(countOf('[class*="arena-match-shell--replay-"]')).toBe(0);
});

test('leaves the mobile bracket untouched', () => {
  mockMedia({ desktop: false });
  renderChampionBracket();

  expect(screen.getByRole('tablist', { name: /tournament rounds/i })).toBeInTheDocument();
  expect(document.querySelector('.arena-bracket-canvas')).toBeNull();
  expect(replayTrigger()).toBeNull();

  fireEvent.mouseEnter(screen.getAllByText('Alpha')[0]);
  expect(countOf('[class*="arena-match-shell--replay-"]')).toBe(0);
});

test('still records a click on a live match and ignores decided ones', () => {
  const onMatchClick = jest.fn();
  const { unmount } = render(
    <ResponsiveBracket matches={livePartialBracket()} onMatchClick={onMatchClick} />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Round 1 - Match 2. Live' }));
  expect(onMatchClick).toHaveBeenCalledTimes(1);
  expect(onMatchClick.mock.calls[0][0].dbMatchId).toBe(2);

  fireEvent.click(screen.getByRole('button', { name: 'Round 1 - Match 1. Final' }));
  expect(onMatchClick).toHaveBeenCalledTimes(1);
  unmount();
});

test('cancels the pending replay timer itself on unmount', () => {
  // The bracket already clears an unrelated effect timer on unmount, so asserting that
  // clearTimeout merely ran would pass even with the replay cleanup deleted. Track the
  // id of the replay's own timer and require that exact id to be cancelled.
  const setTimeoutSpy = jest.spyOn(window, 'setTimeout');
  const clearTimeoutSpy = jest.spyOn(window, 'clearTimeout');
  const { unmount } = renderChampionBracket();

  fireEvent.mouseEnter(replayTrigger());
  const replayTimerIds = setTimeoutSpy.mock.calls
    .map((call, index) => (call[1] === REPLAY_STEP_MS ? setTimeoutSpy.mock.results[index].value : null))
    .filter((id) => id !== null);
  expect(replayTimerIds).toHaveLength(1);

  const pendingDuringReplay = jest.getTimerCount();
  clearTimeoutSpy.mockClear();
  unmount();

  expect(clearTimeoutSpy).toHaveBeenCalledWith(replayTimerIds[0]);
  expect(jest.getTimerCount()).toBeLessThan(pendingDuringReplay);

  setTimeoutSpy.mockRestore();
  clearTimeoutSpy.mockRestore();
});
