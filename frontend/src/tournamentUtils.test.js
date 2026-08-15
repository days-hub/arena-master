import { transformApiMatches } from './tournamentUtils';

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
