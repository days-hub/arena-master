import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { AutoAwesomeRounded } from '@mui/icons-material';
import { getGameArt, getGameArtCollection } from '../gameArt';
import { AnimatedProgress, LiveDot } from './Motion';

const TONES = {
  live: { accent: '#4BC3BE', glow: 'rgba(75,195,190,.16)', label: 'ARENA LIVE' },
  setup: { accent: '#7DA7FF', glow: 'rgba(125,167,255,.15)', label: 'TOURNAMENT SETUP' },
  celebrate: { accent: '#F4A621', glow: 'rgba(244,166,33,.18)', label: 'VICTORY REPORT' },
};

const nextAvailableIndex = (current, collection, failedSources) => {
  for (let offset = 1; offset <= collection.length; offset += 1) {
    const candidate = (current + offset) % collection.length;
    if (!failedSources.has(collection[candidate].src)) return candidate;
  }
  return current;
};

const GameUpdatePanel = ({ game, title, message, action, progress, tone = 'live', compact = false, children }) => {
  const palette = TONES[tone] || TONES.live;
  const artworkCollection = useMemo(() => getGameArtCollection(game), [game]);
  const [artIndex, setArtIndex] = useState(0);
  const [failedSources, setFailedSources] = useState(() => new Set());
  const { label: actionLabel, sx: actionSx, ...actionProps } = action || {};

  useEffect(() => {
    setArtIndex(0);
    setFailedSources(new Set());
  }, [game]);

  useEffect(() => {
    if (artworkCollection.length < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    const timer = window.setInterval(() => {
      setArtIndex((current) => nextAvailableIndex(current, artworkCollection, failedSources));
    }, 8000);
    return () => window.clearInterval(timer);
  }, [artworkCollection, failedSources]);

  const selectedArtwork = artworkCollection[artIndex] || artworkCollection[0];
  const visibleArtwork = failedSources.size >= artworkCollection.length ? getGameArt() : selectedArtwork;
  const updateLabel = game ? `${game.toUpperCase()} // ${palette.label}` : palette.label;

  const handleArtworkError = () => {
    if (!visibleArtwork.registered) return;
    setFailedSources((current) => {
      const next = new Set(current);
      next.add(visibleArtwork.src);
      setArtIndex((index) => nextAvailableIndex(index, artworkCollection, next));
      return next;
    });
  };

  return (
    <Box
      className={`game-update-panel ${compact ? 'game-update-panel--compact' : ''}`}
      sx={{
        '--game-accent': palette.accent,
        position: 'relative', overflow: 'hidden', isolation: 'isolate',
        minHeight: compact ? 124 : { xs: 0, sm: 280 }, borderRadius: 4,
        border: '1px solid rgba(255,255,255,.09)',
        background: `radial-gradient(circle at 10% 40%, ${palette.glow}, transparent 30%), linear-gradient(120deg, #0A1C24 0%, #102C35 100%)`,
        color: 'white', boxShadow: '0 16px 38px rgba(9,26,33,.13)',
      }}
    >
      <Box className="game-stage-grid" />
      <Box className="game-stage-scanline" />
      <Box sx={{
        position: 'relative', zIndex: 2, minHeight: 'inherit',
        display: 'grid', alignItems: 'stretch',
        gridTemplateColumns: compact
          ? { xs: '104px minmax(0, 1fr)', sm: '142px minmax(0, 1fr)' }
          : { xs: 'minmax(0, 1fr)', sm: 'minmax(260px, 36%) minmax(0, 1fr)', lg: 'minmax(380px, 36%) minmax(0, 1fr)' },
        gridTemplateRows: compact ? '1fr' : { xs: '220px auto', sm: '1fr' },
      }}>
        <Box className="game-art-stage" sx={{ width: '100%', minWidth: 0 }}>
          <Box className="game-art-frame">
            <Box
              key={visibleArtwork.src}
              component="img"
              className="game-art-visual"
              src={visibleArtwork.src}
              alt={visibleArtwork.alt}
              onError={handleArtworkError}
              sx={{
                objectFit: visibleArtwork.fit,
                objectPosition: visibleArtwork.position,
                '--game-art-scale': visibleArtwork.scale,
                imageRendering: visibleArtwork.registered ? 'auto' : 'pixelated',
              }}
            />
            <Box className="game-art-vignette" />
            {artworkCollection.length > 1 && failedSources.size < artworkCollection.length && (
              <Box className="game-art-pagination" aria-label={`${game} artwork`}>
                {artworkCollection.map((entry, index) => !failedSources.has(entry.src) && (
                  <Box
                    key={entry.src}
                    component="button"
                    type="button"
                    aria-label={`Show artwork ${index + 1}`}
                    aria-current={index === artIndex ? 'true' : undefined}
                    className={`game-art-dot ${index === artIndex ? 'game-art-dot--active' : ''}`}
                    onClick={() => setArtIndex(index)}
                  />
                ))}
              </Box>
            )}
          </Box>
          <Box className="game-art-shadow" />
        </Box>

        <Box sx={{
          py: compact ? 2 : { xs: 2.25, sm: 3, lg: 3.25 },
          pr: compact ? { xs: 1.5, sm: 3 } : { xs: 2.25, sm: 3, lg: 4 },
          pl: compact ? { xs: 0.75, sm: 1 } : { xs: 2.25, sm: 3, lg: 4 },
          minWidth: 0,
        }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
            <LiveDot color={palette.accent} />
            <Typography variant="overline" sx={{ color: palette.accent, fontSize: 10, lineHeight: 1.2, fontWeight: 900, letterSpacing: '.16em' }}>
              {updateLabel}
            </Typography>
          </Stack>
          <Typography variant={compact ? 'h3' : 'h2'} sx={{ color: 'white' }}>{title}</Typography>
          <Typography variant="body2" sx={{ mt: 0.65, maxWidth: 780, color: 'rgba(255,255,255,.62)', lineHeight: 1.55 }}>{message}</Typography>
          {children && <Box sx={{ mt: 1.5, maxWidth: 920 }}>{children}</Box>}
          {progress != null && (
            <Box sx={{ mt: 1.5, maxWidth: 720 }}>
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
      </Box>
    </Box>
  );
};

export default GameUpdatePanel;
