import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { getGameArt } from '../gameArt';

const GameIcon = ({ game, size = 42, sx }) => {
  const artwork = getGameArt(game);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [artwork.src]);
  const visibleArtwork = failed ? getGameArt() : artwork;

  return (
    <Box
      sx={{
        width: size, height: size, flexShrink: 0, overflow: 'hidden', borderRadius: 2.25,
        bgcolor: '#102B35', border: '1px solid rgba(11,143,140,.14)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08)', ...sx,
      }}
    >
      <Box
        component="img"
        src={visibleArtwork.src}
        alt=""
        onError={() => setFailed(true)}
        sx={{
          width: '100%', height: '100%', display: 'block', objectFit: visibleArtwork.fit,
          objectPosition: visibleArtwork.position,
          transform: `scale(${visibleArtwork.registered ? Math.max(1, visibleArtwork.scale || 1) : 0.76})`,
          imageRendering: visibleArtwork.registered ? 'auto' : 'pixelated',
        }}
      />
    </Box>
  );
};

export default GameIcon;
