import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, Divider, Grid,
  LinearProgress, Paper, Skeleton, Stack, Typography,
} from '@mui/material';
import {
  AutoAwesomeMosaicRounded, EmojiEventsRounded, FlagRounded, GroupsRounded,
  HistoryRounded, LocalFireDepartmentRounded, LoginRounded, MilitaryTechRounded,
  ShieldRounded, SportsEsportsRounded, VerifiedRounded,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { useAuth } from '../auth/AuthContext';
import { fetchCareerProfile, getApiErrorMessage } from '../api/apiClient';
import PageHeader from '../components/PageHeader';
import RiotAccountCard from '../components/RiotAccountCard';

const ACHIEVEMENT_ICONS = {
  arena_debut: FlagRounded,
  squad_up: GroupsRounded,
  match_ready: SportsEsportsRounded,
  on_a_roll: LocalFireDepartmentRounded,
  champion: EmojiEventsRounded,
  versatile: AutoAwesomeMosaicRounded,
};

const initials = (name = '') => name.split(/\s+/).filter(Boolean).map((word) => word[0]).join('').slice(0, 2).toUpperCase();
const memberSince = (value) => {
  if (!value) return 'Founding era';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Founding era' : date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};

const RecordStat = ({ value, label, accent }) => (
  <Box>
    <Typography sx={{ color: accent || 'common.white', fontSize: { xs: '1.35rem', md: '1.7rem' }, fontWeight: 850, lineHeight: 1 }}>{value}</Typography>
    <Typography variant="caption" sx={{ color: 'rgba(232,248,248,.65)', letterSpacing: '.055em', textTransform: 'uppercase' }}>{label}</Typography>
  </Box>
);

const CareerCard = ({ profile }) => {
  const totalMatches = profile.match_wins + profile.match_losses;
  const winRate = totalMatches ? Math.round((profile.match_wins / totalMatches) * 100) : 0;
  return (
    <Card sx={{
      position: 'relative', overflow: 'hidden', color: 'common.white', borderColor: 'rgba(80,211,204,.24)',
      background: 'linear-gradient(125deg, #07191f 0%, #0c2a32 56%, #0a2229 100%)',
      boxShadow: '0 22px 55px rgba(7, 28, 34, .18)',
      '&::before': {
        content: '""', position: 'absolute', inset: 0, opacity: 0.24,
        backgroundImage: 'linear-gradient(rgba(76,195,190,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(76,195,190,.12) 1px, transparent 1px)',
        backgroundSize: '28px 28px', maskImage: 'linear-gradient(90deg, black, transparent 75%)',
      },
      '&::after': {
        content: '""', position: 'absolute', width: 360, height: 360, right: -150, top: -190,
        borderRadius: '50%', border: '1px solid rgba(75,195,190,.24)', boxShadow: '0 0 90px rgba(75,195,190,.13)',
      },
    }}>
      <CardContent sx={{ position: 'relative', zIndex: 1, p: { xs: 2.5, md: 3.5 }, '&:last-child': { pb: { xs: 2.5, md: 3.5 } } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 2.5, md: 4 }} alignItems={{ md: 'center' }}>
          <Stack direction="row" spacing={2.25} alignItems="center" sx={{ minWidth: { md: 330 } }}>
            <Box sx={{ position: 'relative' }}>
              <Avatar src={profile.avatar_url || undefined} alt={profile.username} sx={{ width: { xs: 72, md: 88 }, height: { xs: 72, md: 88 }, border: '3px solid #62d2cc', boxShadow: '0 0 0 5px rgba(98,210,204,.12)' }}>
                {initials(profile.username)}
              </Avatar>
              <VerifiedRounded sx={{ position: 'absolute', right: -5, bottom: -4, color: '#62d2cc', bgcolor: '#0b222a', borderRadius: '50%', fontSize: 24 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: '#78ddd7', fontWeight: 850, letterSpacing: '.14em' }}>PLAYER CAREER // {new Date().getFullYear()}</Typography>
              <Typography variant="h2" sx={{ color: 'common.white', fontSize: { xs: '1.45rem', md: '1.8rem' }, mt: 0.25 }} noWrap>{profile.username}</Typography>
              <Typography variant="body2" sx={{ color: 'rgba(232,248,248,.7)', mt: 0.35 }}>{profile.guild_role} · Since {memberSince(profile.member_since)}</Typography>
            </Box>
          </Stack>

          <Divider flexItem orientation="vertical" sx={{ display: { xs: 'none', md: 'block' }, borderColor: 'rgba(196,232,230,.16)' }} />
          <Grid container spacing={{ xs: 2, md: 3 }} sx={{ flexGrow: 1 }}>
            <Grid item xs={4} sm={2.4}><RecordStat value={profile.teams.length} label={profile.teams.length === 1 ? 'Team' : 'Teams'} /></Grid>
            <Grid item xs={4} sm={2.4}><RecordStat value={profile.tournament_appearances} label="Events" /></Grid>
            <Grid item xs={4} sm={2.4}><RecordStat value={profile.titles} label="Titles" accent="#ffc45b" /></Grid>
            <Grid item xs={4} sm={2.4}><RecordStat value={`${profile.match_wins}-${profile.match_losses}`} label="Record" /></Grid>
            <Grid item xs={4} sm={2.4}><RecordStat value={`${winRate}%`} label="Win rate" /></Grid>
          </Grid>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(196,232,230,.14)' }}>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {(profile.games_played || []).length ? profile.games_played.map((game) => <Chip key={game} size="small" label={game} sx={{ color: '#dff9f7', bgcolor: 'rgba(75,195,190,.12)', border: '1px solid rgba(75,195,190,.2)' }} />) : <Typography variant="caption" sx={{ color: 'rgba(232,248,248,.58)' }}>Your first tournament will add a game signature.</Typography>}
          </Stack>
          <Typography variant="caption" sx={{ color: 'rgba(232,248,248,.48)', fontWeight: 750, letterSpacing: '.08em' }}>ARENA MASTER // PLAYER RECORD</Typography>
        </Stack>
      </CardContent>
    </Card>
  );
};

const SectionHeading = ({ icon, title, description, action }) => (
  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      <Box sx={{ width: 38, height: 38, borderRadius: 2, display: 'grid', placeItems: 'center', color: 'primary.main', bgcolor: (theme) => alpha(theme.palette.primary.main, 0.09) }}>{icon}</Box>
      <Box><Typography variant="h3">{title}</Typography><Typography variant="body2" color="text.secondary">{description}</Typography></Box>
    </Stack>
    {action}
  </Stack>
);

const TeamsPanel = ({ teams }) => (
  <Card sx={{ height: '100%' }}><CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
    <SectionHeading icon={<GroupsRounded />} title="Your teams" description="Rosters connected to your Discord identity." action={<Chip size="small" label={`${teams.length} ${teams.length === 1 ? 'team' : 'teams'}`} variant="outlined" />} />
    {teams.length ? <Stack spacing={1.25}>{teams.map((team) => (
      <Paper key={team.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, bgcolor: 'rgba(248,251,251,.7)' }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar src={team.avatar_url || undefined} alt={team.name} sx={{ width: 44, height: 44, bgcolor: 'secondary.main', fontWeight: 850 }}>{initials(team.name)}</Avatar>
          <Box sx={{ minWidth: 0, flexGrow: 1 }}><Typography sx={{ fontWeight: 800 }} noWrap>{team.name}</Typography><Typography variant="caption" color="text.secondary">{team.tournament_appearances} event{team.tournament_appearances === 1 ? '' : 's'}</Typography></Box>
          {team.titles > 0 && <Chip size="small" color="warning" variant="outlined" icon={<EmojiEventsRounded />} label={team.titles} />}
        </Stack>
      </Paper>
    ))}</Stack> : <Box sx={{ py: 3, textAlign: 'center' }}><GroupsRounded sx={{ color: 'text.disabled', fontSize: 34 }} /><Typography sx={{ mt: 1, fontWeight: 750 }}>No team yet</Typography><Typography variant="body2" color="text.secondary">Join a roster and it will appear here automatically.</Typography></Box>}
  </CardContent></Card>
);

const DiscordPanel = ({ profile }) => (
  <Card sx={{ height: '100%' }}><CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
    <SectionHeading icon={<ShieldRounded />} title="Discord identity" description="The identity Arena Master trusts." />
    <Stack direction="row" alignItems="center" spacing={1.5}>
      <Avatar src={profile.avatar_url || undefined} alt="" sx={{ width: 48, height: 48 }}>{initials(profile.username)}</Avatar>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}><Typography sx={{ fontWeight: 800 }} noWrap>{profile.username}</Typography><Typography variant="caption" color="text.secondary">Discord ID · {profile.discord_id}</Typography></Box>
    </Stack>
    <Divider sx={{ my: 2 }} />
    <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="body2" color="text.secondary">Guild role</Typography><Chip size="small" color="primary" icon={<VerifiedRounded />} label={profile.guild_role} /></Stack>
  </CardContent></Card>
);

const MatchHistory = ({ matches }) => (
  <Card><CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
    <SectionHeading icon={<HistoryRounded />} title="Recent matches" description="Your latest decided tournament series." />
    {matches.length ? <Stack divider={<Divider flexItem />}>
      {matches.map((match) => <Stack key={match.id} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1.5, '&:first-of-type': { pt: 0.5 } }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 2, display: 'grid', placeItems: 'center', fontWeight: 900, color: match.result === 'W' ? '#0a716e' : '#9a3e49', bgcolor: match.result === 'W' ? 'rgba(75,195,190,.13)' : 'rgba(190,75,91,.09)' }}>{match.result}</Box>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography sx={{ fontWeight: 780 }} noWrap>{match.team} <Box component="span" sx={{ color: 'text.disabled', mx: 0.4 }}>vs</Box> {match.opponent}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{match.tournament_name} · {match.game || 'Game'} · Round {match.round_number}</Typography>
        </Box>
        <Typography sx={{ fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{match.team_score}<Box component="span" sx={{ color: 'text.disabled', mx: 0.6 }}>:</Box>{match.opponent_score}</Typography>
      </Stack>)}
    </Stack> : <Box sx={{ py: 3, textAlign: 'center' }}><HistoryRounded sx={{ color: 'text.disabled', fontSize: 34 }} /><Typography sx={{ mt: 1, fontWeight: 750 }}>No match history yet</Typography><Typography variant="body2" color="text.secondary">Decided matches for your teams will collect here.</Typography></Box>}
  </CardContent></Card>
);

const AchievementsPanel = ({ achievements }) => {
  const earned = achievements.filter((achievement) => achievement.earned).length;
  return <Card><CardContent sx={{ p: { xs: 2.25, md: 3 } }}>
    <SectionHeading icon={<MilitaryTechRounded />} title="Achievements" description="Career milestones earned through competition." action={<Chip size="small" label={`${earned}/${achievements.length} earned`} color={earned ? 'warning' : 'default'} variant="outlined" />} />
    <Grid container spacing={1.25}>{achievements.map((achievement) => {
      const Icon = ACHIEVEMENT_ICONS[achievement.id] || MilitaryTechRounded;
      const progress = achievement.goal ? (achievement.progress / achievement.goal) * 100 : 0;
      return <Grid item xs={12} sm={6} key={achievement.id}><Paper variant="outlined" sx={{ p: 1.5, height: '100%', opacity: achievement.earned ? 1 : 0.64, borderColor: achievement.earned ? 'rgba(244,166,33,.34)' : 'divider', bgcolor: achievement.earned ? 'rgba(255,248,230,.48)' : 'rgba(248,250,250,.7)' }}>
        <Stack direction="row" spacing={1.25} alignItems="flex-start"><Box sx={{ width: 36, height: 36, flex: '0 0 auto', borderRadius: '50%', display: 'grid', placeItems: 'center', color: achievement.earned ? '#9b6300' : 'text.disabled', bgcolor: achievement.earned ? 'rgba(244,166,33,.16)' : 'action.hover' }}><Icon fontSize="small" /></Box><Box sx={{ minWidth: 0, flexGrow: 1 }}><Stack direction="row" justifyContent="space-between" spacing={1}><Typography sx={{ fontWeight: 800 }}>{achievement.name}</Typography><Typography variant="caption" color="text.secondary">{achievement.progress}/{achievement.goal}</Typography></Stack><Typography variant="caption" color="text.secondary">{achievement.description}</Typography><LinearProgress variant="determinate" value={progress} color={achievement.earned ? 'warning' : 'primary'} sx={{ height: 3, borderRadius: 2, mt: 1 }} /></Box></Stack>
      </Paper></Grid>;
    })}</Grid>
  </CardContent></Card>;
};

const ProfileSkeleton = () => <Stack spacing={2.5}><Skeleton variant="rounded" height={230} /><Grid container spacing={2}><Grid item xs={12} md={7}><Skeleton variant="rounded" height={290} /></Grid><Grid item xs={12} md={5}><Skeleton variant="rounded" height={290} /></Grid></Grid></Stack>;

const Profile = () => {
  const { user, isAuthenticated, signIn } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) { setProfile(null); return undefined; }
    let active = true;
    setLoading(true);
    setError('');
    fetchCareerProfile()
      .then((response) => { if (active) setProfile(response.data); })
      .catch((requestError) => { if (active) setError(getApiErrorMessage(requestError, 'Your career profile could not be loaded.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isAuthenticated]);

  const fallbackProfile = useMemo(() => user ? {
    discord_id: user.discord_id, username: user.username, avatar_url: user.avatar_url,
    guild_role: user.is_admin ? 'Administrator' : 'Guild member', member_since: null,
    teams: [], tournament_appearances: 0, titles: 0, match_wins: 0, match_losses: 0,
    game_wins: 0, game_losses: 0, games_played: [], recent_matches: [], achievements: [],
  } : null, [user]);
  const career = profile || fallbackProfile;

  return (
    <Box>
      <PageHeader eyebrow="Your account" title="Player profile" description="Your teams, tournament history, connected identities, and achievements in one career record." />
      {!isAuthenticated ? <Alert severity="info" action={<Button color="inherit" size="small" startIcon={<LoginRounded />} onClick={signIn}>Sign in</Button>}>Sign in with Discord to see your Arena Master career.</Alert>
        : loading && !profile ? <ProfileSkeleton /> : career && <Stack spacing={2.5}>
          {error && <Alert severity="warning">{error}</Alert>}
          <CareerCard profile={career} />
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={7}><TeamsPanel teams={career.teams || []} /></Grid>
            <Grid item xs={12} md={5}><DiscordPanel profile={career} /></Grid>
            <Grid item xs={12} lg={7}><MatchHistory matches={career.recent_matches || []} /></Grid>
            <Grid item xs={12} lg={5}><AchievementsPanel achievements={career.achievements || []} /></Grid>
          </Grid>
          <Box>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}><SportsEsportsRounded color="primary" /><Box><Typography variant="h3">Connected game accounts</Typography><Typography variant="body2" color="text.secondary">Verified identities and ranks from supported games.</Typography></Box></Stack>
            <RiotAccountCard />
          </Box>
        </Stack>}
    </Box>
  );
};

export default Profile;
