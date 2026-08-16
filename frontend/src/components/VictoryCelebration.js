import React from 'react';
import {
  Avatar, Box, Button, Dialog, IconButton, Skeleton, Stack, Typography,
} from '@mui/material';
import {
  CloseRounded, EmojiEventsRounded, ReplayRounded, SportsEsportsRounded,
} from '@mui/icons-material';
import { CelebrationBurst } from './Motion';
import RankChip from './RankChip';

const initials = (name = '') => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase();

const VictoryCelebration = ({
  open, onClose, onReplay, teamName, tournamentName, members = [], loading = false,
}) => (
  <Dialog
    open={open}
    onClose={onClose}
    maxWidth="md"
    fullWidth
    aria-labelledby="victory-title"
    BackdropProps={{ className: 'arena-victory-backdrop' }}
    PaperProps={{ className: 'arena-victory-dialog' }}
  >
    <Box className="arena-victory-rays" aria-hidden="true" />
    <CelebrationBurst />
    <IconButton
      aria-label="Close champion celebration"
      onClick={onClose}
      sx={{ position: 'absolute', zIndex: 4, top: 12, right: 12, color: 'rgba(255,255,255,.7)' }}
    >
      <CloseRounded />
    </IconButton>

    <Stack className="arena-victory-content" alignItems="center">
      <Typography className="arena-victory-kicker" variant="overline">
        Tournament complete
      </Typography>
      <Box className="arena-victory-trophy"><EmojiEventsRounded /></Box>
      <Typography id="victory-title" className="arena-victory-title" component="h2">
        CHAMPIONS!
      </Typography>
      <Typography className="arena-victory-team" component="p">{teamName}</Typography>
      <Typography className="arena-victory-copy" variant="body1">
        Congratulations! You conquered {tournamentName} and earned your place in Arena Master history.
      </Typography>

      <Box className="arena-victory-roster">
        <Typography variant="overline" sx={{ color: 'rgba(255,255,255,.52)', letterSpacing: '.18em', fontWeight: 900 }}>
          Winning roster
        </Typography>
        <Stack direction="row" justifyContent="center" flexWrap="wrap" gap={{ xs: 1.5, sm: 2.5 }} sx={{ mt: 1.75 }}>
          {loading ? [0, 1, 2].map((item) => (
            <Stack key={item} alignItems="center" spacing={0.75}>
              <Skeleton variant="circular" width={68} height={68} sx={{ bgcolor: 'rgba(255,255,255,.1)' }} />
              <Skeleton width={62} sx={{ bgcolor: 'rgba(255,255,255,.1)' }} />
            </Stack>
          )) : members.length ? members.map((member, index) => (
            <Stack className="arena-victory-player" key={member.id || member.name} alignItems="center" spacing={0.85} sx={{ '--player-index': index }}>
              <Avatar src={member.avatar || undefined} alt={member.name} className="arena-victory-avatar">
                {initials(member.name)}
              </Avatar>
              <Typography variant="body2" sx={{ maxWidth: 112, color: 'white', fontWeight: 750 }} noWrap>
                {member.name}
              </Typography>
              {/* Renders nothing for players without a linked account. */}
              <RankChip riot={member.riot} />
            </Stack>
          )) : (
            <Stack className="arena-victory-player" alignItems="center" spacing={0.85} sx={{ '--player-index': 0 }}>
              <Avatar className="arena-victory-avatar arena-victory-avatar--team">
                {initials(teamName)}
              </Avatar>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.7)' }}>Roster unavailable</Typography>
            </Stack>
          )}
        </Stack>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 3, width: { xs: '100%', sm: 'auto' } }}>
        <Button variant="contained" color="secondary" startIcon={<SportsEsportsRounded />} onClick={onClose}>
          View final bracket
        </Button>
        <Button className="arena-victory-replay" variant="outlined" startIcon={<ReplayRounded />} onClick={onReplay}>
          Celebrate again
        </Button>
      </Stack>
    </Stack>
  </Dialog>
);

export default VictoryCelebration;
