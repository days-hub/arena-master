import { getGameArt, getGameArtCollection, normalizeGameName } from './gameArt';

describe('game artwork catalog', () => {
  test.each([
    ['CS:GO', 'counter-strike 2'],
    ['csgo', 'counter-strike 2'],
    ['Overwatch 2', 'overwatch'],
    ['LoL', 'league of legends'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeGameName(input)).toBe(expected);
  });

  test.each([
    'League of Legends',
    'Valorant',
    'Overwatch',
    'Marvel Rivals',
    'Fortnite',
    'Apex Legends',
    'Minecraft',
    'Counter-Strike 2',
  ])('%s has rotating artwork', (game) => {
    const collection = getGameArtCollection(game);
    expect(collection.length).toBeGreaterThanOrEqual(3);
    expect(collection.every((entry) => entry.registered)).toBe(true);
  });

  test('keeps icons stable while allowing indexed feature art', () => {
    expect(getGameArt('Valorant').src).toContain('9f0d8ba9');
    expect(getGameArt('Valorant', 1).src).toContain('add6443a');
  });

  test('falls back for an unregistered game', () => {
    const fallback = getGameArt('Unknown Game');
    expect(fallback.registered).toBe(false);
    expect(fallback.src).toContain('arena-master-wraith-mark');
  });
});
