const FALLBACK_ART = {
  src: '/images/arena-master-wraith-mark-32bit-optimized.png',
  alt: 'Arena Master emblem',
  fit: 'contain',
  position: 'center',
  scale: 0.72,
};

// Add one entry here whenever Arena Master adds a game. Artwork remains the
// property of its publisher; source pages are kept alongside each asset.
const GAME_ART = {
  'league of legends': {
    src: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Thresh_0.jpg',
    alt: 'Thresh artwork from League of Legends',
    fit: 'cover',
    position: '35% center',
    scale: 1.04,
    source: 'https://www.leagueoflegends.com/en-us/league-of-legends-downloads/',
  },
  valorant: {
    src: 'https://media.valorant-api.com/agents/9f0d8ba9-4140-b941-57d3-a7ad57c6b417/fullportrait.png',
    alt: 'Brimstone artwork from Valorant',
    fit: 'contain',
    position: 'center bottom',
    scale: 1.12,
    source: 'https://playvalorant.com/en-us/media/',
  },
};

const normalizeGameName = (game = '') => game.trim().toLowerCase();

export const getGameArt = (game) => ({
  ...FALLBACK_ART,
  ...(GAME_ART[normalizeGameName(game)] || {}),
  game: game || 'Arena Master',
  registered: Boolean(GAME_ART[normalizeGameName(game)]),
});

export { GAME_ART };
