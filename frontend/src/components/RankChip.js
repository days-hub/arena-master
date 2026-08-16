import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { MilitaryTechRounded } from '@mui/icons-material';

// Roughly the in-game emblem colours, so a rank reads at a glance.
const TIER_COLORS = {
  IRON: '#7C7A78',
  BRONZE: '#A0603B',
  SILVER: '#8C9BA5',
  GOLD: '#D4A11E',
  PLATINUM: '#2E9C95',
  EMERALD: '#28A15E',
  DIAMOND: '#4B7BE5',
  MASTER: '#9A4DD6',
  GRANDMASTER: '#D64B4B',
  CHALLENGER: '#3FC5E8',
};

/**
 * A player's solo queue rank. Renders nothing without a linked account, so
 * callers can drop it into a roster row unconditionally.
 */
const RankChip = ({ riot, size = 'small' }) => {
  if (!riot) return null;

  const color = TIER_COLORS[riot.tier] || '#7C8695';
  const games = (riot.wins ?? 0) + (riot.losses ?? 0);
  const winRate = games ? Math.round(((riot.wins ?? 0) / games) * 100) : null;

  const tooltip = [
    riot.riot_id,
    riot.summoner_level ? `Level ${riot.summoner_level}` : null,
    winRate !== null ? `${riot.wins}W / ${riot.losses}L · ${winRate}% win rate` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Tooltip title={tooltip}>
      <Chip
        size={size}
        icon={<MilitaryTechRounded sx={{ fontSize: 15, color: `${color} !important` }} />}
        label={riot.rank_label}
        sx={{
          fontWeight: 700,
          fontSize: 11,
          color,
          bgcolor: `${color}1A`,
          border: `1px solid ${color}44`,
          '& .MuiChip-label': { px: 0.9 },
        }}
      />
    </Tooltip>
  );
};

export default RankChip;
