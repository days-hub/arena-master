import React, { useEffect, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { AutoAwesomeRounded } from '@mui/icons-material';
import { getGameArt } from '../gameArt';
import { AnimatedProgress, LiveDot } from './Motion';

const TONES = {
  live: { accent: '#4BC3BE', glow: 'rgba(75,195,190,.16)', label: 'ARENA LIVE' },
  setup: { accent: '#7DA7FF', glow: 'rgba(125,167,255,.15)', label: 'TOURNAMENT SETUP' },
  celebrate: { accent: '#F4A621', glow: 'rgba(244,166,33,.18)', label: 'VICTORY REPORT' },
};

const GameUpdatePanel = ({ game, title, message, action, progress, tone = 'live', compact = false }) => {
  const palette = TONES[tone] || TONES.live;
  const artwork = getGameArt(game);
  const [imageFailed, setImageFailed] = useState(false);
  const { label: actionLabel, sx: actionSx, ...actionProps } = action || {};

  useEffect(() => setImageFailed(false), [artwork.src]);

  const visibleArtwork = imageFailed ? getGameArt() : artwork;
  const updateLabel = game ? `${game.toUpperCase()} // ${palette.label}` : palette.label;

  return (
    <Box
      className={`game-update-panel ${compact ? 'game-update-panel--compact' : ''}`}
      sx={{
        '--game-accent': palette.accent,
        position: 'relative', overflow: 'hidden', isolation: 'isolate',
        minHeight: compact ? 124 : 174, borderRadius: 4,
        border: '1px solid rgba(255,255,255,.09)',
        background: `radial-gradient(circle at 10% 40%, ${palette.glow}, transparent 30%), linear-gradient(120deg, #0A1C24 0%, #102C35 100%)`,
        color: 'white', boxShadow: '0 16px 38px rgba(9,26,33,.13)',
      }}
    >
      <Box className="game-stage-grid" />
      <Box className="game-stage-scanline" />
      <Stack direction="row" alignItems="center" sx={{ position: 'relative', zIndex: 2, height: '100%', minHeight: 'inherit' }}>
        <Box className="game-art-stage" sx={{ width: compact ? { xs: 104, sm: 142 } : { xs: 122, sm: 188 } }}>
          <Box className="game-art-frame">
            <Box
              component="img"
              className="game-art-visual"
              src={visibleArtwork.src}
              alt={visibleArtwork.alt}
              onError={() => setImageFailed(true)}
              sx={{
                objectFit: visibleArtwork.fit,
                objectPosition: visibleArtwork.position,
                '--game-art-scale': visibleArtwork.scale,
                imageRendering: visibleArtwork.registered ? 'auto' : 'pixelated',
              }}
            />
            <Box className="game-art-vignette" />
          </Box>
          <Box className="game-art-shadow" />
        </Box>

        <Box sx={{ flex: 1, py: compact ? 2 : 2.75, pr: { xs: 1.5, sm: 3 }, pl: { xs: 0.75, sm: 1 }, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
            <LiveDot color={palette.accent} />
            <Typography variant="overline" sx={{ color: palette.accent, fontSize: 10, lineHeight: 1.2, fontWeight: 900, letterSpacing: '.16em' }}>
              {updateLabel}
            </Typography>
          </Stack>
          <Typography variant={compact ? 'h3' : 'h2'} sx={{ color: 'white' }}>{title}</Typography>
          <Typography variant="body2" sx={{ mt: 0.65, maxWidth: 650, color: 'rgba(255,255,255,.62)', lineHeight: 1.55 }}>{message}</Typography>
          {progress != null && (
            <Box sx={{ mt: 1.5, maxWidth: 440 }}>
              <AnimatedProgress value={progress} sx={{ bgcolor: 'rgba(255,255,255,.09)', '& .MuiLinearProgress-bar': { bgcolor: palette.accent } }} />
            </Box>
          )}
          {action && (
            <Button size="small" variant="outlined" startIcon={<AutoAwesomeRounded />} {...actionProps}
              sx={{ mt: 1.5, color: 'white', borderColor: 'rgba(255,255,255,.20)', '&:hover': { borderColor: palette.accent, bgcolor: 'rgba(255,255,255,.05)' }, ...actionSx }}>
              {actionLabel}
            </Button>
          )}
        </Box>
      </Stack>
    </Box>
  );
};

export default GameUpdatePanel;
