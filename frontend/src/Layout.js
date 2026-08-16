import React, { useState } from 'react';
import {
  AppBar, Avatar, Box, Button, CircularProgress, Divider, Drawer, IconButton,
  List, ListItemButton, ListItemIcon, ListItemText, Stack, Toolbar, Tooltip, Typography,
  useMediaQuery,
} from '@mui/material';
import {
  AccountTreeRounded, AddCircleOutlineRounded, DashboardRounded, Groups2Rounded,
  LeaderboardRounded, LoginRounded, LogoutRounded, MenuRounded, PersonRounded,
} from '@mui/icons-material';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { useAuth } from './auth/AuthContext';
import Home from './views/Home';
import TournamentCreation from './views/TournamentCreation';
import TeamRegistration from './views/TeamRegistration';
import TournamentBracket from './views/TournamentBracket';
import Standings from './views/Standings';
import Profile from './views/Profile';
import { BRAND } from './theme';
import { LiveDot } from './components/Motion';

const DRAWER_WIDTH = 248;
const NAV = [
  { label: 'Dashboard', icon: <DashboardRounded />, to: '/' },
  { label: 'Tournaments', icon: <AddCircleOutlineRounded />, to: '/create-tournament' },
  { label: 'Teams', icon: <Groups2Rounded />, to: '/register-team' },
  { label: 'Bracket', icon: <AccountTreeRounded />, to: '/bracket' },
  { label: 'Standings', icon: <LeaderboardRounded />, to: '/standings' },
  { label: 'Profile', icon: <PersonRounded />, to: '/profile' },
];

const AccountControl = ({ compact = false }) => {
  const { user, isLoading, signIn, signOut } = useAuth();
  if (isLoading) return <CircularProgress size={22} sx={{ color: compact ? 'rgba(255,255,255,.7)' : 'primary.main' }} />;
  if (!user) {
    return (
      <Button
        size="small"
        variant={compact ? 'outlined' : 'contained'}
        startIcon={<LoginRounded />}
        onClick={signIn}
        sx={compact ? { color: 'white', borderColor: 'rgba(255,255,255,.22)', '&:hover': { borderColor: 'white' } } : {}}
      >
        Sign in
      </Button>
    );
  }
  return (
    <Stack direction="row" alignItems="center" spacing={1.25}>
      <Avatar src={user.avatar_url || undefined} alt={user.username} sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 14 }}>
        {user.username?.slice(0, 1)?.toUpperCase()}
      </Avatar>
      {!compact && (
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>{user.username}</Typography>
          <Typography variant="caption" color="text.secondary">{user.is_admin ? 'Administrator' : 'Organizer'}</Typography>
        </Box>
      )}
      <Tooltip title="Sign out">
        <IconButton size="small" onClick={signOut} sx={compact ? { color: 'rgba(255,255,255,.72)' } : {}}>
          <LogoutRounded fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
};

const Layout = () => {
  const location = useLocation();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = NAV.slice(1).find((item) => location.pathname.startsWith(item.to))?.to || '/';
  const currentLabel = NAV.find((item) => item.to === active)?.label || 'Dashboard';

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', color: 'white' }}>
      <Stack direction="row" alignItems="center" spacing={1.35} sx={{ px: 2.5, height: 76 }}>
        <Box component="img" className="arena-brand-mark" src="/images/arena-master-wraith-mark-32bit-optimized.png" alt="" sx={{ width: 42, height: 42, borderRadius: 2, imageRendering: 'pixelated' }} />
        <Box>
          <Typography sx={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>Arena Master</Typography>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,.48)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Tournament guild
          </Typography>
        </Box>
      </Stack>
      <Divider sx={{ borderColor: 'rgba(255,255,255,.08)' }} />
      <Typography sx={{ px: 2.5, pt: 2.5, pb: 1, fontSize: 10, fontWeight: 800, letterSpacing: '.14em', color: 'rgba(255,255,255,.36)' }}>
        WORKSPACE
      </Typography>
      <List sx={{ px: 1.25, py: 0 }}>
        {NAV.map((item) => (
          <ListItemButton
            key={item.to}
            component={Link}
            to={item.to}
            selected={active === item.to}
            onClick={() => setMobileOpen(false)}
            sx={{
              mb: 0.5, minHeight: 46, borderRadius: 2.5, color: 'rgba(255,255,255,.63)',
              '& .MuiListItemIcon-root': { color: 'inherit', minWidth: 40 },
              '&.Mui-selected': {
                color: 'white', bgcolor: 'rgba(75,195,190,.14)',
                boxShadow: `inset 3px 0 0 ${BRAND.tealLight}`,
              },
              '&.Mui-selected:hover': { bgcolor: 'rgba(75,195,190,.19)' },
              '&:hover': { bgcolor: 'rgba(255,255,255,.06)', color: 'white' },
            }}
          >
            <ListItemIcon className="arena-nav-icon">{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: active === item.to ? 700 : 600 }} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ mt: 'auto', p: 2 }}>
        <Box sx={{ p: 1.75, border: '1px solid rgba(255,255,255,.09)', borderRadius: 3, bgcolor: 'rgba(255,255,255,.035)' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#59D6A3', boxShadow: '0 0 0 4px rgba(89,214,163,.1)' }} />
            <Typography sx={{ fontSize: 12, fontWeight: 700 }}>The arena stirs</Typography>
          </Stack>
          <Typography sx={{ mt: 0.75, fontSize: 11, lineHeight: 1.5, color: 'rgba(255,255,255,.42)' }}>
            Brackets, teams and results in one place.
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{ display: { md: 'none' }, bgcolor: BRAND.navy, borderBottom: '1px solid rgba(255,255,255,.08)' }}
      >
        <Toolbar>
          <IconButton color="inherit" edge="start" aria-label="Open navigation" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }}><MenuRounded /></IconButton>
          <Typography sx={{ flexGrow: 1, fontWeight: 750 }}>{currentLabel}</Typography>
          <AccountControl compact />
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant={desktop ? 'permanent' : 'temporary'}
          open={desktop || mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', bgcolor: BRAND.navy, border: 0 } }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ position: 'relative', flexGrow: 1, minWidth: 0, pt: { xs: 8, md: 0 }, overflow: 'hidden' }}>
        <Box className="arena-ambient" aria-hidden="true"><Box /><Box /></Box>
        <Box
          sx={{
            display: { xs: 'none', md: 'flex' }, height: 76, px: 4,
            alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'rgba(255,255,255,.72)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">Arena Master</Typography>
            <Typography sx={{ fontWeight: 750, lineHeight: 1.2 }}>{currentLabel}</Typography>
          </Box>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box className="arena-broadcast-pill"><LiveDot label="ARENA LIVE" /></Box>
            <AccountControl />
          </Stack>
        </Box>
        <Box sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 1480, mx: 'auto', px: { xs: 2, sm: 3, lg: 4 }, py: { xs: 3, md: 4 } }}>
          <Box key={location.pathname} className="arena-route-enter">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/create-tournament" element={<TournamentCreation />} />
              <Route path="/register-team" element={<TeamRegistration />} />
              <Route path="/bracket" element={<TournamentBracket />} />
              <Route path="/bracket/:tournamentName" element={<TournamentBracket />} />
              <Route path="/standings" element={<Standings />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
