const FALLBACK_ART = {
  src: '/images/arena-master-wraith-mark-32bit-optimized.png',
  alt: 'Arena Master emblem',
  fit: 'contain',
  position: 'center',
  scale: 0.72,
};

const art = (src, alt, options = {}) => ({
  src,
  alt,
  fit: 'cover',
  position: 'center',
  scale: 1.04,
  ...options,
});

// Artwork remains the property of its publisher. These are publisher media,
// public game APIs, or official storefront assets and are not bundled locally.
const GAME_ART = {
  'league of legends': [
    art('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Thresh_0.jpg', 'Thresh artwork from League of Legends', { position: '35% center' }),
    art('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg', 'Ahri artwork from League of Legends', { position: '48% center' }),
    art('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Jinx_0.jpg', 'Jinx artwork from League of Legends', { position: '47% center' }),
    art('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Yasuo_0.jpg', 'Yasuo artwork from League of Legends', { position: '53% center' }),
  ],
  valorant: [
    art('https://media.valorant-api.com/agents/9f0d8ba9-4140-b941-57d3-a7ad57c6b417/fullportrait.png', 'Brimstone artwork from Valorant', { fit: 'contain', position: 'center bottom', scale: 1.12 }),
    art('https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/fullportrait.png', 'Jett artwork from Valorant', { fit: 'contain', position: 'center bottom', scale: 1.12 }),
    art('https://media.valorant-api.com/agents/8e253930-4c05-31dd-1b6c-968525494517/fullportrait.png', 'Omen artwork from Valorant', { fit: 'contain', position: 'center bottom', scale: 1.12 }),
    art('https://media.valorant-api.com/agents/569fdd95-4d10-43ab-ca70-79becc718b46/fullportrait.png', 'Sage artwork from Valorant', { fit: 'contain', position: 'center bottom', scale: 1.12 }),
  ],
  overwatch: [
    art('https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2357570/7baa151c768868f1fe1d3aeea2467fa1a35fb531/header_alt_assets_22.jpg', 'Overwatch key art', { position: '52% center', scale: 1.08 }),
    art('https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2357570/c48aa3d3379473f92df5f2665e1a28144900b1f8/ss_c48aa3d3379473f92df5f2665e1a28144900b1f8.600x338.jpg', 'Overwatch team battle artwork'),
    art('https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2357570/6cea8a8817ae0a8dd5198052ffeba742b1a90b8e/ss_6cea8a8817ae0a8dd5198052ffeba742b1a90b8e.600x338.jpg', 'Overwatch hero battle artwork'),
    art('https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2357570/2830b5babd473e7e76fa522d4c1858386d3acfb1/ss_2830b5babd473e7e76fa522d4c1858386d3acfb1.600x338.jpg', 'Overwatch arena artwork'),
  ],
  'marvel rivals': [
    art('https://r.res.easebar.com/pic/20241115/c8321e61-b0e7-49b9-84d9-6dc576612d99.jpg', 'Moon Knight artwork from Marvel Rivals'),
    art('https://r.res.easebar.com/pic/20241108/2389bc22-2e6a-4ad4-add0-06ee6285314d.jpg', 'Psylocke artwork from Marvel Rivals'),
    art('https://r.res.easebar.com/pic/20240814/a31d6c44-b7fc-4fae-81b9-3482c2a40123.jpg', 'Venom artwork from Marvel Rivals'),
    art('https://r.res.easebar.com/pic/20240815/3eb7a2aa-34a1-40a5-8e2f-edd18adcf6b8.jpg', 'Spider-Man artwork from Marvel Rivals'),
  ],
  fortnite: [
    art('https://cms-assets.unrealengine.com/cm6l5gfpm05kr07my04cqgy2x/cmmx2yaipaxzh06oiwra8ztzf', 'Fortnite Battle Royale artwork'),
    art('https://cms-assets.unrealengine.com/cm6l5gfpm05kr07my04cqgy2x/cmmx0tghpa6fb06oirn2s022g', 'Fortnite seasonal artwork'),
    art('https://cms-assets.unrealengine.com/cm6l5gfpm05kr07my04cqgy2x/cml6q9tmb4t5h07o3v5hdda6o', 'Fortnite event artwork'),
    art('https://cms-assets.unrealengine.com/cm6l5gfpm05kr07my04cqgy2x/cmikeil1p4evp07n5hj78w4cw', 'Fortnite island artwork'),
  ],
  'apex legends': [
    art('https://drop-assets.ea.com/images/71f4qM8ybosc8RUu3n6jGW/513c00f7a31b155bea0d2add900acac7/apex-hero-medium-about-legends.png?im=AspectCrop%3D%2816%2C9%29%2CxPosition%3D0.5%2CyPosition%3D0.5', 'Apex Legends character artwork'),
    art('https://drop-assets.ea.com/images/5IGoTV5rH6JaZGudUuZQ24/ee3a7815ffa698ccf72f5b992a31e0d2/apex-hero-medium-about-modes.png?im=AspectCrop%3D%2816%2C9%29%2CxPosition%3D0.46611909650924027%2CyPosition%3D0.4080145719489982', 'Apex Legends squad artwork'),
    art('https://drop-assets.ea.com/images/6NXmn5uRFXPffRFWd64YjD/808cd2ad017acdf363b16274357d11df/apex-media-maps-e-district-xl.jpg?im=AspectCrop%3D%2816%2C9%29%2CxPosition%3D0.5%2CyPosition%3D0.5', 'E-District artwork from Apex Legends'),
  ],
  minecraft: [
    art('https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/key-art/Vanilla_bundle_2.png', 'Minecraft Bedrock Edition artwork'),
    art('https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/key-art/Vanilla_bundle_3.png', 'Minecraft Java and Bedrock Edition artwork'),
    art('https://www.minecraft.net/content/dam/minecraftnet/games/minecraft/key-art/Vanilla_bundle_1.png', 'Minecraft Java Edition artwork'),
    art('https://www.minecraft.net/content/dam/minecraftnet/community/events/cy2025/sandstorm/Wallpapers_Carousel_MCM-Vista_1110x624.jpg', 'Minecraft Overworld vista artwork'),
  ],
  'counter-strike 2': [
    art('https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/ss_796601d9d67faf53486eeb26d0724347cea67ddc.600x338.jpg', 'Counter-Strike 2 match artwork'),
    art('https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/ss_d830cfd0550fbb64d80e803e93c929c3abb02056.600x338.jpg', 'Counter-Strike 2 map artwork'),
    art('https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/ss_13bb35638c0267759276f511ee97064773b37a51.600x338.jpg', 'Counter-Strike 2 firefight artwork'),
    art('https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/730/ss_0f8cf82d019c614760fd20801f2bb4001da7ea77.600x338.jpg', 'Counter-Strike 2 competitive artwork'),
  ],
};

const GAME_ALIASES = {
  lol: 'league of legends',
  'overwatch 2': 'overwatch',
  apex: 'apex legends',
  csgo: 'counter-strike 2',
  'cs:go': 'counter-strike 2',
  'counter-strike: global offensive': 'counter-strike 2',
};

export const normalizeGameName = (game = '') => {
  const normalized = game.trim().toLowerCase();
  return GAME_ALIASES[normalized] || normalized;
};

export const getGameArtCollection = (game) => {
  const collection = GAME_ART[normalizeGameName(game)];
  if (!collection?.length) return [{ ...FALLBACK_ART, game: game || 'Arena Master', registered: false }];

  return collection.map((entry) => ({
    ...FALLBACK_ART,
    ...entry,
    game,
    registered: true,
  }));
};

export const getGameArt = (game, index = 0) => {
  const collection = getGameArtCollection(game);
  const safeIndex = ((Number(index) || 0) % collection.length + collection.length) % collection.length;
  return collection[safeIndex];
};

export { FALLBACK_ART, GAME_ART };
