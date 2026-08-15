import React, { useEffect, useRef, useState } from 'react';
import { Box, LinearProgress, Typography, useMediaQuery } from '@mui/material';

export const LiveDot = ({ label, color = '#59D6A3' }) => (
  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.8 }}>
    <Box component="span" className="arena-live-dot" sx={{ '--live-color': color, width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
    {label && <Typography component="span" variant="caption" sx={{ fontWeight: 800, letterSpacing: '.04em' }}>{label}</Typography>}
  </Box>
);

export const AnimatedProgress = ({ value, sx, ...props }) => {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [displayValue, setDisplayValue] = useState(reducedMotion ? value : 0);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayValue(value);
      return undefined;
    }
    const timer = window.setTimeout(() => setDisplayValue(value), 80);
    return () => window.clearTimeout(timer);
  }, [value, reducedMotion]);

  return (
    <LinearProgress
      className="arena-progress"
      variant="determinate"
      value={Math.max(0, Math.min(100, displayValue || 0))}
      sx={{ height: 7, borderRadius: 999, bgcolor: 'rgba(11,143,140,.10)', ...sx }}
      {...props}
    />
  );
};

export const CountUp = ({ value, suffix = '' }) => {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [display, setDisplay] = useState(reducedMotion ? value : 0);
  const previous = useRef(0);

  useEffect(() => {
    if (reducedMotion || !Number.isFinite(Number(value))) {
      setDisplay(value);
      previous.current = Number(value) || 0;
      return undefined;
    }
    const startValue = previous.current;
    const target = Number(value);
    const started = performance.now();
    let frame;
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / 650);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startValue + (target - startValue) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else previous.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reducedMotion]);

  return <>{display}{suffix}</>;
};

const CONFETTI = [
  ['10%', '8%', '#4BC3BE', '-18deg', '0s'],
  ['26%', '1%', '#F4A621', '24deg', '.35s'],
  ['46%', '10%', '#59D6A3', '42deg', '.8s'],
  ['67%', '3%', '#4BC3BE', '-35deg', '1.15s'],
  ['86%', '11%', '#F4A621', '18deg', '1.55s'],
  ['18%', '62%', '#F4A621', '50deg', '1.9s'],
  ['76%', '68%', '#59D6A3', '-24deg', '2.25s'],
];

export const CelebrationBurst = ({ active = true }) => active ? (
  <Box className="arena-confetti" aria-hidden="true">
    {CONFETTI.map(([left, top, color, rotate, delay], index) => (
      <Box key={index} component="span" sx={{ left, top, bgcolor: color, '--confetti-rotate': rotate, animationDelay: delay }} />
    ))}
  </Box>
) : null;
