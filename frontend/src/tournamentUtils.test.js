import { buildChampionPath, transformApiMatches } from './tournamentUtils';

const participant = (name, score = 0, isWinner = false) => ({
  id: name,
  name,
  resultText: score,
  isWinner,
  status: 'PLAYED',
});

test('moves a decided team into its future-round placeholder', () => {
  const bracket = transformApiMatches([
    {
      id: 11,
      round_number: 1,
      state: 'DONE',
      winner: 'Northern Lights',
      participants: [participant('Northern Lights', 2, true), participant('Solar Flare', 0)],
    },
    {
      id: 12,
      round_number: 1,
      state: null,
      winner: null,
      participants: [participant('Kraken'), participant('Frostbite')],
    },
  ]);

  const final = bracket.find((match) => match.id === 'r2-0');
  expect(final.dbMatchId).toBeNull();
  expect(final.participants[0].name).toBe('Northern Lights');
  expect(final.participants[0].status).toBe('ADVANCED');
  expect(final.participants[1].name).toBe('TBD');
});

test('preserves the forfeit state for the custom match renderer', () => {
  const bracket = transformApiMatches([
    {
      id: 21,
      round_number: 1,
      state: 'FORFEIT',
      winner: 'Kraken',
      participants: [participant('Kraken', 2, true), participant('Dropped Team', 0)],
    },
  ]);

  expect(bracket[0].state).toBe('FORFEIT');
  expect(bracket[0].participants.find((entry) => entry.isWinner)?.name).toBe('Kraken');
});

const node = (id, nextMatchId, winner, loser, extra = {}) => ({
  id,
  nextMatchId,
  dbMatchId: extra.dbMatchId ?? 1,
  state: extra.state || (winner ? 'DONE' : 'SCHEDULED'),
  participants: [
    { name: winner || 'TBD', isWinner: Boolean(winner), resultText: winner ? 2 : null, status: null },
    { name: loser || 'TBD', isWinner: false, resultText: loser ? 0 : null, status: extra.loserStatus || null },
  ],
});

test('builds the champion route chronologically from wins and nextMatchId', () => {
  const path = buildChampionPath([
    node('r1-0', 'r2-0', 'Northern Lights', 'Solar Flare'),
    node('r1-1', 'r2-0', 'Kraken', 'Frostbite'),
    node('r2-0', null, 'Northern Lights', 'Kraken'),
  ], 'Northern Lights');

  expect(path.matchIds).toEqual(['r1-0', 'r2-0']);
  expect(path.connectorIds).toEqual(['r1-0']);
  expect(path.steps).toEqual([
    { type: 'match', id: 'r1-0' },
    { type: 'connector', id: 'r1-0' },
    { type: 'match', id: 'r2-0' },
  ]);
});

test('excludes the routes of every team that did not win the tournament', () => {
  const path = buildChampionPath([
    node('r1-0', 'r2-0', 'Northern Lights', 'Solar Flare'),
    node('r1-1', 'r2-0', 'Kraken', 'Frostbite'),
    node('r2-0', null, 'Northern Lights', 'Kraken'),
  ], 'Northern Lights');

  expect(path.matchIds).not.toContain('r1-1');
});

test('keeps the real final when the opening round is not a clean halving', () => {
  // Three teams: one play-in feeding the final. Sizing the tree from the opening round
  // alone used to drop the final entirely, leaving the replay with no route at all.
  const bracket = transformApiMatches([
    { id: 1, round_number: 1, state: 'DONE', winner: 'Bravo', participants: [participant('Bravo', 2, true), participant('Charlie', 0)] },
    { id: 2, round_number: 2, state: 'DONE', winner: 'Alpha', participants: [participant('Alpha', 2, true), participant('Bravo', 1)] },
  ]);

  const final = bracket.find((match) => match.id === 'r2-0');
  expect(final).toBeDefined();
  expect(final.dbMatchId).toBe(2);
  expect(final.name).toBe('Final');
  expect(bracket.find((match) => match.id === 'r1-0').nextMatchId).toBe('r2-0');
  // The champion entered in round two; the replay must still find their route.
  expect(buildChampionPath(bracket, 'Alpha').matchIds).toEqual(['r2-0']);
});

test('builds an unchanged tree for power-of-two brackets', () => {
  const bracket = transformApiMatches([
    { id: 1, round_number: 1, state: 'DONE', winner: 'Alpha', participants: [participant('Alpha', 2, true), participant('Bravo', 0)] },
    { id: 2, round_number: 1, state: 'DONE', winner: 'Delta', participants: [participant('Delta', 2, true), participant('Echo', 1)] },
    { id: 3, round_number: 2, state: 'DONE', winner: 'Alpha', participants: [participant('Alpha', 3, true), participant('Delta', 1)] },
  ]);

  expect(bracket.map((match) => match.id)).toEqual(['r1-0', 'r1-1', 'r2-0']);
  expect(bracket.map((match) => match.nextMatchId)).toEqual(['r2-0', 'r2-0', null]);
  expect(buildChampionPath(bracket, 'Alpha').matchIds).toEqual(['r1-0', 'r2-0']);
});

test('anchors the route on the deepest round when a link is missing', () => {
  // r2-0 has lost its link forward, leaving a two-match fragment competing with the
  // real final. The final has to win, or the hover trigger lands on the wrong card.
  const path = buildChampionPath([
    node('r1-0', 'r2-0', 'Northern Lights', 'Solar Flare'),
    node('r2-0', null, 'Northern Lights', 'Kraken'),
    node('r3-0', null, 'Northern Lights', 'Aurora'),
  ], 'Northern Lights');

  expect(path.matchIds).toEqual(['r3-0']);
});

test('starts the route at the first real match when the champion had a bye', () => {
  // Only one opening match exists; the champion entered directly in round two.
  const path = buildChampionPath([
    node('r1-0', 'r2-0', 'Kraken', 'Frostbite'),
    node('r2-0', null, 'Northern Lights', 'Kraken'),
  ], 'Northern Lights');

  expect(path.matchIds).toEqual(['r2-0']);
  expect(path.connectorIds).toEqual([]);
  expect(path.steps).toEqual([{ type: 'match', id: 'r2-0' }]);
});

test('keeps forfeited wins on the champion route', () => {
  const path = buildChampionPath([
    node('r1-0', 'r2-0', 'Northern Lights', 'Dropped Team', { state: 'FORFEIT' }),
    node('r1-1', 'r2-0', 'Kraken', 'Frostbite'),
    node('r2-0', null, 'Northern Lights', 'Kraken'),
  ], 'Northern Lights');

  expect(path.matchIds).toEqual(['r1-0', 'r2-0']);
});

test('ignores placeholder rounds the champion has only advanced into', () => {
  const advanced = node('r2-0', null, null, null, { dbMatchId: null });
  advanced.participants[0] = { name: 'Northern Lights', isWinner: false, resultText: null, status: 'ADVANCED' };
  const path = buildChampionPath([
    node('r1-0', 'r2-0', 'Northern Lights', 'Solar Flare'),
    node('r1-1', 'r2-0', null, null, { dbMatchId: 2 }),
    advanced,
  ], 'Northern Lights');

  expect(path.matchIds).toEqual(['r1-0']);
  expect(path.steps).toEqual([{ type: 'match', id: 'r1-0' }]);
});

test('returns an empty route when no champion is known', () => {
  const matches = [node('r1-0', null, 'Northern Lights', 'Solar Flare')];

  expect(buildChampionPath(matches, '')).toEqual({ matchIds: [], connectorIds: [], steps: [] });
  expect(buildChampionPath(matches, 'Unknown Team')).toEqual({ matchIds: [], connectorIds: [], steps: [] });
  expect(buildChampionPath([], 'Northern Lights')).toEqual({ matchIds: [], connectorIds: [], steps: [] });
});
